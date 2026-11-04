import { SRGBColorSpace, NoColorSpace, DoubleSide, FrontSide } from 'three';
import { loadTexture } from './asset-loader.js';
export function applyMaterials(root, overrides = []) {
  if (!overrides?.length) {
    let index = 0;
    root.traverse(mesh => {
      if (!mesh.isMesh) return;
      mesh.name ||= `mesh-${index}`; index++;
      for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        if (mat?.userData?.singlePassThinSurface) mat.forceSinglePass = true;
      }
    });
    return Promise.resolve([]);
  }
  const jobs = [];
  let index = 0;
  root.traverse(mesh => {
    if (!mesh.isMesh) return;
    mesh.name ||= `mesh-${index}`; index++;
    const apply = original => {
      // Flat imported overlays render both faces in one transparent pass.
      // Their asset metadata opts in; solid transparent models keep two passes.
      if(original.userData?.singlePassThinSurface)original.forceSinglePass=true;
      const candidates = overrides.filter(item => item.mesh === mesh.name || item.mesh === '*').sort((a,b) => Number(b.mesh === mesh.name) - Number(a.mesh === mesh.name));
      const value = candidates.find(item => item.material === original.name) || candidates.find(item => !item.material);
      if (!value) return original;
      const material = original.clone();
      if (value.baseColor) material.color?.set(value.baseColor);
      for (const key of ['roughness','metalness']) if (value[key] !== undefined) material[key]=value[key];
      for (const [key,slot] of [['baseTexture','map'],['normalTexture','normalMap'],['roughnessTexture','roughnessMap'],['metalnessTexture','metalnessMap'],['occlusionTexture','aoMap'],['emissiveTexture','emissiveMap']]) if(value[key]) {
        const texture=loadTexture(value[key]); jobs.push(texture.assetsReady); texture.flipY=false;
        texture.colorSpace = ['baseTexture','emissiveTexture'].includes(key) ? SRGBColorSpace : NoColorSpace;
        material[slot]=texture;
      }
      if (value.emissiveColor) material.emissive?.set(value.emissiveColor);
      if (value.emissiveIntensity !== undefined) material.emissiveIntensity = value.emissiveIntensity;
      if (value.normalScale) material.normalScale?.set(...value.normalScale);
      if (value.doubleSided !== undefined) material.side = value.doubleSided ? DoubleSide : FrontSide;
      if (value.opacity !== undefined) material.opacity = value.opacity;
      if (value.alphaMode) {
        material.transparent = value.alphaMode === 'BLEND';
        material.depthWrite = value.alphaMode !== 'BLEND';
        material.alphaTest = value.alphaMode === 'MASK' ? value.alphaCutoff ?? .5 : 0;
      }
      material.needsUpdate = true; return material;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(apply) : apply(mesh.material);
  });
  return Promise.all(jobs);
}

export function applyDroneColors(root, build) {
  const bindings = build.colorBindings || {};
  root.traverse(mesh => {
    if (!mesh.isMesh) return;
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (bindings.body?.includes(mesh.name)) material.color?.set(build.color);
      if (bindings.led?.includes(mesh.name)) { material.color?.set(build.led); material.emissive?.set(build.led); material.emissiveIntensity=Math.max(material.emissiveIntensity || 0,1); }
    }
  });
}
