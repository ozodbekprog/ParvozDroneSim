// Read-only image comparison. Does not transform or write any image assets.
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import sharp from 'sharp';

const root=dirname(fileURLToPath(import.meta.url));
const area={left:500,top:300,width:1000,height:620};
const files=['prototype/assets/hangar.png','evidence/current-workbench-1920.png',...['01','02','03'].map(n=>`previews/${n}.png`)];
const inventory=[];
for(const file of files){
  const bytes=await fs.readFile(join(root,file));
  const meta=await sharp(bytes).metadata();
  assert.equal(meta.width,1920,`${file}: width`);
  assert.equal(meta.height,1080,`${file}: height`);
  inventory.push({file,width:meta.width,height:meta.height,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
}
const source=await sharp(join(root,files[0])).extract(area).removeAlpha().raw().toBuffer();
const proof=[];
for(const file of files.filter(name=>name.startsWith('previews/'))){
  const pixels=await sharp(join(root,file)).extract(area).removeAlpha().raw().toBuffer();
  let changed=0;
  for(let i=0;i<source.length;i+=3)if(source[i]!==pixels[i]||source[i+1]!==pixels[i+1]||source[i+2]!==pixels[i+2])changed++;
  proof.push({file,width:1920,height:1080,area,changedPixels:changed,totalPixels:area.width*area.height});
  assert.equal(changed,0,`${file}: source background changed`);
}
await fs.writeFile(join(root,'background-proof.json'),JSON.stringify(proof,null,2)+'\n');
await fs.writeFile(join(root,'image-inventory.json'),JSON.stringify(inventory,null,2)+'\n');
const manifest=JSON.parse(await fs.readFile(join(root,'prototype/package.json'),'utf8'));
assert.equal(manifest.dependencies['@awesome.me/webawesome'],'3.14.0');
const html=await fs.readFile(join(root,'prototype/index.html'),'utf8');
assert.equal((html.match(/class="backdrop"/g)||[]).length,1);
console.log(JSON.stringify({images:inventory.length,backgroundPixelsPerVariant:area.width*area.height,changedPixels:proof.map(row=>row.changedPixels),componentVersion:manifest.dependencies['@awesome.me/webawesome']}));
