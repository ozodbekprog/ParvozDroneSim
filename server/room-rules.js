export const ROOM_MODES = ['race', 'precision', 'freestyle', 'cup'];
export const CUP_PLACEMENT_POINTS = [10, 6, 4, 3, 2, 1, 1, 1];

export function normalizeRoomOptions(value = {}) {
  const requested = Number(value.maxPlayers);
  return {
    visibility: value.visibility === 'public' ? 'public' : 'private',
    maxPlayers: Number.isInteger(requested) ? Math.max(2, Math.min(8, requested)) : 8,
    mode: ROOM_MODES.includes(value.mode) ? value.mode : 'race'
  };
}

export function sanitizeChat(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180);
}

export function cupCourses(maps, firstMap, firstTrack) {
  const start = Math.max(0, maps.findIndex(map => map.id === firstMap));
  return Array.from({ length: 3 }, (_, index) => {
    const map = maps[(start + index) % maps.length];
    return { map: map.id, track: index === 0 && map.id === firstMap ? firstTrack : map.tracks[0].id };
  });
}

export function cupRoundPoints(items) {
  return [...items]
    .filter(item => item.finishMs !== null)
    .sort((a, b) => a.finishMs - b.finishMs)
    .map((item, place) => ({ id: item.player.id, points: CUP_PLACEMENT_POINTS[place] || 1, timeMs: item.finishMs }));
}

export function cupStandings(scores, participantIds) {
  const current = new Set(participantIds);
  return [...scores.entries()].filter(([id]) => current.has(id))
    .map(([id, entry]) => ({ id, ...entry }))
    .sort((a, b) => b.points - a.points || b.finishes - a.finishes || a.totalMs - b.totalMs || String(a.id).localeCompare(String(b.id)));
}

export function publicRoomListing(rooms) {
  return [...rooms].filter(room => room.visibility === 'public').map(room => ({
    code: room.code, map: room.map.id, track: room.track.id, mode: room.mode,
    players: room.players.size, maxPlayers: room.maxPlayers, status: room.status,
    joinable: room.status === 'lobby' && room.players.size < room.maxPlayers && !(room.cupRound > 0)
  }));
}
