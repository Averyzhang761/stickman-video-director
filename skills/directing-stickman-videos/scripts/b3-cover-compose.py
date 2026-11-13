"""Compose a repeatable 9:16 B3 cover from one authored flat scene and short hook."""
import json
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError as exc:
    raise SystemExit('Install Pillow to compose B3 covers: python3 -m pip install Pillow') from exc

if len(sys.argv) != 3:
    raise SystemExit('usage: python3 b3-cover-compose.py COVER_CONFIG.json OUTPUT.png')
config_file = Path(sys.argv[1]).resolve()
config = json.loads(config_file.read_text())
scene = (config_file.parent / config['scene']).resolve()
output = Path(sys.argv[2]).resolve()
root = Path(__file__).resolve().parent.parent
scale = 2
width, height = 1080 * scale, 1920 * scale
image = Image.open(scene).convert('RGB')
if image.size not in [(1080, 1920), (width, height)]:
    raise SystemExit('cover scene must be 1080x1920 or 2160x3840')
if image.size != (width, height):
    image = image.resize((width, height), Image.Resampling.LANCZOS)
draw = ImageDraw.Draw(image)
nunito = root / 'assets/fonts/Nunito.ttf'
inter = root / 'assets/fonts/Inter.ttf'
font = lambda size, heavy=True: ImageFont.truetype(str(nunito if heavy else inter), size * scale)
def label(x, y, value, size, color, heavy=True):
    draw.text((x*scale,y*scale),value,font=font(size,heavy),fill=color)
def line(points,color,size):
    draw.line([(x*scale,y*scale) for x,y in points],fill=color,width=size*scale)
def fit(value, maximum, size):
    while draw.textbbox((0,0),value,font=font(size))[2]/scale > maximum and size >= 90:
        size -= 2
    if draw.textbbox((0,0),value,font=font(size))[2]/scale > maximum:
        raise SystemExit('headline is too long for phone cover')
    return size

channel = config['channel_name'].upper()
number = int(config['file_number'])
white = config['headline_white'].upper()
red = config['headline_red'].upper()
title = config['episode_title'].upper()
if len(white.split()) > 3 or len(red.split()) > 2:
    raise SystemExit('cover headline needs at most three white and two red words')
label(64,54,f'FILE {number:03}  //  {channel}',30,'#a8a8a5',False)
line([(62,112),(1018,112)],'#484848',2)
label(62,150,white,fit(white,955,166),'#f6f6f2')
label(62,340,red,fit(red,955,166),'#e52232')
line([(64,548),(1018,548)],'#e52232',10)
for y,length in [(568,188),(580,110),(590,245)]:
    line([(64,y),(64+length,y)],'#777777',2)
draw.rectangle((0,1745*scale,width,height),fill='#030303')
label(62,1768,title,fit(title,955,38),'#f6f6f2')
line([(62,1835),(1018,1835)],'#e52232',5)
output.parent.mkdir(parents=True,exist_ok=True)
image.resize((1080,1920),Image.Resampling.LANCZOS).save(output,optimize=True)
print(json.dumps({'output':str(output),'size':[1080,1920],'headline':[white,red]}))
