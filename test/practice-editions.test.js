import test from 'node:test';
import assert from 'node:assert/strict';
import {PracticeJournal,PRACTICE_KEY,PRACTICE_LIMIT,editionFromURL,assignmentFromURL,lessonLink,nextLesson,practiceCSV} from '../src/practice-editions.js';
import {practiceLayout} from '../src/practice-layout.js';
import {SoloSession} from '../src/solo-session.js';
import {defaultBuild} from '../shared/physics.js';
import {TUTORIALS} from '../shared/catalog.js';
import {translate} from '../src/i18n.js';
import {PRACTICE_MESSAGES} from '../src/locales/practice.js';
const memory=()=>{const data=new Map();return {getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value)};};
const lessons=[{id:'second',name:'Second',order:2,steps:[{text:'Second exercise'}]},{id:'first',name:'First',order:1,steps:[{text:'First exercise'}]}];
const attempt=()=>({tutorial:{id:'first',steps:[{},{}]},stepIndex:0,room:{status:'running'},item:{resetId:1,finishMs:null}});
const finish=session=>{session.stepIndex=2;session.room.status='ended';session.item.finishMs=1234;};

test('edition and assignment links validate catalog ids and strip unrelated query data',()=>{
 assert.equal(editionFromURL('https://example.test/?edition=class'),'class');
 assert.equal(editionFromURL('https://example.test/?edition=anything'),'standard');
 assert.equal(assignmentFromURL('https://example.test/?lesson=gone',lessons).invalid,true);
 assert.equal(assignmentFromURL('https://example.test/?lesson=first',lessons).lesson.id,'first');
 assert.equal(lessonLink('https://example.test/?token=secret#private','first',lessons),'https://example.test/?edition=start&lesson=first');
 assert.throws(()=>lessonLink('https://example.test','gone',lessons));
 assert.throws(()=>lessonLink('javascript:alert(1)','first',lessons));
});
test('only completed lesson attempts count, exactly once per run, with correct reset baseline',()=>{
 const journal=new PracticeJournal('pilot',memory()),session=attempt();journal.begin(session);
 assert.equal(journal.complete(session,'acro'),false);
 session.room.status='ended';session.item.finishMs=1234;
 assert.equal(journal.complete(session,'acro'),false);
 finish(session);session.item.resetId=4;
 assert.equal(journal.complete(session,'acro'),true);
 assert.equal(journal.complete(session,'acro'),false);assert.equal(journal.records[0].resets,3);
 journal.begin(session);assert.equal(journal.complete(session,'angle'),true);
 assert.equal(journal.records.length,2);assert.equal(journal.records[1].resets,0);
});
test('records survive reload and remain separate for different pilots',()=>{
 const storage=memory(),journal=new PracticeJournal('a',storage),session=attempt();journal.begin(session);finish(session);journal.complete(session,'angle');
 assert.equal(new PracticeJournal('a',storage).records.length,1);
 assert.equal(new PracticeJournal('b',storage).records.length,0);
 assert.equal(nextLesson(lessons,journal.records).id,'second');
 assert.equal(nextLesson(lessons,[...journal.records,{lessonId:'second'}]),null);
});
test('blocked or corrupted storage remains usable with an explicit nonpersistent state',()=>{
 const storage={getItem(){throw Error('denied')},setItem(){throw Error('quota')}};
 const journal=new PracticeJournal('a',storage),session=attempt();journal.begin(session);finish(session);
 assert.equal(journal.complete(session,'acro'),true);assert.equal(journal.persistent,false);assert.equal(journal.records.length,1);
 const malformed=memory();malformed.setItem(PRACTICE_KEY+'a','{bad');assert.equal(new PracticeJournal('a',malformed).records.length,0);
 malformed.setItem(PRACTICE_KEY+'a',JSON.stringify([{lessonId:'x',durationMs:-1}]));assert.equal(new PracticeJournal('a',malformed).records.length,0);
});
test('retention is bounded and CSV prevents spreadsheet formula execution',()=>{
 const storage=memory(),journal=new PracticeJournal('a',storage);
 const older=attempt();older.tutorial.id='second';journal.begin(older);finish(older);journal.complete(older,'acro');
 for(let i=0;i<PRACTICE_LIMIT+3;i++){const session=attempt();journal.begin(session);finish(session);journal.complete(session,'acro');}
 assert.equal(journal.records.length,PRACTICE_LIMIT);
 const reloaded=new PracticeJournal('a',storage);assert.equal(nextLesson(lessons,reloaded.records,reloaded.completedIds),null);
 const csv=practiceCSV(journal.records,[{id:'first',name:'=HYPERLINK("bad")'}]);
 assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes('"\'=HYPERLINK(""bad"")"'));
 assert.ok(csv.includes('local learner report'));assert.ok(!csv.includes('pilot_id'));
});
test('a real solo lesson requires its terminal objective and can be recorded again after restart',()=>{
 const source=TUTORIALS[0];const lesson={...source,steps:[{objective:'manual',text:'Test briefing'}]};
 const session=new SoloSession({map:lesson.map,track:lesson.track,mode:'training',tutorial:lesson,user:{id:'test',username:'Test',build:defaultBuild()}});
 const journal=new PracticeJournal('a',memory());journal.begin(session);
 session.advanceManual();assert.equal(journal.complete(session,'angle'),false);
 session.room.status='running';session.advanceManual();assert.equal(journal.complete(session,'angle'),true);
 session.restart();journal.begin(session);assert.equal(journal.complete(session,'angle'),false);
 session.room.status='running';session.advanceManual();assert.equal(journal.complete(session,'angle'),true);
 assert.equal(journal.records.length,2);
});
test('class view provides a real assignment URL, empty export is disabled and text is escaped',()=>{
 const markup=practiceLayout({edition:'class',lessons,records:[],selectedId:'second',persistent:true,base:'https://example.test/'});
 assert.ok(markup.includes('lesson=second'));assert.match(markup,/data-action="practice-export" disabled/);
 const unsafe=practiceLayout({edition:'start',lessons:[{...lessons[0],name:'<img onerror=bad>'}],records:[],base:'https://example.test/',persistent:false});
 assert.ok(!unsafe.includes('<img onerror'));assert.ok(unsafe.includes('&lt;img'));assert.ok(unsafe.includes('Browser storage is unavailable'));
 for(const [en,ru,uz] of PRACTICE_MESSAGES.filter(([key])=>!key.includes('{'))){assert.equal(translate(en,'ru'),ru);assert.equal(translate(en,'uz'),uz);}
});
