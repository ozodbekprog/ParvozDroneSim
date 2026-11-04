import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { DatabaseSync, backup } from 'node:sqlite';
import WebSocket from 'ws';
import { NETWORK_PROTOCOL, roomPreparationKey } from '../shared/network-flight.js';
import { DEFAULT_FLIGHT_CONTROLLER } from '../shared/flight-controller.js';
import { runLoadTest } from '../tools/load-clients.js';
import { verifyBackup } from '../tools/verify-backup.js';

const project=resolve(import.meta.dirname,'..');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('matching startup revision avoids retransmitting catalog; stale and legacy clients get complete content', {timeout:30000}, async()=>{
  const server=await fixture();
  try {
    const full=await server.api('/api/catalog');
    const compact=await server.api('/api/catalog?knownRevision='+encodeURIComponent(full.body.revision));
    assert.equal(compact.status,200);
    assert.equal(compact.body.contentUnchanged,true);
    for(const key of ['maps','drones','parts','career','customContent','assets'])assert.equal(compact.body[key],undefined,key);
    for(const key of ['protocol','revision','weekly','localOnly','multiplayer','capacityTest'])assert.deepEqual(compact.body[key],full.body[key],key);
    assert.ok(JSON.stringify(compact.body).length<1024);
    const stale=await server.api('/api/catalog?knownRevision=stale');
    assert.deepEqual(stale.body,full.body);
  } finally {await server.close();}
});
test('account fleet follows a second device, rejects stale writes, and survives restart', {timeout:30000}, async()=>{
  const server=await fixture();
  try {
    const first=(await server.api('/api/register',{username:'FleetPilot',password:'fleet-test-password'})).body;
    const second=(await server.api('/api/login',{username:'FleetPilot',password:'fleet-test-password'})).body;
    const outsider=(await server.api('/api/register',{username:'OtherFleet',password:'fleet-test-password'})).body;
    const initial=await server.api('/api/fleet',undefined,first.token);
    assert.equal(initial.status,200);assert.equal(initial.body.revision,0);
    const build={...first.user.build,color:'#123abc',actionCamera:true};
    delete build.antenna; // A pre-antenna client must retain its stock slot on save.
    const legacy=await server.api('/api/build',{build},first.token);
    assert.equal(legacy.status,200);assert.equal(legacy.body.build.antenna,'fixed');assert.equal(legacy.body.build.actionCamera,false);
    const fleet={version:1,selectedId:`modified:${build.drone}:1`,modified:[{baseDrone:build.drone,copyNumber:1,build,controller:{rates:{roll:{rcRate:1.4}}}}]};
    const saved=await server.api('/api/fleet',{fleet,revision:0},first.token);
    assert.equal(saved.status,200);assert.equal(saved.body.revision,1);
    assert.equal(saved.body.fleet.modified[0].build.color,'#123abc');
    assert.equal(saved.body.fleet.modified[0].build.actionCamera,false,'separate action cameras are prohibited, including old client saves');
    assert.equal(saved.body.fleet.modified[0].build.antenna,'fixed');
    assert.equal(saved.body.fleet.modified[0].controller.rates.roll.rcRate,1.4);
    assert.deepEqual((await server.api('/api/fleet',undefined,second.token)).body,saved.body);
    assert.equal((await server.api('/api/me',undefined,second.token)).body.user.build.color,'#123abc');
    assert.equal((await server.api('/api/fleet',undefined,outsider.token)).body.fleet,null);
    assert.equal((await server.api('/api/fleet',{fleet,revision:0},second.token)).status,409);
    const invalid=structuredClone(fleet);invalid.modified[0].build.motors='does-not-exist';
    assert.equal((await server.api('/api/fleet',{fleet:invalid,revision:1},first.token)).status,400);
    await server.restart();
    assert.deepEqual((await server.api('/api/fleet',undefined,second.token)).body,saved.body);
    assert.equal((await server.api('/api/fleet')).status,401);
    const guest=(await server.api('/api/guest',{})).body;
    assert.equal((await server.api('/api/fleet',{fleet,revision:0},guest.token)).status,403);
  } finally {await server.close();}
});
async function fixture(capacityTest=false) {
  const root=mkdtempSync(join(project,'.beta-test-')), clients=[];
  for(const folder of ['server','shared']) cpSync(join(project,folder),join(root,folder),{recursive:true});
  mkdirSync(join(root,'public','content','assets'),{recursive:true});
  const catalog=JSON.parse(readFileSync(join(project,'public','content','catalog.json'),'utf8'));
  const source=catalog.maps[0];
  catalog.maps=['hangar','forest'].map(id=>({...source,id,name:id,theme:'custom',objects:[],model:undefined,modelNode:undefined,modelLods:undefined,lowLod:undefined,collisionFile:undefined,preparedCollisionFile:undefined,colliders:[],wind:[0,0,0],
    tracks:[{id:`${id}-test`,name:'Test',laps:1,spawn:{position:[0,10,0],yaw:0},gates:[{position:[0,10,100000],yaw:0,width:1,height:1}]}]}));
  catalog.challenges=[];catalog.tutorials=[];
  // Small payload exercises concurrent HTTP downloads, not visual quality or real-map capacity.
  const payload=Buffer.alloc(64,1),url='/content/assets/probe-0123456789abcdef.glb';
  writeFileSync(join(root,'public',url.slice(1)),payload);
  catalog.assets=[{url,bytes:payload.length}];
  writeFileSync(join(root,'public','content','catalog.json'),JSON.stringify(catalog));
  let child,base,output='';
  async function start() {
    output='';
    child=spawn(process.execPath,[join(root,'server','index.js')],{env:{...process.env,PORT:'0',HOST:'127.0.0.1',NODE_ENV:'production',DATA_DIR:join(root,'data'),MAX_MULTIPLAYER_PLAYERS:capacityTest?'4':'2',CAPACITY_TEST_MODE:capacityTest?'1':'0'},stdio:['ignore','pipe','pipe'],windowsHide:true});
    child.stdout.on('data',data=>{output+=data;});child.stderr.on('data',data=>{output+=data;});
    child.on('error',error=>{output+=error.message;});
    for(let i=0;i<200&&!/localhost:(\d+)/.test(output);i++) await delay(20);
    const match=/localhost:(\d+)/.exec(output);assert.ok(match,output);base=`http://127.0.0.1:${match[1]}`;
  }
  async function stop() { for(const client of clients) client.socket.terminate(); if(child?.pid&&child.exitCode===null) {const ended=once(child,'exit');child.kill();await ended;} }
  async function api(path,body,token) {
    const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});
    return {status:response.status,body:await response.json()};
  }
  async function connect(token,protocol=NETWORK_PROTOCOL) {
    const socket=new WebSocket(base.replace('http','ws')+'/socket'),messages=[];
    const client={socket,messages,send:message=>socket.send(JSON.stringify(message)),async wait(predicate,offset=0) {
      for(let i=0;i<400;i++){const found=messages.slice(offset).find(predicate);if(found)return found;await delay(20);}throw new Error('Missing socket event');
    }};
    clients.push(client);socket.on('message',data=>messages.push(JSON.parse(String(data))));socket.on('error',()=>{});
    await once(socket,'open');client.send({type:'auth',token,protocol});return client;
  }
  await start();
  return {root,api,connect,get base(){return base;},get output(){return output;},async restart(){await stop();await start();},async close(){await stop();if(!resolve(root).startsWith(project+sep+'.beta-test-'))throw new Error('Unsafe test path');rmSync(root,{recursive:true,force:true});}};
}

test('public recovery API preserves progress, revokes live sockets and survives server restart; capacity preserves admitted pilots', {timeout:45000}, async()=>{
  const server=await fixture();
  try {
    const registered=await server.api('/api/register',{username:'BetaPilot',password:'old-password'});
    const token=registered.body.token, id=registered.body.user.id;
    const first=await server.connect(token);await first.wait(message=>message.type==='authenticated');
    const guest=(await server.api('/api/guest',{})).body;
    const second=await server.connect(guest.token);await second.wait(message=>message.type==='authenticated');
    const outsider=(await server.api('/api/guest',{})).body;
    const rejected=await server.connect(outsider.token);assert.equal((await rejected.wait(message=>message.type==='error')).code,'SERVER_FULL');
    assert.equal(first.socket.readyState,WebSocket.OPEN);assert.equal(second.socket.readyState,WebSocket.OPEN);
    assert.equal((await server.api('/api/rooms')).body.capacity.online,2);
    first.send({type:'create',map:'hangar',track:'hangar-test',visibility:'public'});
    await first.wait(message=>message.type==='joined');
    const room=(await first.wait(message=>message.type==='room')).room;
    const preparation=roomPreparationKey(room);
    first.send({type:'controller',profile:DEFAULT_FLIGHT_CONTROLLER,preparation});await first.wait(message=>message.type==='controller-applied');
    first.send({type:'assets-ready',map:room.map,track:room.track,revision:'wrong',preparation});
    assert.match((await first.wait(message=>message.type==='error')).error,/Content/);
    const results=await server.api('/api/solo-result',{map:'hangar',track:'hangar-test',mode:'time',timeMs:20000},token);assert.equal(results.status,200);
    const before=(await server.api('/api/me',undefined,token)).body;
    assert.ok(before.user.xp>0);
    assert.equal((await server.api('/api/account/recovery-code',{password:'wrong'},token)).status,403);
    const recovery=await server.api('/api/account/recovery-code',{password:'old-password'},token);assert.equal(recovery.status,200);
    assert.equal((await server.api('/api/me',undefined,token)).body.recoveryEnabled,true);
    assert.equal((await server.api('/api/account/recover',{username:'BetaPilot',code:recovery.body.code,newPassword:'new-password'})).status,200);
    assert.equal((await server.api('/api/me',undefined,token)).status,401);
    for(let i=0;i<50&&first.socket.readyState!==WebSocket.CLOSED;i++)await delay(20);
    assert.equal(first.socket.readyState,WebSocket.CLOSED);
    const third=await server.connect(outsider.token);await third.wait(message=>message.type==='authenticated');
    assert.equal((await server.api('/api/login',{username:'BetaPilot',password:'old-password'})).status,401);
    assert.equal((await server.api('/api/account/recover',{username:'BetaPilot',code:recovery.body.code,newPassword:'third-password'})).status,400);
    await server.restart();
    assert.equal((await server.api('/api/me',undefined,token)).status,401);
    const logged=(await server.api('/api/login',{username:'BetaPilot',password:'new-password'})).body;
    const after=(await server.api('/api/me',undefined,logged.token)).body;
    assert.equal(after.user.id,id);assert.equal(after.user.xp,before.user.xp);assert.deepEqual(after.records,before.records);assert.equal(after.recoveryEnabled,false);
    const oldClient=await server.connect(guest.token,NETWORK_PROTOCOL-1);assert.equal((await oldClient.wait(message=>message.type==='error')).updateRequired,true);
    const db=new DatabaseSync(join(server.root,'data','liftoff.sqlite'),{readOnly:true});
    const copy=join(server.root,'backup.sqlite');try{await backup(db,copy);}finally{db.close();}
    assert.equal(verifyBackup(copy).rows.users,1);
    assert.equal((await server.api('/api/account/recovery-code',{password:'new-password'},logged.token)).status,200);
    for(let i=0;i<5;i++)await server.api('/api/account/recover',{username:'UnknownPilot',code:'bad',newPassword:'new-password'});
    assert.equal((await server.api('/api/account/recover',{username:'UnknownPilot',code:'bad',newPassword:'new-password'})).status,429);
  } finally {await server.close();}
});
test('isolated load runner exercises every client, multiple small rooms and concurrent downloads', {timeout:45000},async()=>{
  const server=await fixture(true);
  try{
    const report=await runLoadTest({base:server.base,count:4,seconds:10,roomSize:2,maps:['hangar','forest'],coldAssets:true});
    assert.equal(report.clientChecksPassed,true,JSON.stringify(report.failures));assert.equal(report.rooms,2);assert.equal(report.coldAssets.completed,4);
    assert.ok(report.pilots.every(pilot=>pilot.acknowledged>500&&pilot.sent>500&&pilot.movingSnapshots>0));assert.equal(report.capacityVerified,false);
    assert.equal((await server.api('/api/catalog')).body.capacityTest,true);
  }finally{await server.close();}
});
