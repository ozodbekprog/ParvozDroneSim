/** Explicit pixel dimensions are for repeatable acceptance runs, independent of OS scaling. */
export function renderPixelRatio(width, height, settings, devicePixelRatio = 1, adaptiveScale = 1) {
  if (settings.fixedResolution) return Math.min(settings.fixedResolution[0] / width, settings.fixedResolution[1] / height);
  return Math.min(devicePixelRatio || 1, 1.25) * settings.resolution * adaptiveScale;
}
