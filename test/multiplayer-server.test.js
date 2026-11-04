import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import WebSocket from 'ws';
import { NETWORK_PROTOCOL, roomPreparationKey } from '../shared/network-flight.js';
import { DEFAULT_FLIGHT_CONTROLLER } from '../shared/flight-controller.js';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

test('room browser, privacy, chat, finished-pilot isolation and three cup rounds work over real sockets', { timeout: 45000 }, async () => {
  // Disposable server/catalog: short straight courses verify finish handling
  // without changing official content, player accounts, or the running game.
  const fixture = mkdtempSync(join(project, '.room-smoke-'));
  const clients = [];
  let child;
  try {
    for (const folder of ['server','shared']) cpSync(join(project,folder), join(fixture,folder), {recursive:true});
    mkdirSync(join(fixture,'public','content'), {recursive:true});
    const catalog = JSON.parse(readFileSync(join(project,'public','content','catalog.json')));
    const source = catalog.maps[0];
    catalog.maps = ['hangar','smoke-second','smoke-third'].map(id => ({
      ...source, id, name:id, theme:'custom', objects:[],model:undefined,modelNode:undefined,modelLods:undefined,lowLod:undefined, collisionFile:undefined,preparedCollisionFile:undefined,
      colliders:[], wind:[0,0,0], tracks:[{id:`${id}-short`,name:'Short verification course',laps:1,
        spawn:{position:[0,10,0],yaw:0},gates:[{position:[0,10,.05],yaw:0,width:100,height:100}]}]
    }));
    catalog.challenges=[];catalog.tutorials=[];catalog.assets=[];
    writeFileSync(join(fixture,'public','content','catalog.json'), JSON.stringify(catalog));
    const base = 'http://127.0.0.1:26569';
    let output = '';
    child = spawn(process.execPath, [join(fixture,'server','index.js')], {
      env:{...process.env, PORT:'26569',HOST:'127.0.0.1',NODE_ENV:'production',DATA_DIR:join(fixture,'data')},
      stdio:['ignore','pipe','pipe'],windowsHide:true
    });
    child.stdout.on('data', bytes => {output+=bytes;}); child.stderr.on('data', bytes => {output+=bytes;});
    child.on('error', error => {output+=error.message;});
    for (let attempt=0;attempt<100 && !output.includes('Singleplayer + Multiplayer:');attempt++) await delay(20);
    assert.match(output, /Singleplayer \+ Multiplayer:/, output);
    async function client(protocol=NETWORK_PROTOCOL, username) {
      const guest = await (await fetch(base+(username ? '/api/register' : '/api/guest'),{method:'POST',
        headers:{'Content-Type':'application/json'},body:username ? JSON.stringify({username,password:'local-smoke-only-123'}) : undefined})).json();
      const socket=new WebSocket(base.replace('http','ws')+'/socket'), messages=[];
      socket.on('message',bytes=>messages.push(JSON.parse(String(bytes))));
      await new Promise((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject);});
      const entry={socket,messages,id:guest.user.id,token:guest.token,send:value=>socket.send(JSON.stringify(value)),
        async wait(predicate, after=0) {
          const until=Date.now()+6000;
          while(Date.now()<until) {const match=messages.slice(after).find(predicate);if(match)return match;await delay(20);}
          throw new Error('Missing message; received '+messages.map(message=>message.type).join(', '));
        }};
      clients.push(entry);entry.send({type:'auth',token:guest.token,protocol});return entry;
    }
    const [host,pilot,outsider]=await Promise.all([client(NETWORK_PROTOCOL,'RoomSmokeHost'),client(NETWORK_PROTOCOL,'RoomSmokePilot'),client()]);
    await Promise.all([host,pilot,outsider].map(entry=>entry.wait(message=>message.type==='authenticated')));
    const old=await client(NETWORK_PROTOCOL-1);
    assert.equal((await old.wait(message=>message.type==='error')).updateRequired,true);
    host.send({type:'create',map:'hangar',track:'hangar-short',mode:'cup',visibility:'public',maxPlayers:2});
    const joined=await host.wait(message=>message.type==='joined');
    assert.equal((await (await fetch(base+'/api/rooms')).json()).rooms[0].code,joined.code);
    pilot.send({type:'join',code:joined.code});await pilot.wait(message=>message.type==='joined');
    outsider.send({type:'join',code:joined.code});
    await outsider.wait(message=>message.type==='error'&&message.error.includes('full'));
    outsider.send({type:'create',map:'hangar',track:'hangar-short',visibility:'private',mode:'race'});
    await outsider.wait(message=>message.type==='joined');
    const publicRooms=(await (await fetch(base+'/api/rooms')).json()).rooms;
    assert.equal(publicRooms.length,1);assert.equal(publicRooms[0].joinable,false);
    host.send({type:'chat',text:'  hello\nroom  '});
    assert.equal((await pilot.wait(message=>message.type==='chat')).entry.text,'hello room');
    await delay(60);assert.ok(!outsider.messages.some(message=>message.type==='chat'));

    async function readyRound(round) {
      const lobby=(await host.wait(message=>message.type==='room'&&message.room.players.length===2&&message.room.status==='lobby'&&message.room.cup.round===round)).room;
      const preparation=roomPreparationKey(lobby);
      const marks=[host.messages.length,pilot.messages.length];
      for(const entry of [host,pilot]) {
        entry.send({type:'controller',preparation,profile:DEFAULT_FLIGHT_CONTROLLER,slot:0});
        entry.send({type:'assets-ready',preparation,revision:lobby.contentRevision,map:lobby.map,track:lobby.track});
      }
      host.send({type:'start'});
      await host.wait(message=>message.type==='room'&&message.room.status==='running',marks[0]);
      return marks;
    }
    async function finish(entry, mark) {
      const snapshot=await entry.wait(message=>message.type==='snapshot'&&message.players.some(player=>player.id===entry.id),mark);
      const resetId=snapshot.players.find(player=>player.id===entry.id).resetId;
      let seq=0;
      const timer=setInterval(()=>entry.send({type:'inputs',resetId,frames:[{seq:++seq,input:{throttle:.5,pitch:.3,roll:0,yaw:0},flightMode:'angle'}]}),17);
      try { await entry.wait(message=>message.type==='finish'&&message.id===entry.id,mark); }
      finally { clearInterval(timer); }
      return resetId;
    }
    for(let round=1;round<=3;round++) {
      const marks=await readyRound(round);
      const resetId=await finish(host,marks[0]);
      const after=host.messages.length;
      host.send({type:'reset'});host.send({type:'request-resync',resetId});
      host.send({type:'inputs',resetId,frames:[{seq:1000,input:{throttle:1,pitch:1,roll:1,yaw:1},flightMode:'acro'}]});
      const waiting=await host.wait(message=>message.type==='snapshot',after);
      assert.ok(!waiting.players.some(player=>player.id===host.id),'Finished drone must leave simulation snapshots');
      assert.ok(waiting.players.some(player=>player.id===pilot.id),'Remaining pilot continues flying');
      assert.ok(!host.messages.slice(after).some(message=>message.type==='input-resync'));
      await finish(pilot,marks[1]);
      const ended=(await host.wait(message=>message.type==='room'&&message.room.status==='ended',after)).room;
      assert.equal(ended.cup.round,round);
      assert.equal(ended.cup.standings.reduce((sum,entry)=>sum+entry.points,0),16*round);
      const finishedMark=host.messages.length;
      host.send({type:'restart'});await delay(50);
      assert.ok(!host.messages.slice(finishedMark).some(message=>message.type==='room'&&message.room.status==='countdown'),'Cup round cannot be replayed for duplicate awards');
      if(round<3) host.send({type:'advance-cup'});
    }
    const leaderboard=await (await fetch(base+'/api/cup-leaderboard',{headers:{Authorization:`Bearer ${host.token}`}})).json();
    assert.equal(leaderboard.rows.length,2);
    assert.equal(leaderboard.rows.reduce((sum,entry)=>sum+entry.wins,0),1);
    assert.equal(leaderboard.rows.reduce((sum,entry)=>sum+entry.points,0),48);
  } finally {
    for(const entry of clients) entry.socket.terminate();
    if(child?.pid && child.exitCode===null) { child.kill();await new Promise(resolve=>child.once('exit',resolve)); }
    if(!resolve(fixture).startsWith(project+'\\.room-smoke-') && !resolve(fixture).startsWith(project+'/.room-smoke-')) throw new Error('Unsafe fixture path');
    rmSync(fixture,{recursive:true,force:true});
  }
});
