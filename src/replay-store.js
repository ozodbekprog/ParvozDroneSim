const DATABASE = 'liftoff-local-replays';
const STORE = 'flights';
const METADATA = 'flight-metadata';
const summary=({id,name,map,track,mode,duration,createdAt})=>({id,name,map,track,mode,duration,createdAt});

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 2);
    request.onupgradeneeded = () => {
      const db=request.result;
      const flights=db.objectStoreNames.contains(STORE)?request.transaction.objectStore(STORE):db.createObjectStore(STORE,{keyPath:'id'});
      const metadata=db.createObjectStore(METADATA,{keyPath:'id'});
      // Upgrade one flight at a time; never clone the entire old library into RAM.
      flights.openCursor().onsuccess=event=>{const cursor=event.target.result;if(!cursor)return;metadata.put(summary(cursor.value));cursor.continue();};
    };
    request.onsuccess = () => {request.result.onversionchange=()=>request.result.close();resolve(request.result);};
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Close other game tabs and try again. Replay storage is locked.'));
  });
}

async function transaction(mode, callback) {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction([STORE,METADATA], mode);
      const request = callback(tx.objectStore(STORE),tx.objectStore(METADATA));
      let result;
      request.onsuccess = () => { result = request.result; };
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Replay write was aborted.'));
      tx.oncomplete = () => resolve(result);
    });
  } finally { db.close(); }
}

export async function listReplays() {
  const records = await transaction('readonly', store => store.getAll());
  return records.sort((a, b) => b.createdAt - a.createdAt);
}

/** Menu listings read only small metadata rows; export explicitly reads full flights. */
export async function listReplaySummaries(){
  const records=await transaction('readonly',(_store,metadata)=>metadata.getAll());
  return records.sort((a,b)=>b.createdAt-a.createdAt);
}

export const getReplay = id => transaction('readonly', store => store.get(id));
export const deleteReplay = id => transaction('readwrite', (store,metadata) => {metadata.delete(id);return store.delete(id);});

export async function saveReplay(record) {
  if (!record.frames?.length) throw new Error('There are no flight frames to save.');
  // randomUUID is unavailable on HTTP LAN origins. getRandomValues also works there.
  const id = globalThis.crypto?.randomUUID?.() || Array.from(crypto.getRandomValues(new Uint8Array(16)), value => value.toString(16).padStart(2, '0')).join('');
  const value = { ...record, id, createdAt: Date.now(), name: String(record.name || 'Flight').trim().slice(0, 80) || 'Flight' };
  await transaction('readwrite', (store,metadata) => {metadata.put(summary(value));return store.put(value);});
  return value;
}

export async function renameReplay(id, name) {
  const record = await getReplay(id);
  if (!record) throw new Error('Replay not found.');
  record.name = String(name || '').trim().slice(0, 80) || record.name;
  await transaction('readwrite', (store,metadata) => {metadata.put(summary(record));return store.put(record);});
  return record;
}

export async function importReplays(records) {
  const db = await openDatabase();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction([STORE,METADATA], 'readwrite');
      const store = tx.objectStore(STORE);
      for (const record of records) {store.put(record);tx.objectStore(METADATA).put(summary(record));}
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Replay import was aborted.'));
    });
  } finally { db.close(); }
}
