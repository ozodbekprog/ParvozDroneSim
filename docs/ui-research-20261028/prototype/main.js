import '@awesome.me/webawesome/dist/styles/themes/default.css';
import '@awesome.me/webawesome/dist/components/button/button.js';
import '@awesome.me/webawesome/dist/components/details/details.js';
import './style.css';

const query = new URLSearchParams(location.search);
const body = document.body;
const frame = document.querySelector('#frame');
let variant = ['1','2','3'].includes(query.get('variant')) ? query.get('variant') : '1';
const capture = query.get('capture') === '1';
body.classList.toggle('capture', capture);
function fit() {
  const reserved = capture ? 0 : 68;
  const scale = Math.min(innerWidth / 1920, (innerHeight - reserved) / 1080);
  frame.style.transform = `translate(-50%,-50%) scale(${scale})`;
}
function choose(value) {
  variant = value;
  body.dataset.variant = value;
  document.documentElement.classList.toggle('wa-dark', value !== '3');
  document.documentElement.classList.toggle('wa-light', value === '3');
  for (const button of document.querySelectorAll('[data-variant]')) button.setAttribute('aria-pressed', String(button.dataset.variant === value));
  query.set('variant', value);
  history.replaceState(null, '', `?${query}`);
}
document.querySelectorAll('[data-variant]').forEach(button => button.addEventListener('click', () => choose(button.dataset.variant)));
document.querySelector('#source-toggle').addEventListener('click', event => {
  const source = body.classList.toggle('source-only');
  event.currentTarget.setAttribute('aria-pressed', String(source));
  event.currentTarget.textContent = source ? 'Вернуть макет' : 'Показать исходный фон';
});
const status = document.querySelector('.save-status');
document.querySelector('#save').addEventListener('click', () => { status.textContent = 'Это макет — игра не изменена'; });
document.querySelector('#back').addEventListener('click', () => { status.textContent = 'Просмотр макета · без перехода в игру'; });
const installed = {
  'Рама': ['Luma 5 frame', 'Масса рамы', '219.0 г', 'Рама этой модели фиксирована.'],
  'Пропеллеры': ['Gemfan Hurricane MCK V2', 'Размер', '5×3.6″', '3 лопасти · 4.2 г на пропеллер · комплект 4 шт.'],
};
document.querySelectorAll('[data-category]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-category]').forEach(other => { const active = other === button; other.classList.toggle('selected', active); other.setAttribute('aria-pressed', String(active)); });
  const category = button.dataset.category;
  document.querySelector('#category-title').textContent = category;
  const data = installed[category];
  document.querySelector('#part-name').textContent = data?.[0] || category;
  document.querySelector('#part-note').textContent = data?.[3] || 'В этом макете проверяется оформление панели. Каталог и замена деталей не подключены.';
  const specs = document.querySelector('#specifications');
  specs.hidden = !data;
  if (data) { specs.querySelector('dt').textContent = data[1]; specs.querySelector('dd').textContent = data[2]; }
}));
document.querySelectorAll('[data-section]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-section]').forEach(other => { const active = other === button; other.classList.toggle('selected', active); other.setAttribute('aria-pressed', String(active)); });
  status.textContent = button.dataset.section === 'Детали' ? 'Изменений нет' : `${button.dataset.section}: проверка оформления вкладки; редактор не подключён`;
}));
addEventListener('keydown', event => { if (/^[123]$/.test(event.key) && !['INPUT','TEXTAREA'].includes(event.target.tagName)) choose(event.key); });
addEventListener('resize', fit);
choose(variant);
fit();
await Promise.all([customElements.whenDefined('wa-button'), customElements.whenDefined('wa-details'), document.fonts.ready]);
document.querySelector('.backdrop').decode().then(() => { document.body.dataset.ready = 'true'; });
