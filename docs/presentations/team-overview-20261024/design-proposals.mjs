// Run buildProposals(presentation) inside an Artifact Session callback.
// These alternatives deliberately reuse the same real frame for comparison.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const C = { bg:'#151D27', white:'#EDF2F6', muted:'#AAB7C5', peach:'#FFAE70', cyan:'#78D8DF' };
function text(slide, value, x,y,w,h,size,color,bold=false) {
  const shape=slide.shapes.add({geometry:'textbox',position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});
  shape.text=value;
  shape.text.insets=0;
  shape.text.style={fontFamily:'Arial',fontSize:size,color,bold};
  return shape;
}
function image(slide,bytes,x,y,w,h) {
  slide.images.add({blob:bytes,contentType:'image/jpeg',fit:'cover',alt:'Реальный кадр Parvoz: карта The Green, Ultra. Импортированный тестовый контент Liftoff.',position:{left:x,top:y,width:w,height:h}});
}
export async function buildProposals(presentation) {
  presentation.slides.keep([]);
  const bytes=new Uint8Array(await fs.readFile(path.join(root,'src/assets/loading/the-green.jpg')));
  const notes='Design proposal only, pending user choice. Catalog verified 2026-10-24: 5 maps, 30 routes, 12 lessons. Image: src/assets/loading/the-green.jpg, actual game capture; metadata in captures.json. Liftoff: FPV Drone Racing, LuGus Studios and credited providers. Existing online-test authorization does not establish redistribution permission. Internal team review, no investment request.';
  let s=presentation.slides.add({width:1280,height:720,background:{fill:C.bg}});
  image(s,bytes,566,0,714,650);
  text(s,'PARVOZ',48,36,460,40,24,C.peach,true);
  text(s,'Полёт, обучение\nи соревнования',48,133,510,136,47,C.white,true);
  text(s,'FPV-симулятор в браузере\nдля первых тренировок\nи совместных заездов.',48,292,478,110,25,C.muted);
  for(const [i,num,label] of [[0,'5','карт'],[1,'30','маршрутов'],[2,'12','уроков']]){
    text(s,num,48+i*162,466,152,70,56,C.cyan,true);
    text(s,label,48+i*162,538,152,36,21,C.white);
  }
  text(s,'Кадр игры: The Green, Ultra. Тестовый контент Liftoff.',48,669,1150,27,15,C.muted);
  s.speakerNotes.text=notes;

  s=presentation.slides.add({width:1280,height:720,background:{fill:'#F4F2EB'}});
  text(s,'PARVOZ',48,31,1170,34,23,'#53675C',true);
  text(s,'Полёт, обучение и соревнования',48,95,1180,70,47,'#172B24',true);
  image(s,bytes,48,202,740,416);
  text(s,'FPV-симулятор в браузере',830,202,402,42,26,'#172B24',true);
  text(s,'Первые тренировки\nи совместные заезды.',830,256,402,75,24,'#50645A');
  for(const [i,num,label] of [[0,'5','карт'],[1,'30','маршрутов'],[2,'12','уроков']]){
    text(s,num,830,355+i*84,100,65,45,'#2C6855',true);
    text(s,label,945,370+i*84,287,45,23,'#172B24');
  }
  text(s,'Кадр игры: The Green, Ultra. Тестовый контент Liftoff.',48,659,1150,29,16,'#50645A');
  s.speakerNotes.text=notes;

  s=presentation.slides.add({width:1280,height:720,background:{fill:'#0A1117'}});
  image(s,bytes,0,0,1280,457);
  text(s,'PARVOZ',44,481,400,35,23,C.peach,true);
  text(s,'Полёт, обучение\nи соревнования',44,537,766,120,48,C.white,true);
  text(s,'5 карт',882,507,350,45,31,C.white,true);
  text(s,'30 маршрутов',882,559,350,45,31,C.white,true);
  text(s,'12 уроков',882,611,350,45,31,C.white,true);
  text(s,'Кадр игры: The Green, Ultra. Тестовый контент Liftoff.',44,683,1150,24,14,C.muted);
  s.speakerNotes.text=notes;
}
