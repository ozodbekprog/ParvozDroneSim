/** Explicit QA controls export the actual full framebuffer, independent of the
 * browser viewport. No scene state needs to be read from browser automation. */
export function installCaptureControls(world,{scenario,quality,hardware,pause=()=>{}}){
 const panel=document.createElement('section');panel.className='capture-controls';
 panel.innerHTML='<label>Capture angle <select id="capture-angle"><option value="overview">Course overview</option><option value="gate">First gate</option><option value="reverse">Reverse course</option><option value="course">Facing the course gate</option></select></label> <label>Capture size <select id="capture-size"><option value="720">1280 × 720</option><option value="1080">1920 × 1080</option></select></label> <button id="frame-shot">Frame scene</button> <button id="export-shot">Export rendered frame</button><output id="capture-status"></output><a id="shot-download" hidden>Download frame</a><output id="shot-metadata"></output><img id="export-image" alt="Rendered game framebuffer" hidden>';
 document.querySelector('nav').after(panel);
 panel.querySelector('#frame-shot').onclick=async()=>{
  const {map,track}=scenario();if(!map||!track)return;
  const angle=panel.querySelector('#capture-angle').value,gate=track.gates[angle==='reverse'?Math.min(2,track.gates.length-1):0];
  const target=gate?.position||track.spawn.position;
  const normal=gate?.axes?.normal||[Math.sin(gate?.yaw||0),0,Math.cos(gate?.yaw||0)];
  const indoor=map.indoor===true,distance=indoor?4:10,height=indoor?.1:2;
  const offset=angle==='course'?normal.map((v,i)=>-v*distance+(i===1?height:0)):angle==='overview'?(indoor?[-3,.2,-4]:[-16,9,-18]):angle==='reverse'?(indoor?[3,.2,4]:[10,4,12]):indoor?[-2,.1,-3]:[-6,3,-9];
  pause();const changed=world.presentation!=='flight';world.hangarPreview=false;world.menuScene=null;world.activeDroneId=null;world.presentation='flight';world.setCameraMode('fpv');world.setFov(72);
  world.inspectionCamera={position:target.map((v,i)=>v+offset[i]),target:[...target]};if(changed)world.rebuildPost();
  const full=panel.querySelector('#capture-size').value==='1080';world.setGraphics({...world.graphics,fixedResolution:full?[1920,1080]:[1280,720],adaptiveResolution:false});
  const status=panel.querySelector('#capture-status'),exportButton=panel.querySelector('#export-shot');status.textContent='Preparing capture';exportButton.disabled=true;
  try{await world.prepareGraphics();status.textContent='Capture ready';}catch(error){status.textContent=error.message;}finally{exportButton.disabled=false;}
 };
 panel.querySelector('#export-shot').onclick=()=>{
  const {map,track}=scenario();if(!map||!track)return;
  world.render(performance.now());const image=world.renderer.domElement.toDataURL('image/jpeg',.93);
  const info={map:map.id,track:track.id,quality:quality(),angle:panel.querySelector('#capture-angle').value,hardware,
   backend:world.renderer.backend?.isWebGLBackend?'WebGL2':'WebGPU',framebuffer:[world.renderer.domElement.width,world.renderer.domElement.height],
   adaptiveResolution:false,position:world.camera.position.toArray(),quaternion:world.camera.quaternion.toArray(),fov:world.camera.fov,capturedAt:new Date().toISOString()};
  const preview=panel.querySelector('#export-image');preview.src=image;preview.hidden=false;
  const link=panel.querySelector('#shot-download');link.href=image;link.download=map.id+'-'+info.angle+'-'+info.quality+'.jpg';link.hidden=false;
  panel.querySelector('#shot-metadata').textContent=JSON.stringify(info,null,2);
 };
 return panel;
}
