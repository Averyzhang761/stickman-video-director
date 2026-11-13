"""Concatenate verified narration clips and gently slow speech to an authored slot."""
import argparse
import json
import subprocess
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--target', type=float, required=True)
parser.add_argument('output', type=Path)
parser.add_argument('parts', type=Path, nargs='+')
args = parser.parse_args()
if args.output.exists():
    raise SystemExit('Output exists; choose a new path')
for part in args.parts:
    if not part.is_file():
        raise SystemExit(f'Missing narration clip: {part}')
args.output.parent.mkdir(parents=True, exist_ok=True)
inputs = sum((['-i', str(part)] for part in args.parts), [])
filter_graph = ';'.join(f'[{i}:a]aresample=24000,aformat=channel_layouts=mono[a{i}]'
    for i in range(len(args.parts))) + ';' + ''.join(f'[a{i}]' for i in range(len(args.parts))) + \
    f'concat=n={len(args.parts)}:v=0:a=1[out]'
raw = args.output.with_name(args.output.stem + '-raw.wav')
subprocess.run(['ffmpeg', '-v', 'error', '-y', *inputs, '-filter_complex', filter_graph,
    '-map', '[out]', '-ar', '24000', '-ac', '1', '-c:a', 'pcm_s16le', str(raw)], check=True)
seconds = float(json.loads(subprocess.check_output(['ffprobe', '-v', 'error',
    '-show_format', '-of', 'json', str(raw)]))['format']['duration'])
ratio = seconds / args.target
if not .85 <= ratio <= 1:
    raise SystemExit(f'Raw narration {seconds:.2f}s requires tempo {ratio:.3f}; revise pacing plan')
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(raw), '-af',
    f'atempo={ratio:.8f},apad,atrim=0:{args.target:.6f}', '-ar', '24000', '-ac', '1',
    '-c:a', 'pcm_s16le', str(args.output)], check=True)
print(json.dumps({'raw_seconds': seconds, 'target_seconds': args.target,
    'tempo': round(ratio, 5), 'output': str(args.output)}))
