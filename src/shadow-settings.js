// In Three r180, resizing an allocated shadow target can leave scene bind
// groups sampling its destroyed textures. A fresh light/shadow identity makes
// the renderer rebuild those bindings while preserving the lighting setup.
export function setSunShadowSize(scene, light, size) {
  if (!light || (light.shadow.mapSize.x === size && light.shadow.mapSize.y === size)) return light;
  if (!light.shadow.map) {
    light.shadow.mapSize.setScalar(size);
    light.shadow.needsUpdate = true;
    return light;
  }
  const replacement = light.clone();
  replacement.shadow.mapSize.setScalar(size);
  replacement.shadow.needsUpdate = true;
  scene.add(replacement);
  scene.add(replacement.target);
  scene.remove(light);
  if(light.target.parent === scene) scene.remove(light.target);
  light.shadow.dispose();
  return replacement;
}
