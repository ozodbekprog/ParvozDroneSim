/** Arrange actual, unretouched 1280x720 game captures for the style decision. */
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
const folder='content/review/kestrel/screenshots';
const labels=['01 · Действующая промзона','02 · Изношенный двор','03 · Тёплый вечер'];
const columns=['clean','worn','evening'], tileWidth=640, tileHeight=360, header=52;
const layers=[];
for(const [i,key] of columns.entries()){
  const label=Buffer.from(`<svg width="640" height="52"><rect width="640" height="52" fill="#10171b"/><text x="18" y="34" fill="#edf0ec" font-family="Arial" font-size="24">${labels[i]}</text></svg>`);
  layers.push({input:label,left:i*tileWidth,top:0});
  for(const [row,shot] of ['yard','drone'].entries()){
    const image=sharp(`${folder}/${key}-${shot}-low.png`), meta=await image.metadata();
    if(meta.width!==1280||meta.height!==720)throw new Error('Capture is not a real 720p framebuffer');
    layers.push({input:await image.resize(tileWidth,tileHeight).png().toBuffer(),left:i*tileWidth,top:header+row*tileHeight});
  }
}
await sharp({create:{width:tileWidth*3,height:header+tileHeight*2,channels:3,background:'#10171b'}}).composite(layers).png().toFile(`${folder}/comparison-low.png`);
writeFileSync(`${folder}/comparison.json`,JSON.stringify({resolution:[1280,720],backend:'WebGPU',graphics:'Low',adaptiveResolution:false,drone:'husky-kestrel-review-low',droneTriangles:10363,columns:columns.map((look,i)=>({look,label:labels[i],yard:`${look}-yard-low.png`,drone:`${look}-drone-low.png`}))},null,2)+'\n');
console.log(`${folder}/comparison-low.png`);
