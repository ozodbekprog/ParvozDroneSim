/** Keep the preview and actions attached to a drone visible in this filter. */
export function pageEntries(entries, requestedPage = 0, size = 6) {
  const pages = Math.max(1, Math.ceil(entries.length / size));
  const page = Math.max(0, Math.min(pages - 1, Math.trunc(requestedPage) || 0));
  return { entries: entries.slice(page * size, (page + 1) * size), page, pages, start: page * size };
}

export function visibleFleetSelection(entries, filter, previewId, activeId) {
  const kind = String(filter || 'all').toLowerCase();
  const visible = entries.filter(entry => !['original', 'modified'].includes(kind) || entry.kind === kind);
  const selected = visible.find(entry => entry.id === previewId)
    || visible.find(entry => entry.id === activeId)
    || visible[0]
    || null;
  return { entries: visible, selected };
}

function sameValue(left, right) {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return leftKeys.length === rightKeys.length && leftKeys.every(key => Object.hasOwn(right, key) && sameValue(left[key], right[key]));
}

/** UI-only changes such as the open workbench tab do not make a drone dirty. */
export function workbenchHasChanges(draft, savedEntry) {
  if (!draft) return false;
  if (!savedEntry) return true;
  return !sameValue(draft.build, savedEntry.build) || !sameValue(draft.controller, savedEntry.controller);
}

/** Use the mode's actual winning metric and keep equal results in their order. */
export function sortFlightResults(players, mode) {
  return [...players].sort((left, right) => {
    if (mode === 'freestyle') {
      const leftScore = Number.isFinite(left.score) ? left.score : 0;
      const rightScore = Number.isFinite(right.score) ? right.score : 0;
      return rightScore - leftScore;
    }
    const leftTime = Number.isFinite(left.finishMs) ? left.finishMs : Infinity;
    const rightTime = Number.isFinite(right.finishMs) ? right.finishMs : Infinity;
    return leftTime === rightTime ? 0 : leftTime - rightTime;
  });
}

const ACTIVITY_LABELS = {
  training: 'Free flight',
  race: 'Race',
  time: 'Time trial',
  freestyle: 'Freestyle',
  career: 'Career mission',
  weekly: 'Weekly challenge',
  precision: 'Precision run',
  cup: 'Championship',
  multiplayer: 'Multiplayer',
  tutorial: 'Lesson'
};

export function flightActivityLabel(mode) {
  if (Object.hasOwn(ACTIVITY_LABELS, mode)) return ACTIVITY_LABELS[mode];
  const label = String(mode || 'flight').replace(/[-_]+/g, ' ').trim().toLowerCase();
  return label ? label[0].toUpperCase() + label.slice(1) : 'Flight';
}
