import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { migrateAccountRecovery, passwordHash, verifyPassword, issueRecoveryCode, recoverAccount } from '../server/account-security.js';
import { Admission, playerLimit } from '../server/admission.js';
import { backupRetention } from '../tools/backup-remote.js';
import { loadOptions } from '../tools/load-clients.js';
import { assessCapacity } from '../tools/check-capacity.js';

test('legacy accounts migrate intact; recovery codes replace, consume once and revoke sessions atomically', async () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('CREATE TABLE users(id INTEGER PRIMARY KEY,username TEXT,password TEXT,xp INTEGER); CREATE TABLE sessions(token TEXT,player TEXT,expires INTEGER)');
    const hash = await passwordHash('old-password');
    db.prepare('INSERT INTO users VALUES(7,?,?,930)').run('LegacyPilot', hash);
    db.prepare('INSERT INTO sessions VALUES(?,?,0)').run('old-session', JSON.stringify({id:7}));
    db.prepare('INSERT INTO sessions VALUES(?,?,0)').run('other-session', JSON.stringify({id:9}));
    migrateAccountRecovery(db); migrateAccountRecovery(db);
    assert.equal(db.prepare('SELECT xp FROM users WHERE id=7').get().xp,930);
    assert.equal(await issueRecoveryCode(db,7,'wrong-password'),null);
    const first = await issueRecoveryCode(db,7,'old-password');
    const second = await issueRecoveryCode(db,7,'old-password');
    assert.notEqual(first,second);
    assert.notEqual(db.prepare('SELECT recovery_hash FROM users').get().recovery_hash,second);
    assert.equal(await recoverAccount(db,'LegacyPilot',first,'new-password'),null);
    assert.equal(await recoverAccount(db,'LegacyPilot',second,'tiny'),null);
    const attempts = await Promise.all([recoverAccount(db,'LegacyPilot',second,'new-password'),recoverAccount(db,'LegacyPilot',second,'new-password')]);
    assert.equal(attempts.filter(id=>id===7).length,1);
    assert.deepEqual(db.prepare('SELECT token FROM sessions').all().map(row=>row.token),['other-session']);
    assert.equal(await verifyPassword('new-password',db.prepare('SELECT password FROM users').get().password),true);
    assert.equal(await issueRecoveryCode(db,7,'old-password'),null);
    assert.equal(await recoverAccount(db,'LegacyPilot',second,'third-password'),null);
    assert.equal(db.prepare('SELECT xp FROM users').get().xp,930);
  } finally { db.close(); }
});
test('100 slots cannot be exceeded, double counted or held after release', () => {
  const gate = new Admission(playerLimit('100')), sockets = Array.from({length:101},()=>({}));
  for(let i=0;i<100;i++) assert.equal(gate.acquire(sockets[i],i),null);
  assert.equal(gate.acquire(sockets[0],0),null);
  assert.equal(gate.acquire(sockets[100],100),'SERVER_FULL');
  assert.equal(gate.acquire(sockets[100],0),'PILOT_ONLINE');
  gate.release(sockets[0]); assert.equal(gate.acquire(sockets[100],100),null);
  assert.deepEqual(gate.view(),{online:100,limit:100,available:0});
  assert.throws(()=>playerLimit('101')); assert.throws(()=>playerLimit('bad'));
});
test('backup retention protects unrelated objects and refuses quota overflow before deletion', () => {
  const objects = Array.from({length:8},(_,i)=>({name:`liftoff-2026-10-0${i+1}.sqlite`,size:10}));
  objects.push({name:'do-not-delete.sqlite',size:10});
  assert.deepEqual(backupRetention(objects,'liftoff-2026-10-09.sqlite',10,100),['liftoff-2026-10-02.sqlite','liftoff-2026-10-01.sqlite']);
  assert.throws(()=>backupRetention(objects,'liftoff-2026-10-09.sqlite',11,100),/budget/);
  assert.throws(()=>backupRetention(objects,'../database.sqlite',10),/Invalid/);
});
test('load options support a full hour, 100 clients, multiple maps and small rooms without silently clamping', () => {
  const options=loadOptions(['--clients=100','--seconds=3600','--room-size=2','--maps=hangar,forest']);
  assert.equal(options.count,100); assert.equal(options.seconds,3600);assert.equal(options.roomSize,2);assert.equal(options.maps.length,2);
  assert.throws(()=>loadOptions(['--clients=101']));assert.throws(()=>loadOptions(['--url=http://example.com']));
});
test('capacity assessment rejects aggregate-only reports, missing metrics, drift and a stalled pilot', () => {
  const start=Date.parse('2026-10-04T00:00:00Z');
  const report={startedAt:new Date(start).toISOString(),endedAt:new Date(start+3600000).toISOString(),requestedSeconds:3600,clients:100,roomSize:8,
    pilots:Array.from({length:100},(_,client)=>({client,sent:216000,acknowledged:215000,movingSnapshots:72000,maxAckGapMs:100,pingP95Ms:90})),
    clientChecksPassed:true,errors:0,disconnects:0,failures:[],maps:['hangar','forest'],coldAssets:{requested:true,completed:100}};
  const samples=Array.from({length:240},(_,i)=>({type:'server-metrics',at:new Date(start+(i+1)*15000).toISOString(),players:100,tickP95Ms:8,serverErrors:0,serverTick:(i+1)*900,simulationDroppedMs:0}));
  assert.equal(assessCapacity(report,samples).automatedChecksPassed,true);
  assert.equal(assessCapacity(report,samples).capacityVerified,false);
  assert.equal(assessCapacity(report,[]).automatedChecksPassed,false);
  samples.at(-1).simulationDroppedMs=200; assert.equal(assessCapacity(report,samples).automatedChecksPassed,false);
  samples.at(-1).simulationDroppedMs=0; report.pilots[99].acknowledged=1;
  assert.equal(assessCapacity(report,samples).automatedChecksPassed,false);
});
