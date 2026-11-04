import { Fn, uv, uniform, vec2, vec3, vec4, float, Loop, rtt } from 'three/tsl';
import { Vector2, Color } from 'three';
export function sunShafts(depth) {
  const position=uniform(new Vector2(0.5,0.5)), strength=uniform(0), tint=uniform(new Color('#fff0cb')), aspect=uniform(1);
  const node=Fn(()=>{
    const pixel=uv(), step=position.sub(pixel).mul(1/48), sample=pixel.toVar(), light=float(0).toVar(),decay=float(1).toVar();
    Loop(48,()=>{
      sample.addAssign(step);
      const distance=sample.sub(position).mul(vec2(aspect,1)).length();
      const disc=distance.div(0.045).pow(2).negate().exp();
      const visible=depth.sample(sample.clamp(0,1)).r.greaterThanEqual(0.99995).select(1,0);
      light.addAssign(disc.mul(visible).mul(decay));decay.mulAssign(0.985);
    });
    return vec4(vec3(tint).mul(light.div(48).mul(strength)),1);
  })();
  return {texture:rtt(node,1,1),position,strength,tint,aspect};
}
