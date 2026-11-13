"""Replace B3 narration, stems and caption band while retaining approved scene pixels."""
import argparse
import json
import os
import shutil
import subprocess
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('project', type=Path)
parser.add_argument('picture_video', type=Path)
parser.add_argument('output', type=Path)
parser.add_argument('--seconds', type=float)
parser.add_argument('--source-project', type=Path)
args = parser.parse_args()
if args.output.exists():
    raise SystemExit('Output exists; choose a new path')
p = json.loads(args.project.read_text())
if p['style'] != 'B3' or p['width'] != 1080 or p['height'] != 1920:
    raise SystemExit('Only the approved 1080x1920 B3 picture is supported')
root = args.project.parent
duration = float(p['shots'][-1]['end'])
probe = lambda file: json.loads(subprocess.check_output(['ffprobe', '-v', 'error',
    '-show_format', '-of', 'json', str(file)]))['format']
source_project = json.loads(args.source_project.read_text()) if args.source_project else p
source_duration = float(source_project['shots'][-1]['end'])
if abs(float(probe(args.picture_video)['duration']) - source_duration) > .08:
    raise SystemExit('Picture duration differs from the narration project')
voice = root / p['voice']['path']
if abs(float(probe(voice)['duration']) - duration) > .12:
    raise SystemExit('Fitted narration duration differs from the story')

cue_dir = args.output.with_name(args.output.stem + '-cues')
cue_dir.mkdir(parents=True, exist_ok=True)
for i, cue in enumerate(p['captions']):
    (cue_dir / f'{i:04}.txt').write_text(cue['text'].replace('\n', ' ').upper())

inputs = ['-i', str(args.picture_video), '-i', str(voice)]
filters = [f'[1:a]apad,atrim=0:{duration:.6f}[voice]']
backgrounds = []
index = 2
for track in p.get('ambience', []) + p.get('score', []) + [s for s in p.get('sfx', []) if s['kind'] == 'file']:
    is_effect = track.get('kind') == 'file'
    source = root / track['path']
    if not is_effect and track.get('loop', True):
        inputs += ['-stream_loop', '-1']
    inputs += ['-i', str(source)]
    start = track.get('time', track.get('start', 0))
    length = track.get('duration', float(probe(source)['duration'])) if is_effect else track['end'] - track['start']
    chain = [f'atrim=start={track.get("offset", 0)}:duration={length:.6f}',
             'asetpts=PTS-STARTPTS', f'volume={track["gain"]}']
    if track.get('fadeIn'):
        chain.append(f'afade=t=in:st=0:d={track["fadeIn"]}')
    if track.get('fadeOut'):
        chain.append(f'afade=t=out:st={max(0, length-track["fadeOut"]):.6f}:d={track["fadeOut"]}')
    chain.append(f'adelay={round(start * 1000)}:all=1')
    name = f'track{index}'
    filters.append(f'[{index}:a]' + ','.join(chain) + f'[{name}]')
    backgrounds.append(f'[{name}]')
    index += 1
filters.append(''.join(backgrounds) + f'amix=inputs={len(backgrounds)}:normalize=0:duration=longest[background]')
filters.append('[voice][background]amix=inputs=2:normalize=0:duration=first,'
               f'alimiter=limit=0.97:level=false:latency=true,atrim=0:{duration:.6f}[mix]')
font = Path(__file__).resolve().parent.parent / 'assets/fonts/Nunito.ttf'
video_filters = ['drawbox=x=0:y=1827:w=iw:h=93:color=0x020202:t=fill']
for i, cue in enumerate(p['captions']):
    if args.seconds and cue['start'] >= args.seconds:
        break
    video_filters.append(f'drawtext=fontfile={font}:textfile={cue_dir / f"{i:04}.txt"}:'
        f'fontsize=42:fontcolor=0xf4f5f5:borderw=2:bordercolor=0x111316:'
        f'x=(w-text_w)/2:y=1847:enable=\'gte(t,{cue["start"]})*lt(t,{cue["end"]})\'')
source_cuts = [source_project['shots'][c['shot']]['start'] for c in source_project['series']['chapters']] + [source_duration]
target_cuts = [p['shots'][c['shot']]['start'] for c in p['series']['chapters']] + [duration]
if len(source_cuts) != len(target_cuts):
    raise SystemExit('Source and target chapter counts differ')
if any(abs(a - b) > .02 for a, b in zip(source_cuts, target_cuts)):
    count = len(source_cuts) - 1
    labels = ''.join(f'[split{i}]' for i in range(count))
    filters.append(f'[0:v]split={count}{labels}')
    for i in range(count):
        factor = (target_cuts[i + 1] - target_cuts[i]) / (source_cuts[i + 1] - source_cuts[i])
        filters.append(f'[split{i}]trim=start={source_cuts[i]:.6f}:end={source_cuts[i + 1]:.6f},'
            f'setpts=(PTS-STARTPTS)*{factor:.9f}[part{i}]')
    filters.append(''.join(f'[part{i}]' for i in range(count)) +
        f'concat=n={count}:v=1:a=0,fps={p["fps"]}[picture]')
    picture = '[picture]'
else:
    picture = '[0:v]'
filters.append(picture + ','.join(video_filters) + '[video]')
args.output.parent.mkdir(parents=True, exist_ok=True)
choices = [os.environ.get('B3_FFMPEG'), shutil.which('ffmpeg'), '/opt/anaconda3/bin/ffmpeg']
ffmpeg = next((exe for exe in choices if exe and Path(exe).exists() and
    'drawtext' in subprocess.check_output([exe, '-hide_banner', '-filters'], stderr=subprocess.DEVNULL).decode()), None)
if not ffmpeg:
    raise SystemExit('FFmpeg with drawtext is required; use the normal B3 renderer in this environment')
encoders = subprocess.check_output([ffmpeg, '-hide_banner', '-encoders'], stderr=subprocess.DEVNULL).decode()
video_encoder = ['-c:v', 'h264_videotoolbox', '-b:v', '10M'] if 'h264_videotoolbox' in encoders else \
    ['-c:v', 'libx264', '-preset', 'fast', '-crf', '20']
command = [ffmpeg, '-v', 'error', '-y', *inputs, '-filter_complex', ';'.join(filters),
    '-map', '[video]', '-map', '[mix]',
    *video_encoder, '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-t', str(min(duration, args.seconds or duration)),
    '-movflags', '+faststart', str(args.output)]
subprocess.run(command, check=True)
print(json.dumps({'output': str(args.output), 'duration': float(probe(args.output)['duration']),
    'caption_count': len(p['captions']), 'scene_assets_rerendered': False,
    'video_reencoded_for_captions': True}))
