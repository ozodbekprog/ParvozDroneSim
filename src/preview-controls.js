// Appearance updates reuse the same stage. Bind its gestures only once.
const boundStages = new WeakSet();
export function bindPreviewControls(stage, world) {
  if (!stage || boundStages.has(stage)) return;
  boundStages.add(stage);
  let pointerId = null, lastX = 0, lastY = 0;
  stage.addEventListener('pointerdown', event => {
    if (event.button !== 0 || pointerId !== null) return;
    pointerId = event.pointerId; lastX = event.clientX; lastY = event.clientY;
    stage.setPointerCapture(pointerId);
  });
  stage.addEventListener('pointermove', event => {
    if (event.pointerId !== pointerId || !stage.hasPointerCapture(pointerId)) return;
    world.orbitHangarPreview(event.clientX - lastX, event.clientY - lastY);
    lastX = event.clientX; lastY = event.clientY;
  });
  const release = event => {
    if (event.pointerId !== pointerId) return;
    pointerId = null;
    if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
  };
  stage.addEventListener('pointerup', release);
  stage.addEventListener('pointercancel', release);
  stage.addEventListener('lostpointercapture', event => { if (event.pointerId === pointerId) pointerId = null; });
  stage.addEventListener('wheel', event => {
    event.preventDefault();
    const units = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? stage.clientHeight : 1;
    world.zoomHangarPreview(event.deltaY * units);
  }, { passive: false });
}
