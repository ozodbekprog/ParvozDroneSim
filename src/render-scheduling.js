/** The loading gallery covers 3D; keep decode/upload time free of redundant draws. */
export function sceneRenderDue(now,lastRender,{loading=false,menu=false}={}){
 if(loading)return false;
 return !menu||now-lastRender>=1000/24;
}
