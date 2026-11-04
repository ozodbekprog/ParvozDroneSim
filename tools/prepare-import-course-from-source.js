import {readFileSync,writeFileSync} from 'node:fs';
import {profile,recoveryFolder} from './content-import-profile.js';
const source=JSON.parse(readFileSync('content/races/'+profile.course.id+'/race.json','utf8'));
if(source.map!==profile.id||!source.objects?.length||source.gates.some(g=>g.frameSource!=='track'))throw new Error('Finish authored course props before packaging');
writeFileSync(recoveryFolder+'race.json',JSON.stringify(source,null,2)+'\n');
console.log('Original source course selected:',source.id);
