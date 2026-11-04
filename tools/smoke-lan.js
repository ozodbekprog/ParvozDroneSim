import WebSocket from 'ws';
import assert from 'node:assert/strict';
import { NETWORK_PROTOCOL, roomPreparationKey } from '../shared/network-flight.js';
import { DEFAULT_FLIGHT_CONTROLLER } from '../shared/flight-controller.js';

const base = process.argv[2] || process.env.BASE_URL || process.env.LIFTOFF_URL || 'http://localhost:2567';
const catalog=await(await fetch(`${base}/api/catalog`)).json();
assert.equal(catalog.protocol,NETWORK_PROTOCOL,'Client/server protocol must match.');
const mapId = process.argv[3] || catalog.maps[0].id;
const trackId = process.argv[4] || catalog.maps.find(map=>map.id===mapId)?.tracks[0].id;
const aircraft=(process.argv[5]||'armattan-gecko,dquad-addiction').split(',');
assert.equal(aircraft.length,2);assert.ok(aircraft.every(id=>catalog.drones[id]),'Both smoke-test aircraft must exist on the target.');
const guests = await Promise.all([0, 1].map(async () => {
  const response = await fetch(`${base}/api/guest`, { method: 'POST' });
  if (!response.ok) throw new Error(`Guest API failed: ${response.status}`);
  return response.json();
}));
const builds=guests.map((guest,index)=>({...guest.user.build,...catalog.drones[aircraft[index]].stockParts,drone:aircraft[index],color:index?'#2277ff':'#ff5522',led:index?'#88ff22':'#ff22aa'}));
await Promise.all(guests.map(async(guest,index)=>{
  const response=await fetch(`${base}/api/build`,{method:'POST',headers:{Authorization:`Bearer ${guest.token}`,'Content-Type':'application/json'},body:JSON.stringify({build:builds[index]})});
  if(!response.ok)throw new Error(`Build API failed: ${response.status}`);
}));

async function connect(token) {
  const socket = new WebSocket(base.replace(/^http/, 'ws') + '/socket');
  const messages = [];
  socket.on('message', buffer => messages.push(JSON.parse(String(buffer))));
  await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
  socket.send(JSON.stringify({ type: 'auth', token, protocol: NETWORK_PROTOCOL }));
  return {
    socket, messages,
    send(message) { socket.send(JSON.stringify(message)); },
    async waitFor(predicate, label) {
      const until = Date.now() + 7000;
      while (Date.now() < until) {
        const found = messages.find(predicate);
        if (found) return found;
        await new Promise(resolve => setTimeout(resolve, 30));
      }
      throw new Error(`Timed out waiting for ${label}. Messages: ${JSON.stringify(messages.map(item => item.type))}`);
    }
  };
}

const [host, pilot] = await Promise.all(guests.map(guest => connect(guest.token)));
try {
  await Promise.all([host.waitFor(message => message.type === 'authenticated', 'host auth'), pilot.waitFor(message => message.type === 'authenticated', 'pilot auth')]);
  host.send({ type: 'create', map: mapId, track: trackId, mode: 'race', ranked: true });
  const joined = await host.waitFor(message => message.type === 'joined', 'room creation');
  pilot.send({ type: 'join', code: joined.code });
  await pilot.waitFor(message => message.type === 'joined', 'room join');
  const lobby = await host.waitFor(message => message.type === 'room' && message.room.players.length === 2, 'two-player room');
  assert.equal(lobby.room.mode,'race');
  for(const [index,guest] of guests.entries())assert.deepEqual(lobby.room.players.find(player=>player.id===guest.user.id).build,builds[index]);
  if (lobby.room.ranked) throw new Error('A player-created room incorrectly became ranked.');
  host.send({ type: 'start' });
  const waiting=await host.waitFor(message=>message.type==='room'&&message.room.startRequested,'asset-readiness wait');
  assert.equal(waiting.room.status,'lobby');
  const preparation=roomPreparationKey(lobby.room),revision=lobby.room.contentRevision;
  host.send({type:'assets-ready',map:mapId,track:trackId,revision:'stale-content',preparation});
  await host.waitFor(message=>message.type==='error'&&message.error.includes('Content or room changed'),'stale content rejection');
  for(const client of [host,pilot])client.send({type:'controller',profile:DEFAULT_FLIGHT_CONTROLLER,slot:0,preparation});
  await Promise.all([host.waitFor(message=>message.type==='controller-applied','host controller'),pilot.waitFor(message=>message.type==='controller-applied','pilot controller')]);
  host.send({type:'assets-ready',map:mapId,track:trackId,revision,preparation});
  await host.waitFor(message=>message.type==='room'&&message.room.players.filter(item=>item.ready).length===1,'first pilot ready');
  assert.ok(!host.messages.some(message=>message.type==='snapshot'),'Must wait for both clients before spawn/countdown');
  pilot.send({type:'assets-ready',map:mapId,track:trackId,revision,preparation});
  const spawn = await host.waitFor(message => message.type === 'snapshot' && message.players.length === 2, 'visible countdown spawn');
  await host.waitFor(message => message.type === 'room' && message.room.status === 'running', 'race start');
  const snapshot = await pilot.waitFor(message => message.type === 'snapshot' && message.players.length === 2, 'two-player simulation');
  if (snapshot.players.some(player => !player.state?.position)) throw new Error('Simulation snapshot is incomplete.');
  for (let seq = 1; seq <= 12; seq++) {
    for (const [client, guest] of [[host, guests[0]], [pilot, guests[1]]]) client.send({ type: 'inputs', resetId: spawn.players.find(item => item.id === guest.user.id).resetId, frames: [{ seq, input: { throttle: 0.7, pitch: 0.15, yaw: 0.1, roll: 0 }, flightMode: 'acro' }] });
    await new Promise(resolve => setTimeout(resolve, 17));
  }
  const moved = await pilot.waitFor(message => message.type === 'snapshot' && message.players.every(item => item.seq === 12), 'acknowledged inputs for both pilots');
  assert.ok(moved.players.every(item => item.state.motors.some(speed => speed > 0)));
  host.send({ type: 'pause' });
  await new Promise(resolve => setTimeout(resolve, 80));
  assert.ok(!host.messages.some(message => message.type === 'room' && message.room.status === 'paused'), 'Multiplayer must not pause');
  console.log(`Multiplayer smoke passed: different drones/colors, stale content rejected, profiles and assets ready before countdown, acknowledged controls, authoritative movement, and room continues during pause.`);
} finally {
  host.socket.close(); pilot.socket.close();
}
