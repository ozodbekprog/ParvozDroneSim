import { Matrix4, Vector2, Vector3 } from 'three';
import { Fn, Loop, float, getViewPosition, uniform, uv, vec2, vec4 } from 'three/tsl';

// Camera reprojection uses the rendered surface depth, including instanced and
// imported geometry. No velocity MRT or per-instance previous-position shader
// is required, and toggling blur never changes the scene's attachment layout.
export class CameraMotionHistory {
  constructor() {
    this.previousViewProjection = new Matrix4();
    this.previousProjection = new Matrix4();
    this.previousPosition = new Vector3();
    this.previousRotation = null;
    this.previousTime = null;
    this.previousClipFromView = new Matrix4();
  }

  update(camera, now) {
    camera.updateMatrixWorld(true);
    const elapsed = this.previousTime === null ? 0 : (now - this.previousTime) / 1000;
    const continuous = elapsed > 0 && elapsed <= 0.075
      && camera.projectionMatrix.equals(this.previousProjection)
      && camera.position.distanceTo(this.previousPosition) < 3
      && camera.quaternion.angleTo(this.previousRotation) < 0.5;
    if (!continuous) this.previousViewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.previousClipFromView.multiplyMatrices(this.previousViewProjection, camera.matrixWorld);
    this.previousViewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.previousProjection.copy(camera.projectionMatrix);
    this.previousPosition.copy(camera.position);
    this.previousRotation = camera.quaternion.clone();
    this.previousTime = now;
    // Eight milliseconds of shutter, capped at one frame; reset/resize/long
    // pause frames have no blur history instead of smearing the whole scene.
    return continuous ? Math.min(1, (1 / 120) / elapsed) : 0;
  }
}

export function cameraMotionBlur(color, depth, camera) {
  const history = new CameraMotionHistory();
  const inverseProjection = uniform(new Matrix4());
  const previousClipFromView = uniform(new Matrix4());
  const shutter = uniform(0), maxOffset = uniform(new Vector2());
  const node = Fn(() => {
    const pixel = uv(), centerDepth = depth.sample(pixel).r;
    const view = getViewPosition(pixel, centerDepth, inverseProjection);
    const previousClip = previousClipFromView.mul(vec4(view, 1));
    const previousNdc = previousClip.xy.div(previousClip.w.abs().max(0.00001));
    const previousUv = vec2(previousNdc.x.mul(0.5).add(0.5), previousNdc.y.mul(-0.5).add(0.5));
    const valid = centerDepth.lessThan(0.999999).and(previousClip.w.greaterThan(0)).select(shutter, 0);
    const offset = previousUv.sub(pixel).mul(valid).clamp(maxOffset.negate(), maxOffset);
    const result = color.sample(pixel).toVar(), weight = float(1).toVar();
    Loop(7, ({ i }) => {
      const sampleUv = pixel.add(offset.mul(float(i).add(1).div(7))).clamp(0, 1);
      const sampleView = getViewPosition(sampleUv, depth.sample(sampleUv).r, inverseProjection);
      // Reject samples across silhouettes, rather than blending sky or ground
      // through the tree in front. Always preserve an opaque output alpha.
      const sameSurface = sampleView.z.sub(view.z).abs().lessThan(view.z.abs().mul(0.08).max(0.08)).select(1, 0);
      result.addAssign(color.sample(sampleUv).mul(sameSurface)); weight.addAssign(sameSurface);
    });
    return vec4(result.rgb.div(weight), 1);
  })();
  return {
    node,
    update(now, width, height) {
      shutter.value = history.update(camera, now);
      inverseProjection.value.copy(camera.projectionMatrixInverse);
      previousClipFromView.value.copy(history.previousClipFromView);
      maxOffset.value.set(24 / Math.max(1, width), 24 / Math.max(1, height));
    }
  };
}
