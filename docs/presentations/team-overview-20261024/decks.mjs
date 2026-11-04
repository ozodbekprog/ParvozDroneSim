import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const shots={
 green:'src/assets/loading/the-green.jpg',
 pine:'src/assets/loading/pine-valley.jpg',
 minus:'src/assets/loading/minus-two.jpg',
 tuning:'docs/design/ui-polish-20261015/04-workbench-tuning.png',
 drone:'docs/design/native-customization-20261019/browser/chameleon-fatshark-saved.png',
 lobby:'docs/design/ui-audit-20261014/after/multiplayer-lobby-two-pilots.jpg',
 lessons:'docs/design/ui-performance-20261018/09-ru-lessons.jpg',
 controls:'docs/design/ui-polish-20261015/05-settings-controls.png',
};
const game='https://parvoz-drone-sim.duckdns.org/';
const market=[
 ['Liftoff в Steam','https://store.steampowered.com/app/410340/Liftoff_FPV_Drone_Racing/'],
 ['VelociDrone','https://www.velocidrone.com/shop'],
 ['Flight Division','https://flightdivision.com/'],
];
export const decks={
 features:{filename:'Parvoz-01-Game-Features.pdf',label:'Возможности игры',slides:[
  {title:'Parvoz: полёт в браузере',image:'green',points:[
   'В игре можно летать от первого лица, тренироваться и соревноваться с друзьями.',
   'Доступны пять карт, тридцать маршрутов и пять базовых моделей дронов.',
   'Настройки управления, мастерская и двенадцать уроков помогают подобрать собственный стиль полёта.'
  ],caption:'The Green. Реальный кадр игры, качество Ultra.',sources:['README.md','public/content/catalog.json']},
  {title:'Физика, на которую влияет пилот',image:'pine',points:[
   'Модель полёта учитывает тягу, инерцию, сопротивление воздуха, ветер и отклик моторов.',
   'Режимы Angle, Horizon и Acro дают разную степень помощи при управлении.',
   'После столкновения можно быстро вернуться к контрольной точке и повторить манёвр.'
  ],caption:'Pine Valley. Реальный кадр игры, качество Ultra.',note:'Точность относительно реального дрона ещё требует измерений.',sources:['README.md','docs/PHYSICS-RESEARCH.md']},
  {title:'PID и чувствительность управления',image:'tuning',points:[
   'В мастерской можно менять коэффициенты PID и проверять результат в полёте.',
   'Rates, Expo и кривая газа позволяют настроить реакцию на движения стиков.',
   'Сохранённая конфигурация дрона применяется в одиночных полётах и в сетевой игре.'
  ],caption:'Настройка Dquad Addiction. Скриншот интерфейса, 15 октября.',note:'PID игры не является готовой настройкой Betaflight для настоящего дрона.',sources:['README.md','docs/TUNING-LEARNING-PROPOSAL-20261018.md']},
  {title:'Пять дронов и собственные сборки',image:'drone',points:[
   'В ангаре доступны Kestrel, Luma, Armattan Chameleon, Armattan Gecko и Dquad Addiction.',
   'Игрок создаёт копию дрона, выбирает совместимые детали и настраивает его поведение.',
   'Сохранённые сборки зарегистрированного пилота доступны через аккаунт при входе с другого компьютера.'
  ],caption:'Armattan Chameleon. Реальная мастерская, 19 октября.',sources:['README.md','docs/NATIVE-CUSTOMIZATION-20261019.md']},
  {title:'Пять локаций для разных полётов',image:'minus',points:[
   'Minus Two, Hangar C03 и Liftoff Arena предлагают полёты среди построек и препятствий.',
   'Pine Valley и The Green добавляют природные ландшафты и открытое пространство.',
   'Тридцать маршрутов позволяют менять дистанцию, тренировать прохождение ворот и улучшать время.'
  ],caption:'Minus Two. Реальный кадр игры, качество Ultra.',note:'Локации импортированы из Liftoff для теста. Права распространения не подтверждены.',sources:['public/content/catalog.json']},
  {title:'Открытые и закрытые комнаты',image:'lobby',crop:true,points:[
   'Игрок создаёт публичную комнату или приглашает друзей в приватную комнату по коду.',
   'В одном заезде участвуют от двух до восьми пилотов на выбранной трассе.',
   'В комнате есть чат, а после финиша можно наблюдать за оставшимися участниками.'
  ],caption:'Реальное лобби с двумя тестовыми пилотами, 14 октября.',note:'Текущий серверный допуск: 20 игроков одновременно во всех комнатах.',sources:['docs/MULTIPLAYER-ROOMS.md','docs/ORACLE-DEPLOYMENT.md']},
  {title:'Соревнования и личные вызовы',facts:[['Гонка','Время прохождения'],['Точность','Штраф за сброс'],['Фристайл','Очки за манёвры'],['Чемпионат','Три заезда']],points:[
   'В сетевой игре доступны обычные гонки, заезды на точность и фристайл.',
   'Чемпионат объединяет три гонки на разных картах с общим подсчётом очков.',
   'Еженедельные испытания, рекорды и сохранение повторов дают новые цели для практики.'
  ],note:'Сохранённые для просмотра повторы хранятся в браузере игрока.',sources:['README.md','docs/MULTIPLAYER-ROOMS.md']},
  {title:'Двенадцать уроков пилотирования',image:'lessons',points:[
   'Начальные упражнения помогают освоить зависание, управление высотой, поворот и точную посадку.',
   'Затем можно тренировать широкие повороты, узкие ворота и первые манёвры в Acro.',
   'Вводные задания на каждой карте знакомят с локацией и помогают начать практику.'
  ],caption:'Лётная школа. Реальный интерфейс, 18 октября.',sources:['public/content/catalog.json','docs/LEARNING-RELEASE-20261018.md']},
  {title:'Управление под своего пилота',image:'controls',points:[
   'Можно начать с клавиатуры, подключить геймпад или совместимый USB-пульт для тренировки.',
   'Настройка осей, инверсия, калибровка и мёртвая зона помогают адаптировать устройство.',
   'Русский, узбекский и английский интерфейсы дополняются настройками камеры и качества графики.'
  ],caption:'Настройка управления. Скриншот интерфейса, 15 октября.',note:'Совместимость проверяется на конкретном пульте. Бета: '+game,link:game,sources:['README.md']}
 ]},
 overview:{filename:'Parvoz-02-Project-Overview.pdf',label:'Обзор проекта',slides:[
  {title:'Parvoz Drone Simulator',image:'green',points:[
   'Браузерный FPV-симулятор объединяет свободные полёты, обучение и совместные заезды на компьютере.',
   'Рабочая веб-бета уже позволяет познакомиться с игрой по публичной ссылке.',
   'Проект включает игровой контент, настройку дронов, аккаунты и сохранение результатов пилота.'
  ],caption:'The Green. Реальный кадр игры, качество Ultra.',note:'Веб-бета: '+game,link:game,sources:['README.md','docs/ORACLE-DEPLOYMENT.md']},
  {title:'Аудитория и польза',facts:[['Новички','Первый опыт FPV'],['Любители','Регулярная практика'],['Клубы','Совместные заезды']],points:[
   'Начинающим пилотам игра предлагает первые упражнения до покупки или запуска собственного дрона.',
   'Любителям FPV доступны повторяемые тренировки, разные трассы и настройка управления.',
   'Для клубов и учебных групп рассматриваем совместные занятия на русском и узбекском языках.'
  ],note:'Приоритетная аудитория для проверки. Спрос на Parvoz пока не измерен.',sources:['docs/PRODUCT-DIRECTION-20261023.md','docs/DEMAND-PILOTS-20261023.md']},
  {title:'Карты, маршруты и дроны',image:'pine',points:[
   'В активном каталоге пять карт: от закрытых пространств до природных локаций.',
   'Тридцать маршрутов и пять заданий предлагают разные условия для тренировок и гонок.',
   'Пять базовых дронов можно копировать, менять их настройки и выбирать совместимые детали.'
  ],caption:'Pine Valley. Реальный кадр игры, качество Ultra.',note:'Тестовый контент Liftoff. Коммерческие права на импортированные ресурсы не подтверждены.',sources:['public/content/catalog.json']},
  {title:'Режимы и игровые цели',image:'minus',points:[
   'Свободный полёт позволяет изучать локации, пробовать манёвры и выбирать собственный маршрут.',
   'Гонки, точность и фристайл предлагают разные способы соревноваться с другими пилотами.',
   'Чемпионаты, еженедельные испытания и личные рекорды добавляют цели для следующих игровых сессий.'
  ],caption:'Minus Two. Реальный кадр игры, качество Ultra.',sources:['README.md','docs/MULTIPLAYER-ROOMS.md']},
  {title:'Обучение и способы управления',image:'lessons',points:[
   'Двенадцать уроков охватывают основы пилотирования, прохождение ворот и первые шаги в Acro.',
   'Игрок выбирает клавиатуру, геймпад или совместимый USB-пульт и калибрует управление.',
   'Три языка интерфейса помогают начать практику на русском, узбекском или английском.'
  ],caption:'Лётная школа. Реальный интерфейс, 18 октября.',note:'Перенос навыков в реальный полёт требует отдельной оценки.',sources:['README.md','public/content/catalog.json']},
  {title:'Мастерская и модель полёта',image:'tuning',points:[
   'Мастерская позволяет менять совместимые детали, PID, чувствительность стиков и кривую газа.',
   'Физическая модель учитывает тягу, инерцию, сопротивление воздуха, ветер и отклик моторов.',
   'Собственные сборки сохраняются в аккаунте, а настройки влияют на поведение дрона.'
  ],caption:'Настройки Dquad Addiction. Реальный интерфейс, 15 октября.',note:'Физика ещё требует калибровки по измерениям. PID игры нельзя переносить на реальный дрон.',sources:['README.md','docs/TUNING-LEARNING-PROPOSAL-20261018.md']},
  {title:'Совместная игра и прогресс',image:'lobby',crop:true,points:[
   'Публичные комнаты и приватные приглашения по коду объединяют от двух до восьми пилотов.',
   'Чат, наблюдение после финиша и чемпионаты поддерживают совместные игровые сессии.',
   'Аккаунт сохраняет прогресс и рекорды, а просмотр сохранённых повторов доступен в браузере.'
  ],caption:'Реальное лобби с двумя тестовыми пилотами, 14 октября.',note:'Общий допуск сервера: 20 игроков. Просматриваемые повторы остаются в своём браузере.',sources:['README.md','docs/MULTIPLAYER-ROOMS.md','docs/ORACLE-DEPLOYMENT.md']},
  {title:'Рынок и место Parvoz',facts:[['Liftoff','Гонки и мастерская'],['VelociDrone','Платный симулятор'],['Flight Division','Бесплатно в браузере']],points:[
   'Liftoff и VelociDrone предлагают развитые FPV-симуляторы, поэтому конкурировать придётся качеством опыта.',
   'Flight Division уже предлагает бесплатный браузерный FPV с уроками для новичков.',
   'Гипотеза Parvoz: понятная практика и местные языки для начинающих пилотов Узбекистана.'
  ],note:'Источники: официальные страницы продуктов, проверены 24.10.2026. Спрос на Parvoz не доказан.',links:market,sources:market.map(x=>x[1])},
  {title:'Текущее состояние и развитие',facts:[['Сейчас','Рабочая веб-бета'],['Далее','Проверка с пилотами'],['Приоритет','Стабильность и права']],points:[
   'Веб-бета опубликована. Учебные варианты Start и Class пока доступны только локально.',
   'Ближайший шаг: закончить проверку стабильности и провести занятия с небольшой группой новичков.',
   'Далее нужны разрешённые ресурсы, проверка физики и производительности на целевых компьютерах.'
  ],note:'Коммерческие права на импортированный контент и 60 FPS на UHD 620 пока не подтверждены.',sources:['docs/ORACLE-DEPLOYMENT.md','docs/DEMAND-PILOTS-20261023.md','docs/PRODUCT-DIRECTION-20261023.md']}
 ]}
};

function text(s,value,x,y,w,h,size,color='#172B24',bold=false,link) {
 const a=s.shapes.add({geometry:'textbox',position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});
 a.text=link?[[{run:value,link:{uri:link,isExternal:true}}]]:value;
 a.text.insets=0;
 a.text.style={typeface:'Arial',fontSize:size,color,bold};
 return a;
}
export async function buildDeck(presentation,key) {
 const deck=decks[key];
 presentation.slides.keep([]);
 for(const [index,d] of deck.slides.entries()) {
  const s=presentation.slides.add({width:1280,height:720,background:{fill:'#F4F2EB'}});
  text(s,'PARVOZ',48,31,500,34,23,'#53675C',true);
  text(s,`${String(index+1).padStart(2,'0')} / 09`,1140,34,100,28,16,'#53675C');
  text(s,d.title,48,99,1180,74,44,'#172B24',true);
  if(d.image){
   const p=path.join(root,shots[d.image]);
   const opts={blob:new Uint8Array(await fs.readFile(p)),contentType:p.endsWith('.png')?'image/png':'image/jpeg',fit:'contain',alt:d.caption,position:{left:48,top:204,width:704,height:396}};
   if(d.crop){opts.crop={left:0,top:0,right:0.55,bottom:0.45};opts.fit='contain';}
   s.images.add(opts);
   text(s,d.caption,48,614,704,36,15,'#50645A');
  } else {
   const step=d.facts.length===4?100:128;
   for(const [i,[name,desc]] of d.facts.entries()) {
    text(s,name,48,218+i*step,700,51,36,'#2C6855',true);
    text(s,desc,48,270+i*step,700,40,24,'#50645A');
   }
  }
  for(const [j,p] of d.points.entries()) {
   text(s,String(j+1).padStart(2,'0'),790,214+j*130,45,36,18,'#2C6855',true);
   text(s,p,836,211+j*130,396,124,25,'#172B24');
  }
  const foot=d.note || 'Реальные кадры Parvoz. Импортированные ресурсы Liftoff используются в тестовой бете.';
  text(s,foot,48,668,1184,37,14,'#50645A',false,d.link);
  if(d.links){
   // Human-readable citations remain visible and clickable in the PDF.
   d.links.forEach(([name,url],i)=>text(s,name,48+i*220,631,210,27,16,'#2C6855',false,url));
  }
  s.speakerNotes.text=[`Parvoz - ${deck.label}. 24 October 2026.`,...d.sources.map(x=>'Source: '+x),d.image?'Image: '+shots[d.image]:'',
   'Screenshots are actual historical game captures, not generated artwork. Imported Liftoff content: LuGus Studios and credited providers; commercial redistribution permission unconfirmed.',
   'Published release status taken from the latest 23 October deployment record, not a new server acceptance. No investment request.'].join('\n');
 }
 return deck;
}
