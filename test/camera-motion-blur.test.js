import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Vector3 } from 'three';
import { CameraMotionHistory } from '../src/camera-motion-blur.js';
function camera() {
  const camera = new PerspectiveCamera(100, 16 / 9, 0.02, 700);
  camera.position.set(0, 3, -8); camera.lookAt(0, 3, 10); camera.updateMatrixWorld(true);
  return camera;
}
test('stationary camera has zero reprojection motion for trees at distinct positions', () => {
  const view = camera(), history = new CameraMotionHistory();
  assert.equal(history.update(view, 0), 0); assert(history.update(view, 1000 / 60) > 0);
  for (const point of [new Vector3(-5, 8, 20), new Vector3(7, 11, 45), new Vector3(0, 0, 5)]) {
    const previousNdc = point.clone().applyMatrix4(view.matrixWorldInverse).applyMatrix4(history.previousClipFromView);
    assert(previousNdc.distanceTo(point.clone().project(view)) < 1e-10);
  }
});
test('camera motion reprojects surface points to their actual previous screen position', () => {
  const view = camera(), history = new CameraMotionHistory(), point = new Vector3(7, 8, 24);
  const previousNdc = point.clone().project(view);
  history.update(view, 0); view.position.x += 0.3; view.rotation.y -= 0.025;
  assert(history.update(view, 1000 / 60) > 0);
  const reprojected = point.clone().applyMatrix4(view.matrixWorldInverse).applyMatrix4(history.previousClipFromView);
  assert(reprojected.distanceTo(previousNdc) < 1e-10);
  assert(reprojected.distanceTo(point.clone().project(view)) > 0.01);
});
test('pause, reset, FOV changes and invalid frame intervals clear motion history', () => {
  const view = camera(), history = new CameraMotionHistory();
  history.update(view, 0); assert.equal(history.update(view, 1000), 0);
  view.position.x += 10; assert.equal(history.update(view, 1016), 0);
  view.fov = 85; view.updateProjectionMatrix(); assert.equal(history.update(view, 1032), 0);
  view.rotation.y += 1; assert.equal(history.update(view, 1048), 0);
  assert.equal(history.update(view, 1048), 0); assert.equal(history.update(view, 1040), 0);
  assert(history.update(view, 1056) > 0);
});
