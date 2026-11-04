// Local practice records are learner reports, never ranked or server-certified scores.
export const PRACTICE_LIMIT = 200;
export const PRACTICE_KEY = 'parvoz-practice-v1:';
export const orderedLessons = lessons => [...lessons].sort((a,b) => (a.order ?? 100) - (b.order ?? 100) || a.id.localeCompare(b.id));

export function editionFromURL(url) {
  const value = new URL(url).searchParams.get('edition');
  return ['start','class'].includes(value) ? value : 'standard';
}
export function assignmentFromURL(url, lessons) {
  const id = new URL(url).searchParams.get('lesson');
  return { lesson: lessons.find(lesson => lesson.id === id) || null, invalid: Boolean(id && !lessons.some(lesson => lesson.id === id)) };
}
export function lessonLink(base, lessonId, lessons) {
  if (!lessons.some(lesson => lesson.id === lessonId)) throw new Error('Lesson unavailable');
  const url = new URL(base);
  if (!['http:','https:'].includes(url.protocol)) throw new Error('Invalid game address');
  url.search = ''; url.hash = '';
  url.searchParams.set('edition','start'); url.searchParams.set('lesson',lessonId);
  return url.href;
}
export function nextLesson(lessons, records, completedIds = []) {
  const completed = new Set([...completedIds,...records.map(record => record.lessonId)]);
  return orderedLessons(lessons).find(lesson => !completed.has(lesson.id)) || null;
}
function validRecord(record) {
  return record && typeof record.lessonId === 'string' && record.lessonId.length < 150 &&
    typeof record.completedAt === 'string' && Number.isFinite(Date.parse(record.completedAt)) &&
    Number.isSafeInteger(record.durationMs) && record.durationMs >= 0 &&
    Number.isSafeInteger(record.resets) && record.resets >= 0 &&
    ['angle','horizon','acro'].includes(record.mode);
}
export class PracticeJournal {
  constructor(owner, storage) {
    this.storage = storage; this.key = PRACTICE_KEY + encodeURIComponent(String(owner));
    this.records = []; this.completedIds = []; this.persistent = true; this.attempts = new WeakMap();
    try {
      const data = JSON.parse(storage.getItem(this.key) || '[]');
      const rows = Array.isArray(data) ? data : data?.version === 1 && Array.isArray(data.records) ? data.records : [];
      this.records = rows.filter(validRecord).slice(-PRACTICE_LIMIT);
      const ids = data?.version === 1 && Array.isArray(data.completedIds) ? data.completedIds : [];
      this.completedIds = [...new Set([...ids.filter(id=>typeof id==='string'&&id.length<150),...this.records.map(record=>record.lessonId)])].slice(-1000);
    } catch { this.persistent = false; }
  }
  begin(session) {
    if (session?.tutorial) this.attempts.set(session,{resetId:session.item.resetId, saved:false});
  }
  complete(session, mode, now = new Date()) {
    const attempt = this.attempts.get(session);
    if (!attempt || attempt.saved || session.room.status !== 'ended' ||
        session.stepIndex !== session.tutorial.steps.length || session.item.finishMs == null) return false;
    const record = {lessonId:session.tutorial.id, completedAt:now.toISOString(),
      durationMs:session.item.finishMs, resets:Math.max(0,session.item.resetId-attempt.resetId), mode};
    if (!validRecord(record)) return false;
    attempt.saved = true; this.records = [...this.records,record].slice(-PRACTICE_LIMIT);
    this.completedIds = [...new Set([...this.completedIds,record.lessonId])].slice(-1000);
    try { this.storage.setItem(this.key,JSON.stringify({version:1,records:this.records,completedIds:this.completedIds})); this.persistent = true; }
    catch { this.persistent = false; }
    return true;
  }
}
const cell = value => '"' + String(value).replace(/^[\s]*[=+@-]/, match => "'" + match).replaceAll('"','""') + '"';
export function practiceCSV(records, lessons) {
  const names = new Map(lessons.map(lesson => [lesson.id,lesson.name]));
  const rows = [['completed_at_utc','lesson_id','lesson','duration_ms','resets','finish_mode','verification']];
  for (const record of records.filter(validRecord)) rows.push([record.completedAt,record.lessonId,names.get(record.lessonId) || record.lessonId,record.durationMs,record.resets,record.mode,'local learner report']);
  return '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
}
