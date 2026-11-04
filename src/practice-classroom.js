import {PRACTICE_LIMIT} from './practice-editions.js';

export const CLASSROOM_KEY = 'parvoz-classroom-v1:';
export const CLASSROOM_LIMIT = 20;
export const REPORT_MAX_BYTES = 128 * 1024;
const REPORT_FORMAT = 'parvoz-practice-report';
const invalidReport = () => new Error('Invalid practice report. Export a new report from Parvoz Start.');
const isoDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const validDay = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  isoDate(value + 'T00:00:00.000Z');
export const classroomTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

function formatDay(date, formatter) {
  const parts = formatter.formatToParts(date);
  const get = type => parts.find(part => part.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function classroomDate(date = new Date(), timeZone = classroomTimeZone()) {
  return formatDay(date, new Intl.DateTimeFormat('en', {timeZone, year:'numeric', month:'2-digit', day:'2-digit'}));
}

export function learnerCode(value) {
  const code = String(value ?? '').trim().toUpperCase();
  if (!/^[A-Z0-9_-]{1,16}$/.test(code)) throw new Error('Use a learner code of 1–16 letters A–Z, digits, hyphens or underscores.');
  return code;
}

function cleanRecords(records, lessons) {
  if (!Array.isArray(records) || records.length > PRACTICE_LIMIT) throw invalidReport();
  const ids = new Set(lessons.map(lesson => lesson.id));
  return records.map(record => {
    if (!record || typeof record.lessonId !== 'string' || !isoDate(record.completedAt) ||
      !Number.isSafeInteger(record.durationMs) || record.durationMs < 0 ||
      !Number.isSafeInteger(record.resets) || record.resets < 0 ||
      !['angle','horizon','acro'].includes(record.mode)) throw invalidReport();
    if (!ids.has(record.lessonId)) throw new Error('Report contains an unavailable exercise. Check that both computers use the same version.');
    // Only practice fields cross the export/import boundary. Never copy account data.
    return {lessonId:record.lessonId, completedAt:record.completedAt,
      durationMs:record.durationMs, resets:record.resets, mode:record.mode};
  });
}

function mergeRecords(previous, incoming) {
  const records = new Map();
  for (const record of [...previous, ...incoming]) records.set(JSON.stringify(record), record);
  return [...records.values()].sort((a,b) => a.completedAt.localeCompare(b.completedAt)).slice(-PRACTICE_LIMIT);
}

export function practiceReport(records, lessons, now = new Date()) {
  return JSON.stringify({format:REPORT_FORMAT, version:1, exportedAt:now.toISOString(),
    records:cleanRecords(records.slice(-PRACTICE_LIMIT), lessons)}, null, 2);
}

export function parsePracticeReport(text, lessons) {
  if (typeof text !== 'string') throw invalidReport();
  if (new TextEncoder().encode(text).byteLength > REPORT_MAX_BYTES) throw new Error('Practice report is larger than 128 KiB.');
  let report;
  try { report = JSON.parse(text.replace(/^\uFEFF/, '')); } catch { throw invalidReport(); }
  if (!report || report.format !== REPORT_FORMAT || report.version !== 1 || !isoDate(report.exportedAt)) throw invalidReport();
  return cleanRecords(report.records, lessons);
}

export class PracticeClassroom {
  constructor(owner, storage, lessons) {
    this.key = CLASSROOM_KEY + encodeURIComponent(String(owner));
    this.storage = storage; this.lessons = lessons; this.participants = []; this.persistent = true;
    this.date = classroomDate();
    try {
      const raw = storage.getItem(this.key);
      if (!raw) return;
      // Bound corrupted local data too; maximum valid roster is well under 2 MiB.
      if (raw.length > 2 * 1024 * 1024) throw invalidReport();
      const data = JSON.parse(raw);
      if (data?.version !== 1 || !validDay(data.date) || !Array.isArray(data.participants) || data.participants.length > CLASSROOM_LIMIT) throw invalidReport();
      const codes = new Set();
      const participants = data.participants.map(item => {
        const code = learnerCode(item.code);
        if (codes.has(code) || (item.importedAt !== null && !isoDate(item.importedAt))) throw invalidReport();
        codes.add(code);
        const records = cleanRecords(item.records, lessons);
        if (!item.importedAt && records.length) throw invalidReport();
        return {code, importedAt:item.importedAt, records:mergeRecords([],records)};
      });
      this.participants = participants; this.date = data.date;
    } catch { this.persistent = false; }
  }
  save() {
    try {
      this.storage.setItem(this.key, JSON.stringify({version:1, date:this.date, participants:this.participants}));
      this.persistent = true;
    } catch { this.persistent = false; }
  }
  setDate(date) {
    if (!validDay(date)) throw new Error('Choose a valid practice date.');
    this.date = date; this.save();
  }
  add(value) {
    const code = learnerCode(value);
    if (this.participants.some(item => item.code === code)) throw new Error('This learner code is already in the group.');
    if (this.participants.length >= CLASSROOM_LIMIT) throw new Error('This group already has 20 learners.');
    this.participants.push({code, importedAt:null, records:[]}); this.save();
    return code;
  }
  remove(value) {
    const code = learnerCode(value);
    this.participants = this.participants.filter(item => item.code !== code); this.save();
  }
  importReport(code, text, now = new Date()) {
    const participant = this.participants.find(item => item.code === learnerCode(code));
    if (!participant) throw new Error('Learner is no longer in the group.');
    const incoming = parsePracticeReport(text, this.lessons);
    const importedAt = now.toISOString();
    // Validate the entire file before changing the existing participant.
    participant.records = mergeRecords(participant.records, incoming);
    participant.importedAt = importedAt; this.save();
  }
  rows(lessonId, timeZone = classroomTimeZone()) {
    if (!this.lessons.some(lesson => lesson.id === lessonId)) throw new Error('Choose an exercise for the group.');
    const formatter = new Intl.DateTimeFormat('en', {timeZone, year:'numeric', month:'2-digit', day:'2-digit'});
    return this.participants.map(item => {
      const attempts = item.records.filter(record => record.lessonId === lessonId && formatDay(new Date(record.completedAt), formatter) === this.date);
      const last = attempts.at(-1);
      return {code:item.code, status:!item.importedAt ? 'No report' : last ? 'Completions reported' : 'No completions for this date',
        completions:attempts.length, durationMs:last?.durationMs ?? null, resets:last?.resets ?? null,
        completedAt:last?.completedAt ?? '', importedAt:item.importedAt ?? ''};
    });
  }
}

const cell = value => '"' + String(value).replace(/^[\s]*[=+@-]/, match => "'" + match).replaceAll('"','""') + '"';
export function classroomCSV(classroom, lessonId, timeZone = classroomTimeZone()) {
  const lesson = classroom.lessons.find(item => item.id === lessonId);
  const rows = [['learner_code','practice_date','time_zone','lesson_id','lesson','status','completed_attempts','last_duration_ms','last_resets','last_completed_at_utc','imported_at_utc','verification']];
  for (const row of classroom.rows(lessonId, timeZone)) rows.push([row.code, classroom.date, timeZone, lessonId, lesson.name,
    row.status, row.completions, row.durationMs ?? '', row.resets ?? '', row.completedAt, row.importedAt, 'local learner report']);
  return '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
}
