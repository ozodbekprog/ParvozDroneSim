/** Keep watching an unfinished pilot across snapshots, finishes and departures. */
export function spectatorPilotId(players, ownId, watchedId, renderedIds, cycle = false) {
  const rendered = new Set(renderedIds);
  const candidates = players.filter(player => player.id !== ownId && player.finishMs == null && rendered.has(player.id));
  if (!candidates.length) return null;
  const index = candidates.findIndex(player => player.id === watchedId);
  if (index < 0) return candidates[0].id;
  return candidates[cycle ? (index + 1) % candidates.length : index].id;
}
