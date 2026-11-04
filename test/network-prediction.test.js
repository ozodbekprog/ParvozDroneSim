import test from 'node:test';
import assert from 'node:assert/strict';
import { PredictionHistory } from '../src/prediction-history.js';
import { resetCommandStream, enqueueCommands, takeCommands, canStartRoom, roomPreparationKey } from '../shared/network-flight.js';
import { createDroneState, resolveBuild } from '../shared/physics.js';
import { simulateCommand } from '../shared/flight-session.js';
import { MAPS, getTrack } from '../shared/content.js';
import { DEFAULT_FLIGHT_CONTROLLER } from '../shared/flight-controller.js';

const map=MAPS['minus-two-demo'],track=getTrack('minus-two-demo','minus-two-demo-stock-practice'),spec=resolveBuild();
const simulate=(state,command)=>simulateCommand(state,command,spec,map,track,[],DEFAULT_FLIGHT_CONTROLLER);
const command=seq=>({seq,input:{throttle:.44,pitch:Math.sin(seq/40)*.08,roll:Math.cos(seq/50)*.06,yaw:.05},flightMode:'angle'});

test('250 ms delivery with jitter never corrects matching local commands',()=>{
  const history=new PredictionHistory(),client=createDroneState([0,15,-30]),server={state:structuredClone(client)};
  history.reset(client);resetCommandStream(server,0);
  const packets=[],snapshots=[];let lastArrival=0,acks=0;
  for(let tick=1;tick<=340;tick++) {
    const now=tick*1000/60;
    if(tick<=300) {
      const input=command(tick);simulate(client,input);assert.ok(history.record(input,client));
      lastArrival=Math.max(lastArrival,now+250+Math.sin(tick*.7)*50);packets.push({at:lastArrival,input});
    }
    while(packets[0]?.at<=now)assert.equal(enqueueCommands(server,[packets.shift().input],now),'ok');
    for(const input of takeCommands(server,now)){simulate(server.state,input);server.lastSeq=input.seq;}
    if(tick%3===0)snapshots.push({at:now+250+Math.sin(tick)*40,seq:server.lastSeq,state:structuredClone(server.state)});
    while(snapshots[0]?.at<=now) {
      const snapshot=snapshots.shift(),result=history.accept(snapshot.state,snapshot.seq,client,simulate);
      assert.equal(result.corrected,false);assert.equal(result.state,client);acks++;
    }
  }
  assert.ok(acks>90);assert.equal(server.lastSeq,300);assert.equal(history.entries.length,0);assert.deepEqual(client,server.state);
});

test('a genuine correction restores PID and motors then replays only pending commands',()=>{
  const history=new PredictionHistory(),client=createDroneState([0,10,-30]);history.reset(client);
  simulate(client,command(1));history.record(command(1),client);
  const authority=structuredClone(client);authority.pidIntegral[0]+=.1;authority.motors[0]+=.001;
  simulate(client,command(2));history.record(command(2),client);
  const expected=structuredClone(authority);simulate(expected,command(2));
  const result=history.accept(authority,1,client,simulate);assert.equal(result.corrected,true);assert.deepEqual(result.state,expected);
  assert.equal(history.entries.length,1);assert.deepEqual(history.entries[0].state,expected);
  history.reset(authority);assert.equal(history.entries.length,0);assert.equal(history.ack,0);
});

test('ordinary gaps do not advance physics; two seconds enters explicit failsafe',()=>{
  const item={};resetCommandStream(item,0);
  assert.deepEqual(takeCommands(item,300),[]);assert.deepEqual(takeCommands(item,1999),[]);
  assert.equal(takeCommands(item,2001).length,1);assert.equal(item.failSafe,true);assert.equal(item.lastSeq,0);
  assert.equal(enqueueCommands(item,[command(1)],2010),'resync');
  resetCommandStream(item,2010);item.recovering=true;assert.deepEqual(takeCommands(item,2020),[]);
  assert.equal(enqueueCommands(item,[command(1)],2030),'ok');assert.equal(item.recovering,false);
  assert.equal(takeCommands(item,2031)[0].seq,1);
});

test('duplicates are ignored, missing commands require resync, and readiness includes tuning',()=>{
  const item={};resetCommandStream(item,0);assert.equal(enqueueCommands(item,[command(1),command(1)],20),'ok');assert.equal(item.commands.length,1);
  assert.equal(enqueueCommands(item,[command(3)],30),'resync');
  const room={players:new Map([['a',{ready:true,controllerReady:true}],['b',{ready:true,controllerReady:false}]])};
  assert.equal(canStartRoom(room),false);room.players.get('b').controllerReady=true;assert.equal(canStartRoom(room),true);
  const view={contentRevision:'v1',map:'ironworks-v2',track:'ironworks-v2-loading-run',players:[{id:'a',build:{color:'#ff0000'}}]};
  const key=roomPreparationKey(view);view.players.push({id:'b',build:{color:'#00ff00'}});assert.notEqual(roomPreparationKey(view),key);
});
