"""Static canvas-design study. Does not load or modify the running game.

Usage: python render.py --font-dir PATH_TO_SOURCE_SANS_3_TTF
Requires Pillow. Fonts and image provenance are documented in README.md.
"""

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
ASSETS = HERE.parent / 'variants' / 'assets'
TOKENS = {
    'panel': '#23262b', 'card': '#292e35', 'line': '#59616d',
    'text': '#f0f1f1', 'muted': '#adb1b7', 'accent': '#eea462',
    'ink': '#1b1e23', 'track': '#4b535d', 'fill': '#c7cdd4',
    'selected': '#3a3029', 'danger': '#ed9c95',
}


def rgb(hex_value):
    return tuple(int(hex_value[i:i + 2], 16) for i in (1, 3, 5))


def contrast(foreground, background):
    def luminance(value):
        channels = [v / 255 for v in rgb(value)]
        channels = [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in channels]
        return sum(a * b for a, b in zip(channels, (.2126, .7152, .0722)))
    a, b = sorted((luminance(foreground), luminance(background)))
    return (b + .05) / (a + .05)


def render(font_dir):
    base = Image.open(ASSETS / 'hangar.png').convert('RGB')
    if base.size != (1920, 1080):
        raise ValueError('Use the verified full-size public background')
    canvas = base.copy()
    draw = ImageDraw.Draw(canvas)
    fonts = {}
    bounds = []

    def font(size, semibold=False):
        key = (size, semibold)
        if key not in fonts:
            path = font_dir / f'SourceSans3-{"Semibold" if semibold else "Regular"}.ttf'
            fonts[key] = ImageFont.truetype(str(path), size)
        return fonts[key]

    def text(x, y, value, size=18, color='text', semibold=False, right=False):
        face = font(size, semibold)
        width = draw.textlength(value, font=face)
        if right:
            x -= width
        box = draw.textbbox((x, y), value, font=face, anchor='lt')
        if box[0] < 0 or box[1] < 0 or box[2] > 1920 or box[3] > 1080:
            raise ValueError(f'Text outside canvas: {value}')
        bounds.append({'text': value, 'box': list(box), 'size': size})
        draw.text((x, y), value, font=face, fill=TOKENS.get(color, color), anchor='lt')
        return width

    def box(rect, fill='panel', outline=None, radius=5, width=1):
        draw.rounded_rectangle(rect, radius, fill=TOKENS[fill],
                               outline=TOKENS.get(outline), width=width)

    def button(rect, label, primary=False):
        x1, y1, x2, y2 = rect
        box(rect, 'accent' if primary else 'card', None if primary else 'line', 4)
        face = font(20, primary)
        w = draw.textlength(label, font=face)
        text(x1 + (x2 - x1 - w) / 2, y1 + 13, label, 20,
             'ink' if primary else 'text', primary)

    # Keep the full, unretouched source scene. Only peripheral UI is drawn.
    box((28, 24, 262, 100))
    text(44, 34, 'Ангар', 34, semibold=True)
    text(44, 74, 'Выбор дрона', 17, 'muted')
    button((1672, 28, 1892, 74), 'В главное меню')

    box((1512, 104, 1892, 792), outline='line')
    text(1536, 128, 'Изменённый', 17, 'muted')
    text(1536, 158, 'Luma 5 Copy 1', 32, semibold=True)
    text(1536, 201, '5″ · Фристайл', 20, 'accent')
    text(1536, 230, 'На основе Luma 5', 17, 'muted')
    draw.line((1536, 264, 1868, 264), fill=TOKENS['line'])
    text(1536, 283, 'Характеристики', 20, semibold=True)

    metrics = [
        ('Вес', '595 г', 595, 1200, '1200 г', 322),
        ('Отклик моторов', '35 мс', 35, 200, '200 мс', 402),
        ('Энергия батареи', '28,9 Вт·ч', 28.9, 60, '60 Вт·ч', 482),
    ]
    for label, value, actual, maximum, endpoint, y in metrics:
        text(1536, y, label, 20)
        text(1868, y - 1, value, 22, semibold=True, right=True)
        draw.rectangle((1536, y + 31, 1868, y + 36), fill=TOKENS['track'])
        draw.rectangle((1536, y + 31, 1536 + round(332 * actual / maximum), y + 36), fill=TOKENS['fill'])
        text(1536, y + 45, '0', 14, 'muted')
        text(1868, y + 45, endpoint, 14, 'muted', right=True)

    for x, label, value in [(1536, 'Тяга / вес', '5,6×'),
                            (1650, 'Полёт ≈', '6 мин'),
                            (1770, 'Камера', '105°')]:
        text(x, 565, label, 16, 'muted')
        text(x, 590, value, 24, semibold=True)

    text(1536, 624, 'Отклик и время полёта — оценки симуляции.', 14, 'muted')
    # Status is visually a status, rather than a disabled primary action.
    text(1536, 650, 'Выбран для полёта', 18, 'accent', semibold=True)
    button((1536, 675, 1868, 725), 'Открыть мастерскую', primary=True)
    text(1536, 750, 'Удалить копию', 17, 'danger')

    # Retain the existing camera operations in the composition.
    button((44, 774, 88, 818), '−')
    button((100, 774, 144, 818), '+')
    button((156, 774, 342, 818), 'Сбросить ракурс')

    box((28, 832, 1892, 1052), outline='line')
    filters = [(44, 156, 'Все  6', True), (164, 324, 'Оригинал  5', False),
               (332, 526, 'Изменённый  1', False)]
    for x1, x2, label, selected in filters:
        box((x1, 846, x2, 890), 'selected' if selected else 'panel',
            'accent' if selected else None, 4)
        text(x1 + 16, 858, label, 19, 'text' if selected else 'muted', selected)
    text(1876, 860, '6 дронов', 18, 'muted', right=True)

    names = ['Armattan Chameleon 5″', 'Armattan Gecko 3″', 'Dquad Addiction',
             'Kestrel 5', 'Luma 5', 'Luma 5 Copy 1']
    roles = ['5″ · Фристайл', '3″ · Манёвренный', '5″ · Гоночный',
             '5″ · Фристайл', '5″ · Фристайл', 'Копия · 5″ · Фристайл']
    thumbs = []
    for i, (name, role) in enumerate(zip(names, roles)):
        x, y, w, h = 44 + 307 * i, 904, 297, 132
        selected = i == 5
        box((x, y, x + w, y + h), 'selected' if selected else 'card',
            'accent' if selected else 'line', 4, 2 if selected else 1)
        image_path = ASSETS / f'drone-{min(i + 1, 5):02}.png'
        thumb = Image.open(image_path).convert('RGBA')
        alpha_box = thumb.getchannel('A').getbbox()
        thumb = thumb.crop(alpha_box)
        thumb.thumbnail((160, 67), Image.Resampling.LANCZOS)
        # Enlarge only the real thumbnail; keep aspect ratio and alpha.
        factor = min(160 / thumb.width, 67 / thumb.height)
        thumb = thumb.resize((round(thumb.width * factor), round(thumb.height * factor)),
                             Image.Resampling.LANCZOS)
        canvas.paste(thumb, (x + (w - thumb.width) // 2, y + 6), thumb)
        thumbs.append({'name': name, 'file': image_path.name,
                       'fallback': selected, 'alphaCrop': list(alpha_box)})
        text(x + 14, y + 80, name, 20, semibold=True)
        text(x + 14, y + 108, role, 15, 'muted')
        if selected:
            text(x + w - 12, y + 11, 'Выбран', 14, 'accent', True, right=True)

    # Protect the complete central drone region from accidental art changes.
    protected = (375, 320, 1340, 800)
    diff = ImageChops.difference(canvas.crop(protected), base.crop(protected))
    if diff.getbbox() is not None:
        raise ValueError('Protected central scene was modified')
    output = HERE / 'hangar-refinement.png'
    canvas.save(output, optimize=True)
    checks = [
        ('Body text / panel', 'text', 'panel', 4.5),
        ('Secondary text / panel', 'muted', 'panel', 4.5),
        ('Secondary text / card', 'muted', 'card', 4.5),
        ('Secondary text / selected card', 'muted', 'selected', 4.5),
        ('Accent text / panel', 'accent', 'panel', 4.5),
        ('Primary button text / accent', 'ink', 'accent', 4.5),
        ('Delete copy / panel', 'danger', 'panel', 4.5),
        ('Scale fill / track', 'fill', 'track', 3.0),
        ('Selected border / selected card', 'accent', 'selected', 3.0),
    ]
    ratios = [{'element': label, 'foreground': TOKENS[fg], 'background': TOKENS[bg],
               'ratio': contrast(TOKENS[fg], TOKENS[bg]), 'required': minimum,
               'pass': contrast(TOKENS[fg], TOKENS[bg]) >= minimum}
              for label, fg, bg, minimum in checks]
    if any(not item['pass'] for item in ratios):
        raise ValueError('A designed contrast pair failed')
    overlaps = []
    for i, a in enumerate(bounds):
        for b in bounds[i + 1:]:
            ax1, ay1, ax2, ay2 = a['box']
            bx1, by1, bx2, by2 = b['box']
            if min(ax2, bx2) > max(ax1, bx1) and min(ay2, by2) > max(ay1, by1):
                overlaps.append([a['text'], b['text']])
    if overlaps:
        raise ValueError(f'Text runs overlap: {overlaps}')
    evidence = {
        'date': '2026-10-28', 'timezone': 'Asia/Tashkent',
        'artifact': output.name, 'size': list(canvas.size), 'tokens': TOKENS,
        'sourceScene': '../variants/assets/hangar.png',
        'sourceSha256': hashlib.sha256((ASSETS / 'hangar.png').read_bytes()).hexdigest(),
        'protectedRect': list(protected), 'changedPixelsInProtectedRect': 0,
        'thumbnails': thumbs, 'contrast': ratios, 'textBounds': bounds,
        'textOverlaps': overlaps,
        'browserAttempt': 'Local browser use is disabled in Work settings',
        'limitations': ['Static raster study, no functioning game controls',
                        'No fresh public-browser or accessibility-technology test',
                        'No approval of palette, layout or implementation'],
    }
    (HERE / 'canvas-checks.json').write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'output': str(output), 'dimensions': canvas.size,
                      'contrastPairsPassed': len(ratios), 'textRuns': len(bounds),
                      'protectedChangedPixels': 0}, ensure_ascii=False))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--font-dir', type=Path, required=True)
    render(parser.parse_args().font_dir)
