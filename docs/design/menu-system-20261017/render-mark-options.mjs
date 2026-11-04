// Original editable vector concepts; this board is a design preview, not game footage.
import fs from 'node:fs/promises';
import sharp from 'sharp';
const folder=new URL('./',import.meta.url);
const body=async name=>(await fs.readFile(new URL(name,folder),'utf8')).replace(/^<svg[^>]*>/,'').replace('</svg>','');
const a=await body('mark-a.svg'),b=await body('mark-b.svg');
const panel=(x,title,subtitle,mark)=>`<g transform="translate(${x},88)">
<rect width="520" height="500" rx="6" fill="#23262b" stroke="#41464e"/>
<text x="28" y="40" font-size="17" fill="#adb1b7">${title}</text>
<g transform="translate(180,94) scale(1.25)">${mark}</g>
<text x="260" y="316" text-anchor="middle" font-size="32" font-weight="600" letter-spacing="3" fill="#f0f1f1">PARVOZ</text>
<text x="260" y="352" text-anchor="middle" font-size="17" fill="#adb1b7">${subtitle}</text>
<line x1="28" y1="390" x2="492" y2="390" stroke="#41464e"/>
<g transform="translate(28,416) scale(.25)">${mark}</g>
<text x="78" y="440" font-size="21" font-weight="600" fill="#f0f1f1">PARVOZ</text>
<g transform="translate(390,410) scale(.375)">${mark}</g>
</g>`;
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="640" viewBox="0 0 1200 640"><rect width="1200" height="640" fill="#181b20"/><g font-family="Segoe UI,Arial,sans-serif"><text x="56" y="48" font-size="24" fill="#f0f1f1">PARVOZ · Icon concepts</text>${panel(56,'A · FRAME','Abstract quadcopter frame',a)}${panel(624,'B · ROTOR','Three-blade propeller',b)}</g></svg>`;
await fs.writeFile(new URL('mark-options.svg',folder),svg);
await sharp(Buffer.from(svg)).png().toFile(new URL('mark-options.png',folder).pathname.replace(/^\/(\w:)/,'$1'));
