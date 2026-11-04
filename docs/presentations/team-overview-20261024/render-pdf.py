"""PDF export fallback: native vector text and embedded original screenshots.
The live slide authoring lives in decks.mjs. This renderer shares its data.
"""
import json
import os
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader

ROOT = Path(__file__).resolve().parents[3]
DATA = json.loads((ROOT/'tmp/pdfs/parvoz-team/decks.json').read_text('utf-8'))
FONTS = Path(os.environ.get('PARVOZ_FONT_DIR', 'C:/Windows/Fonts'))
pdfmetrics.registerFont(TTFont('Arial', str(FONTS/'arial.ttf')))
pdfmetrics.registerFont(TTFont('ArialBold', str(FONTS/'arialbd.ttf')))
W,H = 1280,720
INK,GREEN,MUTED = '#172B24','#2C6855','#50645A'
reports=[]

def text(c, value, x, top, width, size=25, color=INK, bold=False, max_height=None, link=None):
    font='ArialBold' if bold else 'Arial'
    leading=size*1.23
    lines=[]
    for para in value.split('\n'):
        line=''
        for word in para.split():
            trial=(line+' '+word).strip()
            if pdfmetrics.stringWidth(trial,font,size)>width and line:
                lines.append(line)
                line=word
            else: line=trial
        lines.append(line)
    height=len(lines)*leading
    if max_height is not None and height>max_height:
        raise ValueError(f'Text overflow {height:.1f} > {max_height}: {value}')
    c.setFillColor(HexColor(color))
    c.setFont(font,size)
    for i,line in enumerate(lines):
        baseline=H-top-size-i*leading
        c.drawString(x,baseline,line)
        if link:
            end=x+pdfmetrics.stringWidth(line,font,size)
            c.linkURL(link,(x,baseline-3,end,baseline+size),relative=0)
    return height

def image(c, filename, crop=False):
    img=ImageReader(str(filename))
    iw,ih=img.getSize()
    cw,ch=(iw*.45,ih*.55) if crop else (iw,ih)
    scale=min(704/cw,396/ch)
    dw,dh=cw*scale,ch*scale
    x,y=48+(704-dw)/2,H-204-dh
    c.saveState()
    p=c.beginPath(); p.rect(x,y,dw,dh); c.clipPath(p,stroke=0,fill=0)
    # Clip a top-left source region without changing image proportions.
    c.drawImage(img,x,y-(ih-ch)*scale,width=iw*scale,height=ih*scale,mask='auto')
    c.restoreState()

for key,deck in DATA['decks'].items():
    out=ROOT/'output/pdf'/deck['filename']
    out.parent.mkdir(parents=True,exist_ok=True)
    c=canvas.Canvas(str(out),pagesize=(W,H),pageCompression=1)
    c.setTitle('Parvoz: '+deck['label'])
    c.setAuthor('Parvoz Drone Simulator')
    c.setSubject('Обзор игры для руководителя команды. 24 октября 2026.')
    for idx,d in enumerate(deck['slides']):
        c.setFillColor(HexColor('#F4F2EB')); c.rect(0,0,W,H,stroke=0,fill=1)
        c.bookmarkPage(f'slide-{idx+1}')
        c.addOutlineEntry(d['title'],f'slide-{idx+1}',level=0)
        text(c,'PARVOZ',48,31,500,23,'#53675C',True)
        text(c,f'{idx+1:02} / 09',1140,34,100,16,'#53675C')
        text(c,d['title'],48,99,1180,44,INK,True,74)
        if 'image' in d:
            image(c,ROOT/DATA['shots'][d['image']],d.get('crop',False))
            text(c,d['caption'],48,614,704,15,MUTED,max_height=38)
        else:
            step=100 if len(d['facts'])==4 else 128
            for i,(name,desc) in enumerate(d['facts']):
                text(c,name,48,218+i*step,700,36,GREEN,True,51)
                text(c,desc,48,270+i*step,700,24,MUTED,max_height=40)
        for j,point in enumerate(d['points']):
            text(c,f'{j+1:02}',790,214+j*130,45,18,GREEN,True)
            text(c,point,836,211+j*130,396,25,INK,max_height=124)
        foot=d.get('note','Реальные кадры Parvoz. Импортированные ресурсы Liftoff используются в тестовой бете.')
        text(c,foot,48,668,1184,14,MUTED,max_height=37,link=d.get('link'))
        for i,(name,url) in enumerate(d.get('links',[])):
            text(c,name,48+i*220,631,210,16,GREEN,link=url)
        c.showPage()
    c.save()
    reports.append({'file':str(out),'pages':len(deck['slides']),'bytes':out.stat().st_size,
                    'body_words':[len(d['points'][0].split()+d['points'][1].split()+d['points'][2].split()) for d in deck['slides']]})
print(json.dumps(reports,ensure_ascii=False,indent=2))
