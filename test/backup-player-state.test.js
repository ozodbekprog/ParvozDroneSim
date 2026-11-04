import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,copyFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const checker=fileURLToPath(new URL('../tools/verify-player-state.js',import.meta.url));
function fixture(t){
 const prefix=join(tmpdir(),'parvoz-player-snapshot-'),directory=mkdtempSync(prefix);
 t.after(()=>{assert.ok(resolve(directory).startsWith(resolve(prefix)));rmSync(directory,{recursive:true,force:true});});
 const before=join(directory,'before.sqlite'),after=join(directory,'after.sqlite'),db=new DatabaseSync(before);
 db.exec("CREATE TABLE users(id INTEGER PRIMARY KEY,username TEXT,password TEXT,xp INTEGER); CREATE TABLE records(user_id INTEGER,track TEXT,best_ms INTEGER); CREATE TABLE sessions(token TEXT,player TEXT); INSERT INTO users VALUES(1,'private-name','private-hash',120); INSERT INTO records VALUES(1,'test',400); INSERT INTO sessions VALUES('private-token','private-player');");
 db.close();copyFileSync(before,after);return {before,after};
}
const check=(...files)=>spawnSync(process.execPath,[checker,...files],{encoding:'utf8'});
test('backup comparison permits new players and session changes without exposing private rows',t=>{
 const {before,after}=fixture(t),db=new DatabaseSync(after);
 db.exec("INSERT INTO users VALUES(2,'new-pilot','new-hash',0); DELETE FROM sessions;");db.close();
 const result=check(before,after);assert.equal(result.status,0,result.stderr);
 const report=JSON.parse(result.stdout);assert.equal(report.originalPlayerRowsPreserved,true);assert.equal(report.tables.users.rows,2);assert.equal(report.sessionsExcluded,true);
 for(const value of ['private-name','private-hash','private-token','private-player'])assert.equal(result.stdout.includes(value),false);
});
test('backup comparison rejects deleted or changed progress and does not create a missing database',t=>{
 const {before,after}=fixture(t),db=new DatabaseSync(after);db.exec('UPDATE users SET xp=0 WHERE id=1');db.close();
 const result=check(before,after);assert.notEqual(result.status,0);assert.match(result.stderr,/Original player row changed or missing: users/);
 copyFileSync(before,after);const deleted=new DatabaseSync(after);deleted.exec('DELETE FROM records');deleted.close();
 assert.match(check(before,after).stderr,/Original player row changed or missing: records/);
 const missing=join(dirname(after),'missing.sqlite');assert.notEqual(check(missing).status,0);assert.equal(existsSync(missing),false);
});
