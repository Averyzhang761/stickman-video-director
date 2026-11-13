"""Compose a repeatable B3 cover from one authored flat scene and short hook."""
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
format = config.get('format', '9:16')
if format not in ('9:16', 'profile_grid_3x4'):
    raise SystemExit('cover format must be 9:16 or profile_grid_3x4')
width, height = 1080 * scale, (1440 if format == 'profile_grid_3x4' else 1920) * scale
image = Image.open(scene).convert('RGB')
if image.size not in [(1080, 1920), (2160, 3840)]:
    raise SystemExit('cover scene must be 1080x1920 or 2160x3840')
if image.size != (2160, 3840):
    image = image.resize((2160, 3840), Image.Resampling.LANCZOS)
if format == 'profile_grid_3x4':
    scene_crop = image.crop((0, 660*scale, 1080*scale, 1660*scale))
    scene_crop = scene_crop.resize((918*scale, 850*scale), Image.Resampling.LANCZOS)
    canvas = Image.new('RGB', (width, height), '#030303')
    canvas.paste(scene_crop, (81*scale, 445*scale))
    image = canvas
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
label(64,35 if format == 'profile_grid_3x4' else 54,f'FILE {number:03}  //  {channel}',30,'#a8a8a5',False)
line([(62,90 if format == 'profile_grid_3x4' else 112),(1018,90 if format == 'profile_grid_3x4' else 112)],'#484848',2)
label(62,115 if format == 'profile_grid_3x4' else 150,white,fit(white,955,140 if format == 'profile_grid_3x4' else 166),'#f6f6f2')
label(62,260 if format == 'profile_grid_3x4' else 340,red,fit(red,955,140 if format == 'profile_grid_3x4' else 166),'#e52232')
line([(64,425 if format == 'profile_grid_3x4' else 548),(1018,425 if format == 'profile_grid_3x4' else 548)],'#e52232',10)
if format == '9:16':
    for y,length in [(568,188),(580,110),(590,245)]:
        line([(64,y),(64+length,y)],'#777777',2)
draw.rectangle((0,(1310 if format == 'profile_grid_3x4' else 1745)*scale,width,height),fill='#030303')
label(62,1330 if format == 'profile_grid_3x4' else 1768,title,fit(title,955,38),'#f6f6f2')
line([(62,1400 if format == 'profile_grid_3x4' else 1835),(1018,1400 if format == 'profile_grid_3x4' else 1835)],'#e52232',5)
output.parent.mkdir(parents=True,exist_ok=True)
image.resize((1080,height//scale),Image.Resampling.LANCZOS).save(output,optimize=True)
print(json.dumps({'output':str(output),'size':[1080,height//scale],'headline':[white,red]}))
