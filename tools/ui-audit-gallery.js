// Build an honest gallery of actual captures; rejected frames remain explicitly listed.
import {readFileSync,readdirSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const root='docs/design/ui-audit-20261014';
const rejected={
 'multiplayer-hud-before-css-fix.jpg':'Diagnostic evidence of inactive overlay styles before the verified fix; not current UI acceptance.',
 '03-race-setup.jpg':'Shows the preceding Free Flight setup.',
 '06-drone-selection.jpg':'Workshop and aircraft have not finished loading.',
 '07-luma-selection.jpg':'Workshop and aircraft have not finished loading.',
 '08-workbench-parts.jpg':'Aircraft has not finished loading.',
 '09-workbench-motors.jpg':'Aircraft has not finished loading.',
 '10-workbench-battery.jpg':'Aircraft has not finished loading.',
 '11-workbench-appearance.jpg':'Aircraft has not finished loading.',
 '12-workbench-tuning.jpg':'Tuning controls are visible, but the aircraft preview is unfinished.',
 '13-flight-performance.jpg':'Shows Tuning, not the performance dialog.',
 '16-settings-graphics.jpg':'Shows Camera, not Graphics.',
 '17-career.jpg':'Shows the preceding main menu.',
 '33-preparing-multiplayer.jpg':'Cropped 1920×755 lobby; not Preparing flight.',
 '39-solo-loading.jpg':'Shows the following flight HUD, not the loader.',
 '42-flight-results.jpg':'Cropped 1920×755; full results retake required.',
};
const previous=existsSync(root+'/manifest.json')?JSON.parse(readFileSync(root+'/manifest.json')).entries:[];
const entries=previous.filter(entry=>!entry.accepted&&!existsSync(root+'/'+entry.file)).map(entry=>({...entry,available:false}));
for(const folder of ['screenshots','after'])for(const name of readdirSync(root+'/'+folder).filter(n=>n.endsWith('.jpg')).sort()){
 const file=folder+'/'+name,bytes=readFileSync(root+'/'+file),meta=await sharp(bytes).metadata();
 const reason=rejected[name] || (meta.width!==1920||meta.height!==1080?'Capture is not 1920×1080.':null);
 entries.push({file,width:meta.width,height:meta.height,sha256:createHash('sha256').update(bytes).digest('hex'),accepted:!reason,available:true,reason,source:folder==='screenshots'?'Production baseline, protocol 9':name.startsWith('public-')?'Published 20261015-native-01, protocol 10':name.includes('fixture')?'Exact client with a controlled local network fixture, protocol 10':'Local candidate, protocol 10'});
}
const coverage=JSON.parse(readFileSync(root+'/coverage.json'));
for(const files of Object.values(coverage.groups))for(const file of files)if(!entries.some(e=>e.file===file&&e.accepted))throw Error('Coverage lacks accepted evidence: '+file);
const manifest={date:coverage.reviewedAt,status:coverage.status,windowsScale:'150% unchanged',requiredSize:[1920,1080],coverageFile:'coverage.json',entries};
writeFileSync(root+'/manifest.json',JSON.stringify(manifest,null,2)+'\n');
const esc=v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Parvoz UI evidence</title><style>body{margin:0;background:#10151d;color:#e8eef5;font:16px/1.55 system-ui}main{max-width:1400px;margin:auto;padding:32px}a{color:#f6b66e}p{max-width:900px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:22px}figure{margin:0;background:#1a2633;border-radius:10px;overflow:hidden}img{width:100%;display:block}figcaption{padding:14px;font-size:14px}small{color:#b4c5d6}.rejected{padding:20px;background:#291f24;border-radius:10px}h2{margin-top:40px}@media(max-width:520px){.grid{grid-template-columns:1fr}main{padding:16px}}</style><main><h1>Parvoz: actual UI evidence</h1><p><strong>Primary screen review completed with documented exclusions.</strong> Accepted frames show the settled intended state at 1920×1080. Rejected captures are listed below and do not count as verification. Windows scale remained 150%.</p><p><a href="README.md">Design / UX / player audit</a> · <a href="manifest.json">Dimensions and SHA-256 manifest</a> · <a href="coverage.json">Screen coverage and exclusions</a></p>${['screenshots','after'].map(folder=>`<h2>${folder==='screenshots'?'Production baseline':'Candidate and published release'}</h2><div class="grid">${entries.filter(e=>e.accepted&&e.file.startsWith(folder+'/')).map(e=>`<figure><a href="${esc(e.file)}"><img src="${esc(e.file)}" loading="lazy" alt="${esc(e.file)}"></a><figcaption>${esc(e.file)}<br><small>${esc(e.source)} · ${e.width}×${e.height}</small></figcaption></figure>`).join('')}</div>`).join('')}<h2>Rejected historical captures and diagnostics</h2>${entries.filter(e=>!e.accepted).map(e=>`<p class="rejected"><strong>${esc(e.file)}</strong><br>${esc(e.reason)}</p>`).join('')}</main></html>`;
writeFileSync(root+'/gallery.html',html);console.log(JSON.stringify({accepted:entries.filter(e=>e.accepted).length,rejected:entries.filter(e=>!e.accepted).length,status:manifest.status}));
