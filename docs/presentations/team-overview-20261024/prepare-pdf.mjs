import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decks,shots } from './decks.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const dir=path.join(root,'tmp/pdfs/parvoz-team');
await fs.mkdir(dir,{recursive:true});
await fs.writeFile(path.join(dir,'decks.json'),JSON.stringify({decks,shots},null,2));
console.log('Prepared PDF content for two nine-slide decks.');
