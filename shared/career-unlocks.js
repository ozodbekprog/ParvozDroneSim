export function careerUnlockSatisfied(unlock, completed, activeMissions) {
  if(!unlock?.startsWith('career-'))return false;
  const required=Number(unlock.slice(7));
  // Archiving a map must not make a formerly reachable drone impossible to unlock.
  const target=activeMissions>0?Math.min(required,activeMissions):required;
  return Number.isFinite(target)&&completed>=target;
}
