import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const hash=text=>createHash('sha256').update(text).digest('hex');
function snapshot(file){
 const db=new DatabaseSync(file,{readOnly:true});db.exec('BEGIN');const tables={};
 for(const {name} of db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name <> 'sessions' ORDER BY name").all()){
  const quoted='"'+name.replaceAll('"','""')+'"';
  const rows=db.prepare('SELECT * FROM '+quoted).all().map(row=>hash(JSON.stringify(row))).sort();tables[name]=rows;
 }
 db.exec('COMMIT');db.close();return tables;
}
const [beforePath,afterPath]=process.argv.slice(2);assert.ok(beforePath,'Pass a verified SQLite backup and optionally its post-release counterpart');
const before=snapshot(beforePath),after=afterPath?snapshot(afterPath):null;
if(after)for(const [table,rows] of Object.entries(before)){
 assert.ok(after[table],`Missing player table: ${table}`);const counts=new Map();
 for(const row of after[table])counts.set(row,(counts.get(row)||0)+1);
 for(const row of rows){assert.ok(counts.get(row)>0,`Original player row changed or missing: ${table}`);counts.set(row,counts.get(row)-1);}
}
console.log(JSON.stringify({tables:Object.fromEntries(Object.entries(after||before).map(([name,rows])=>[name,{rows:rows.length,sha256:hash(JSON.stringify(rows))}])),originalPlayerRowsPreserved:after?true:null,sessionsExcluded:true}));
