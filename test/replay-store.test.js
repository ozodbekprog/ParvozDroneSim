import test from 'node:test';import assert from 'node:assert/strict';
import {IDBFactory} from 'fake-indexeddb';
import {saveReplay,getReplay,listReplays,listReplaySummaries,renameReplay,deleteReplay,importReplays} from '../src/replay-store.js';

test('old replay library migrates without losing frames and listings exclude payloads',async t=>{
 const previous=globalThis.indexedDB;globalThis.indexedDB=new IDBFactory();t.after(()=>{if(previous===undefined)delete globalThis.indexedDB;else globalThis.indexedDB=previous;});
 const old={id:'legacy-flight-0001',name:'Legacy',map:'minus-two-demo',track:'track',duration:1000,createdAt:1,frames:Array.from({length:100},(_,time)=>({time,players:[]}))};
 await new Promise((resolve,reject)=>{const request=indexedDB.open('liftoff-local-replays',1);request.onupgradeneeded=()=>request.result.createObjectStore('flights',{keyPath:'id'});request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction('flights','readwrite');tx.objectStore('flights').put(old);tx.oncomplete=()=>{db.close();resolve();};};});
 const list=await listReplaySummaries();assert.equal(list.length,1);assert.equal(list[0].frames,undefined);assert.equal(list[0].name,'Legacy');
 assert.deepEqual((await getReplay(old.id)).frames,old.frames);assert.deepEqual((await listReplays())[0].frames,old.frames,'local backup still exports complete recordings');
 await renameReplay(old.id,'Renamed');assert.equal((await listReplaySummaries())[0].name,'Renamed');assert.deepEqual((await getReplay(old.id)).frames,old.frames);
 const saved=await saveReplay({...old,name:'New'});assert.equal((await listReplaySummaries()).length,2);assert.equal((await getReplay(saved.id)).frames.length,100);
 await importReplays([{...old,id:'imported-flight-0001',createdAt:3}]);assert.equal((await listReplaySummaries()).length,3);
 await deleteReplay(saved.id);assert.equal(await getReplay(saved.id),undefined);assert.equal((await listReplaySummaries()).length,2);
});
