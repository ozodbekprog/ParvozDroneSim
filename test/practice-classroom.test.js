import test from 'node:test';
import assert from 'node:assert/strict';
import {PracticeClassroom, CLASSROOM_KEY, CLASSROOM_LIMIT, REPORT_MAX_BYTES, practiceReport, parsePracticeReport, classroomCSV, classroomDate} from '../src/practice-classroom.js';
import {PracticeJournal} from '../src/practice-editions.js';
import {classroomLayout, bindClassroom} from '../src/practice-classroom-ui.js';
import {practiceLayout} from '../src/practice-layout.js';
import {CLASSROOM_MESSAGES} from '../src/locales/classroom.js';
import {translate} from '../src/i18n.js';

const lessons = [{id:'hover', name:'Hover', steps:[]}, {id:'turn', name:'Turn', steps:[]}];
const memory = () => { const map=new Map(); return {getItem:key=>map.get(key)||null,setItem:(key,value)=>map.set(key,value)}; };
const record = (overrides = {}) => ({lessonId:'hover', completedAt:'2026-10-25T08:00:00.000Z', durationMs:30000, resets:2, mode:'angle', ...overrides});
const report = records => practiceReport(records,lessons,new Date('2026-10-25T09:00:00.000Z'));
const group = (storage=memory(),owner='teacher') => {const value=new PracticeClassroom(owner,storage,lessons);value.setDate('2026-10-25');return value;};

test('exported learner reports strip personal fields and allow empty completion history',()=>{
 const data=JSON.parse(report([record({token:'private',username:'Name',email:'private@example.test'})]));
 assert.deepEqual(Object.keys(data).sort(),['exportedAt','format','records','version']);
 assert.deepEqual(data.records,[record()]);assert.deepEqual(parsePracticeReport(report([]),lessons),[]);
 assert.deepEqual(parsePracticeReport('\uFEFF'+report([record()]),lessons),[record()]);
});
test('completed journal attempts round-trip to classroom without exporting the pilot id',()=>{
 const journal=new PracticeJournal('private-pilot-id',memory());
 const session={tutorial:{id:'hover',steps:[{}]},stepIndex:0,room:{status:'running'},item:{resetId:1,finishMs:null}};
 journal.begin(session);assert.equal(journal.complete(session,'angle'),false);
 session.stepIndex=1;session.room.status='ended';session.item.finishMs=22000;session.item.resetId=3;
 journal.complete(session,'angle',new Date('2026-10-25T08:00:00.000Z'));
 const text=report(journal.records);assert.ok(!text.includes('private-pilot-id'));
 const classroom=group();classroom.add('P01');classroom.importReport('P01',text);
 assert.equal(classroom.rows('hover','Asia/Tashkent')[0].durationMs,22000);
 assert.equal(classroom.rows('hover','Asia/Tashkent')[0].resets,2);
});
test('codes are normalized, unique and limited; removing allows a corrected code',()=>{
 const classroom=group();assert.equal(classroom.add(' p01 '),'P01');
 assert.throws(()=>classroom.add('p01'),/already/);
 for(const bad of ['', '<script>', 'A'.repeat(17),'Иван','A B']) assert.throws(()=>classroom.add(bad));
 for(let i=1;i<CLASSROOM_LIMIT;i++)classroom.add('CODE_'+i);
 assert.throws(()=>classroom.add('EXTRA'),/20/);classroom.remove('P01');classroom.add('P02');
 assert.equal(classroom.participants.length,20);
});
test('report import merges repeated and older exports without double counting or losing new attempts',()=>{
 const classroom=group();classroom.add('P01');
 const first=record(), second=record({completedAt:'2026-10-25T08:01:00.000Z',durationMs:19000,resets:0});
 classroom.importReport('P01',report([first,second]));classroom.importReport('P01',report([first,second]));
 classroom.importReport('P01',report([first]));
 const row=classroom.rows('hover','UTC')[0];assert.equal(row.completions,2);assert.equal(row.durationMs,19000);assert.equal(row.resets,0);
});
test('report statuses distinguish missing report from empty history and filter lesson plus local date',()=>{
 const classroom=group();classroom.add('P01');classroom.add('P02');classroom.add('P03');
 classroom.importReport('P02',report([]));
 classroom.importReport('P03',report([record({completedAt:'2026-10-24T20:00:00.000Z'}),record({lessonId:'turn'})]));
 const rows=classroom.rows('hover','Asia/Tashkent');
 assert.deepEqual(rows.map(row=>row.status),['No report','No completions for this date','Completions reported']);
 assert.equal(rows[0].durationMs,null);assert.equal(rows[1].resets,null);assert.equal(rows[2].completions,1);
 assert.equal(classroom.rows('hover','UTC')[2].completions,0);
 classroom.setDate('2026-10-24');assert.equal(classroom.rows('turn','UTC')[2].completions,0);
 assert.equal(classroomDate(new Date('2026-10-24T20:00:00.000Z'),'Asia/Tashkent'),'2026-10-25');
 assert.throws(()=>classroom.setDate('2026-02-30'));assert.equal(classroom.date,'2026-10-24');
});
test('malformed, incompatible and oversized reports are rejected atomically',()=>{
 const classroom=group();classroom.add('P01');classroom.importReport('P01',report([record()]));
 const before=JSON.stringify(classroom.participants);
 const base=JSON.parse(report([record()]));
 const invalid=['{bad','null','[]',JSON.stringify({...base,version:2}),JSON.stringify({...base,format:'other'}),JSON.stringify({...base,exportedAt:'2026-02-30T00:00:00.000Z'}),' '.repeat(REPORT_MAX_BYTES+1),JSON.stringify({...base,records:Array(201).fill(record())})];
 for(const overrides of [{durationMs:-1},{durationMs:1.5},{durationMs:1e30},{resets:-1},{mode:'gps'},{lessonId:'missing'},{completedAt:'yesterday'},{completedAt:'2026-02-30T00:00:00.000Z'}])invalid.push(JSON.stringify({...base,records:[record(),record(overrides)]}));
 for(const text of invalid){assert.throws(()=>classroom.importReport('P01',text));assert.equal(JSON.stringify(classroom.participants),before);}
 assert.throws(()=>classroom.importReport('P02',report([])),/no longer/);
 // Byte limits apply to UTF-8, not only JavaScript string length.
 assert.throws(()=>parsePracticeReport('я'.repeat(REPORT_MAX_BYTES/2+1),lessons),/128/);
});
test('the latest 200 records are retained even when an old report is imported last',()=>{
 const classroom=group();classroom.add('P01');
 const all=Array.from({length:205},(_,i)=>record({completedAt:new Date(Date.UTC(2026,9,25,8,0,i)).toISOString()}));
 classroom.importReport('P01',report(all.slice(0,200)));classroom.importReport('P01',report(all.slice(200)));
 classroom.importReport('P01',report(all.slice(0,4)));
 assert.equal(classroom.participants[0].records.length,200);
 assert.equal(classroom.participants[0].records[0].completedAt,all[5].completedAt);
});
test('class data survives reload, separates pilots and warns when storage fails',()=>{
 const storage=memory(),classroom=group(storage);classroom.add('P01');classroom.importReport('P01',report([record()]));
 const restored=new PracticeClassroom('teacher',storage,lessons);assert.equal(restored.date,'2026-10-25');assert.equal(restored.rows('hover','UTC')[0].completions,1);
 assert.equal(new PracticeClassroom('other',storage,lessons).participants.length,0);
 const bad={getItem(){throw Error('blocked')},setItem(){throw Error('quota')}};
 const session=group(bad);session.add('P01');session.importReport('P01',report([record()]));
 assert.equal(session.persistent,false);assert.equal(session.rows('hover','UTC')[0].completions,1);
 storage.setItem(CLASSROOM_KEY+'teacher','{bad');
 const corrupt=new PracticeClassroom('teacher',storage,lessons);assert.equal(corrupt.persistent,false);assert.equal(corrupt.participants.length,0);
});
test('CSV includes everyone, blank missing metrics, date, zone and neutralizes formula text',()=>{
 const classroom=group();classroom.lessons=[{...lessons[0],name:'=HYPERLINK("bad")'},lessons[1]];
 classroom.add('-P01');classroom.add('P02');classroom.importReport('P02',report([record()]));
 const csv=classroomCSV(classroom,'hover','Asia/Tashkent');
 assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes('"\'-P01"'));assert.ok(csv.includes('"\'=HYPERLINK(""bad"")"'));
 assert.ok(csv.includes('"No report","0","",""'));assert.ok(csv.includes('"2026-10-25","Asia/Tashkent"'));
 assert.ok(csv.includes('"Completions reported","1","30000","2"'));assert.ok(csv.includes('local learner report'));
});
test('classroom renders selected-lesson results, clear empty states and translated actions',()=>{
 const classroom=group();let markup=classroomLayout(classroom,'hover');assert.ok(markup.includes('Add learner codes'));
 classroom.add('P01');classroom.importReport('P01',report([record()]));
 markup=practiceLayout({edition:'class',lessons,records:[],selectedId:'turn',persistent:true,base:'https://example.test/',classroom});
 assert.ok(markup.includes('data-classroom-lesson="turn"'));assert.ok(markup.includes('No completions for this date'));
 assert.ok(markup.includes('data-action="practice-report"'));assert.ok(markup.includes('scope="col"'));
 classroom.lessons=[{...lessons[0],name:'<img src=x onerror=bad>'},lessons[1]];
 assert.ok(!classroomLayout(classroom,'hover').includes('<img'));
 for(const [en,ru,uz] of CLASSROOM_MESSAGES){assert.equal(translate(en,'ru'),ru);assert.equal(translate(en,'uz'),uz);}
});

test('delayed file read cannot populate a different view or a recreated learner', async ()=>{
 // Minimal event fixture exercises the actual async import handler, not just the data model.
 const oldDocument=globalThis.document;
 try {
   for(const reason of ['view','removed','valid','oversized']){
     const classroom=group();classroom.add('P01');let click,change,resolve,removed=false,current=true,refreshed=0;
     const status={textContent:''};
     const button={dataset:{classroomImport:'P01'},addEventListener:(_type,fn)=>{click=fn}};
     const root={querySelector:selector=>selector==='#classroom-status'?status:null,querySelectorAll:selector=>selector==='[data-classroom-import]'?[button]:[]};
     const file={size:reason==='oversized'?REPORT_MAX_BYTES+1:100,text:()=>new Promise(done=>{resolve=done})};
     globalThis.document={body:{appendChild(){}},createElement:()=>({files:[file],addEventListener:(type,fn)=>{if(type==='change')change=fn},click(){},remove(){removed=true}})};
     bindClassroom(root,{classroom,refresh:()=>refreshed++,isCurrent:()=>current,download(){}});
     click();const pending=change();
     if(reason==='view')current=false;
     if(reason==='removed'){classroom.remove('P01');classroom.add('P01');}
     if(resolve)resolve(report([record()]));await pending;
     assert.equal(classroom.participants[0].records.length,reason==='valid'?1:0);
     assert.equal(refreshed,reason==='valid'?1:0);assert.equal(removed,true);
     if(reason==='oversized')assert.match(status.textContent,/128/);
   }
 } finally { globalThis.document=oldDocument; }
});

test('removal requires an explicit second action and cancellation preserves imported reports',()=>{
 const classroom=group();classroom.add('P01');classroom.importReport('P01',report([record()]));
 const element=dataset=>({dataset,hidden:false,addEventListener(_type,fn){this.click=fn},focus(){this.focused=true}});
 const remove=element({classroomRemove:'P01'}),cancel=element({classroomCancel:'P01'}),confirm=element({classroomConfirm:'P01'}),confirmation={hidden:true};
 const entries={'[data-classroom-remove]':remove,'[data-classroom-cancel]':cancel,'[data-classroom-confirm]':confirm};
 const root={querySelectorAll:selector=>entries[selector]?[entries[selector]]:[],querySelector:selector=>selector.startsWith('[data-classroom-confirmation=')?confirmation:selector.startsWith('[data-classroom-remove=')?remove:selector.startsWith('[data-classroom-cancel=')?cancel:null};
 bindClassroom(root,{classroom,refresh(){},isCurrent:()=>true,download(){}});
 remove.click();assert.equal(classroom.participants.length,1);assert.equal(confirmation.hidden,false);assert.equal(cancel.focused,true);
 cancel.click();assert.equal(confirmation.hidden,true);assert.equal(classroom.participants[0].records.length,1);
 remove.click();confirm.click();assert.equal(classroom.participants.length,0);
});
