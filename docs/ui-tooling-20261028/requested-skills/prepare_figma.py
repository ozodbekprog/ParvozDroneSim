"""Prepare the existing hangar study as self-contained HTML, not a flat UI image.

The output is input for a future html_to_figma call, not a Figma deliverable.
Only the game scene and individual drone thumbnails remain raster images.
Usage: python docs/ui-tooling-20261028/requested-skills/prepare_figma.py
"""

import base64
import hashlib
import io
import json
from html import escape
from pathlib import Path

from PIL import Image

from render import ASSETS, HERE, TOKENS


def uri(data, mime):
    return f'data:{mime};base64,' + base64.b64encode(data).decode('ascii')


def prepare():
    output = HERE / 'prepared'
    output.mkdir(exist_ok=True)
    source = ASSETS / 'hangar.png'
    background = uri(source.read_bytes(), 'image/png')
    regular = uri((ASSETS / 'Regular.woff2').read_bytes(), 'font/woff2')
    semibold = uri((ASSETS / 'Semibold.woff2').read_bytes(), 'font/woff2')
    variables = ';'.join(f'--{name}:{value}' for name, value in TOKENS.items())
    names = ['Armattan Chameleon 5″', 'Armattan Gecko 3″', 'Dquad Addiction',
             'Kestrel 5', 'Luma 5', 'Luma 5 Copy 1']
    roles = ['5″ · Фристайл', '3″ · Манёвренный', '5″ · Гоночный',
             '5″ · Фристайл', '5″ · Фристайл', 'Копия · 5″ · Фристайл']
    cards = []
    for i, (name, role) in enumerate(zip(names, roles)):
        image = Image.open(ASSETS / f'drone-{min(i + 1, 5):02}.png').convert('RGBA')
        image = image.crop(image.getchannel('A').getbbox())
        buffer = io.BytesIO()
        image.save(buffer, format='PNG')
        selected = i == 5
        fallback = 'Базовая Luma 5; миниатюра копии пока недоступна' if selected else ''
        cards.append(f'''<li class="drone-card{' selected' if selected else ''}" data-layer="Drone card {i + 1}" title="{escape(fallback)}">
          <div class="drone-art"><img src="{uri(buffer.getvalue(), 'image/png')}" alt="{escape(fallback or name)}" /></div>
          <strong>{escape(name)}</strong><small>{escape(role)}</small>
          {'<span class="chosen">Выбран</span>' if selected else ''}</li>''')
    metrics = []
    for label, value, unit, maximum in [('Вес', 595, 'г', 1200),
                                       ('Отклик моторов', 35, 'мс', 200),
                                       ('Энергия батареи', 28.9, 'Вт·ч', 60)]:
        formatted = str(value).replace('.', ',')
        metrics.append(f'''<section class="metric" data-layer="{label}">
          <div class="metric-label"><span>{label}</span><strong>{formatted} {unit}</strong></div>
          <div class="track" aria-hidden="true"><div style="width:{100 * value / maximum:.5f}%"></div></div>
          <div class="range"><span>0</span><span>{maximum} {unit}</span></div></section>''')
    html = f'''<!doctype html><html lang="ru"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="description" content="Статичный макет ангара для переноса в редактируемые слои Figma. Игровые действия не подключены." />
<title>PARVOZ — ангар, исходник для Figma</title>
<style>
@font-face{{font-family:'Source Sans 3';src:url('{regular}') format('woff2');font-weight:400}}
@font-face{{font-family:'Source Sans 3';src:url('{semibold}') format('woff2');font-weight:600}}
:root{{{variables}}}*{{box-sizing:border-box}}body{{margin:0;font:400 18px/1.25 'Source Sans 3',sans-serif;color:var(--text);background:var(--ink)}}
h1,h2,h3,p,ul{{margin:0}}strong{{font-weight:600}}#hangar{{position:relative;width:1920px;height:1080px;overflow:hidden}}
.scene{{position:absolute;inset:0;width:1920px;height:1080px}}.panel{{background:var(--panel);border:1px solid var(--line);border-radius:5px}}
.heading{{position:absolute;left:28px;top:24px;width:234px;height:76px;padding:4px 16px;border:0}}h1{{font-size:34px;line-height:44px;font-weight:600}}.heading p{{font-size:17px;color:var(--muted)}}
.menu-return{{position:absolute;right:28px;top:28px;width:220px;height:46px}}.action{{display:flex;align-items:center;justify-content:center;background:var(--card);border:1px solid var(--line);border-radius:4px;font-size:20px;line-height:1.2}}
.inspector{{position:absolute;right:28px;top:104px;width:380px;height:688px;padding:22px 23px;display:flex;flex-direction:column}}
.kind,.origin{{color:var(--muted);font-size:17px}}h2{{font-size:32px;line-height:40px;font-weight:600;margin-top:8px}}.role{{font-size:20px;color:var(--accent);margin-top:5px}}.origin{{margin-top:8px}}
.metrics{{border-top:1px solid var(--line);margin-top:20px;padding-top:15px}}h3{{font-size:20px;font-weight:600;margin-bottom:14px}}
.metric{{height:74px}}.metric-label{{display:flex;align-items:baseline;justify-content:space-between;font-size:20px}}.metric-label strong{{font-size:22px;white-space:nowrap}}
.track{{height:6px;background:var(--track);margin-top:10px}}.track>div{{height:100%;background:var(--fill)}}.range{{display:flex;justify-content:space-between;color:var(--muted);font-size:14px;margin-top:6px}}
.secondary{{display:flex;justify-content:space-between;margin-top:0}}.secondary div{{display:flex;flex-direction:column;gap:6px;min-width:90px}}.secondary span{{font-size:16px;color:var(--muted)}}.secondary strong{{font-size:24px}}
.estimate{{font-size:14px;color:var(--muted);margin-top:10px;white-space:nowrap}}.status{{color:var(--accent);font-size:18px;font-weight:600;margin-top:10px}}.workbench{{height:50px;min-height:50px;margin-top:10px;color:var(--ink);background:var(--accent);border:0;font-weight:600}}.delete{{margin-top:18px;font-size:17px;color:var(--danger)}}
.camera{{position:absolute;left:44px;top:774px;display:flex;gap:12px}}.camera .action{{width:44px;height:44px}}.camera .reset{{width:186px}}
.roster{{position:absolute;left:28px;right:28px;top:832px;height:220px;padding:13px 15px 15px}}.roster-header{{height:44px;display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}}
.filters{{display:flex;gap:8px;font-size:19px;color:var(--muted)}}.filter{{padding:10px 15px;height:44px;border:1px solid transparent;border-radius:4px}}.filter.active{{color:var(--text);background:var(--selected);border-color:var(--accent);font-weight:600}}.count{{color:var(--muted)}}
.cards{{display:flex;gap:10px;list-style:none;padding:0}}.drone-card{{position:relative;width:297px;height:132px;padding:0 13px 7px;flex:none;border:1px solid var(--line);border-radius:4px;background:var(--card);display:flex;flex-direction:column}}.drone-card.selected{{border:2px solid var(--accent);background:var(--selected)}}
.drone-art{{height:76px;min-height:76px;display:flex;align-items:center;justify-content:center}}.drone-art img{{width:160px;height:67px;object-fit:contain}}.drone-card strong{{font-size:20px;line-height:25px;white-space:nowrap}}.drone-card small{{font-size:15px;color:var(--muted);line-height:20px;margin-top:3px}}.chosen{{position:absolute;right:12px;top:10px;font-size:14px;color:var(--accent);font-weight:600}}
</style></head><body><main id="hangar" aria-label="Статичный макет ангара; игровые действия не подключены">
<img class="scene" src="{background}" alt="Настоящая сцена публичного ангара PARVOZ с Luma 5 на столе; снимок от 28 октября 2026" data-layer="Actual game scene" />
<header class="panel heading" data-layer="Hangar heading"><h1>Ангар</h1><p>Выбор дрона</p></header>
<div class="action menu-return" data-layer="Main menu action">В главное меню</div>
<aside class="panel inspector" aria-label="Характеристики Luma 5 Copy 1" data-layer="Drone inspector">
<header><p class="kind">Изменённый</p><h2>Luma 5 Copy 1</h2><p class="role">5″ · Фристайл</p><p class="origin">На основе Luma 5</p></header>
<section class="metrics" data-layer="Physical characteristics"><h3>Характеристики</h3>{''.join(metrics)}</section>
<section class="secondary" data-layer="Secondary characteristics"><div><span>Тяга / вес</span><strong>5,6×</strong></div><div><span>Полёт ≈</span><strong>6 мин</strong></div><div><span>Камера</span><strong>105°</strong></div></section>
<p class="estimate">Отклик и время полёта — оценки симуляции.</p><p class="status">Выбран для полёта</p>
<div class="action workbench" data-layer="Workbench action">Открыть мастерскую</div><p class="delete" data-layer="Delete copy action">Удалить копию</p></aside>
<div class="camera" data-layer="Camera controls"><span class="action">−</span><span class="action">+</span><span class="action reset">Сбросить ракурс</span></div>
<section class="panel roster" aria-label="Коллекция дронов" data-layer="Drone collection"><header class="roster-header"><div class="filters"><span class="filter active">Все 6</span><span class="filter">Оригинал 5</span><span class="filter">Изменённый 1</span></div><span class="count">6 дронов</span></header><ul class="cards">{''.join(cards)}</ul></section>
</main></body></html>'''
    path = output / 'hangar-editable.html'
    path.write_text(html, encoding='utf-8')
    original = HERE.parent.parent / 'ui-research-20261028/realistic/evidence/public-hangar-ui.png'
    original_uri = uri(original.read_bytes(), 'image/png')
    preview = f'''<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>PARVOZ — сравнение ангара</title>
<meta name="viewport" content="width=device-width,initial-scale=1"><style>
*{{box-sizing:border-box}}body{{margin:0;background:#1b1e23;color:#f0f1f1;font:16px/1.3 system-ui,sans-serif}}
header{{height:64px;display:flex;align-items:center;gap:12px;padding:8px 20px}}header p{{margin:0 auto 0 0}}nav{{display:flex;gap:8px}}button{{font:inherit;padding:9px 16px;border:1px solid #89929e;border-radius:4px;color:inherit;background:#292e35;cursor:pointer}}button[aria-pressed=true]{{background:#eea462;color:#1b1e23;border-color:#eea462}}button:focus-visible{{outline:2px solid #eea462;outline-offset:3px}}
#stage{{position:relative;height:calc(100dvh - 104px);overflow:hidden}}#frame{{position:absolute;width:1920px;height:1080px;left:50%;top:50%;transform-origin:center}}iframe,#original{{width:1920px;height:1080px;position:absolute;inset:0;border:0}}[hidden]{{display:none!important}}footer{{height:40px;padding:10px 20px;color:#adb1b7;font-size:14px}}@media(max-width:640px){{header p{{font-size:12px}}button{{font-size:13px;padding:8px}}footer{{font-size:11px}}}}
</style></head><body><header><p>PARVOZ · визуальное обсуждение</p><nav aria-label="Сравнить ангар"><button id="before" aria-pressed="false">Текущий UI</button><button id="after" aria-pressed="true">Доработка</button></nav></header>
<main id="stage"><div id="frame"><img id="original" src="{original_uri}" alt="Исходный публичный UI ангара от 28 октября 2026" hidden><iframe id="proposal" src="hangar-editable.html" title="Статичный макет доработки ангара"></iframe></div></main>
<footer>Предложение не утверждено. Игровые действия здесь не подключены. Файл в Figma ещё не создан.</footer>
<script>const frame=document.querySelector('#frame'),stage=document.querySelector('#stage');function fit(){{frame.style.transform='translate(-50%,-50%) scale('+Math.min(stage.clientWidth/1920,stage.clientHeight/1080)+')'}}function show(before){{document.querySelector('#original').hidden=!before;document.querySelector('#proposal').hidden=before;document.querySelector('#before').setAttribute('aria-pressed',String(before));document.querySelector('#after').setAttribute('aria-pressed',String(!before))}}document.querySelector('#before').addEventListener('click',()=>show(true));document.querySelector('#after').addEventListener('click',()=>show(false));addEventListener('resize',fit);fit();</script></body></html>'''
    (output / 'index.html').write_text(preview, encoding='utf-8')
    evidence = {
        'date': '2026-10-28', 'timezone': 'Asia/Tashkent',
        'source': 'prepare_figma.py', 'output': 'prepared/hangar-editable.html',
        'selfContained': True, 'canvas': [1920, 1080], 'domCards': len(cards),
        'imageElements': 7, 'physicalScaleSections': len(metrics),
        'sourceSceneSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
        'outputSha256': hashlib.sha256(path.read_bytes()).hexdigest(),
        'figmaFileCreated': False, 'figmaImportPerformed': False,
        'browserVerification': 'Recorded separately in figma-browser-check.json',
        'reason': 'Figma tools absent this turn; plugin catalog reports installed=false',
    }
    (HERE / 'figma-preparation.json').write_text(json.dumps(evidence, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'output': str(path), 'bytes': path.stat().st_size,
                      'cards': len(cards), 'figmaImportPerformed': False}))


if __name__ == '__main__':
    prepare()
