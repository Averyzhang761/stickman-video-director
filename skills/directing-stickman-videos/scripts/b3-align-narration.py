"""Align B3 burned-in captions to an already generated, fitted narration WAV."""
import argparse
import difflib
import json
import re
import subprocess
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('project', type=Path)
parser.add_argument('audio', type=Path)
parser.add_argument('script', type=Path)
parser.add_argument('--apply', action='store_true')
args = parser.parse_args()

project = json.loads(args.project.read_text())
duration = float(json.loads(subprocess.check_output(['ffprobe', '-v', 'error',
    '-show_format', '-of', 'json', str(args.audio)]))['format']['duration'])
target = float(project['shots'][-1]['end'])
if abs(duration - target) > .12:
    raise SystemExit(f'Narration {duration:.3f}s must match story picture {target:.3f}s')

from faster_whisper import WhisperModel
model = WhisperModel('small', device='cpu', compute_type='int8', local_files_only=True)
segments, _ = model.transcribe(str(args.audio), language='en', beam_size=5, word_timestamps=True)
heard = [{'text': w.word, 'start': float(w.start), 'end': float(w.end)}
         for segment in segments for w in segment.words or []]
truth = re.findall(r'\S+', args.script.read_text())
norm = lambda s: re.sub(r'[^a-z0-9]', '', s.lower())
matches = difflib.SequenceMatcher(None, [norm(w) for w in truth],
    [norm(w['text']) for w in heard], autojunk=False)
ratio = matches.ratio()
if ratio < .90:
    raise SystemExit(f'ASR/script similarity {ratio:.3f} below .90; inspect audio before applying')
times = [None] * len(truth)
for block in matches.get_matching_blocks():
    for offset in range(block.size):
        word = heard[block.b + offset]
        times[block.a + offset] = (word['start'], word['end'])
known = [i for i, item in enumerate(times) if item]
for i in range(len(times)):
    if times[i]:
        continue
    left = next((j for j in reversed(known) if j < i), None)
    right = next((j for j in known if j > i), None)
    if left is None:
        start = max(0, times[right][0] - .22 * (right - i))
    elif right is None:
        start = min(duration - .18, times[left][1] + .04 * (i - left))
    else:
        start = times[left][1] + (times[right][0] - times[left][1]) * (i - left) / (right - left + 1)
    times[i] = (start, min(duration, start + .18))

cues, group = [], []
def flush():
    if not group:
        return
    start = max(cues[-1]['end'] if cues else 0, times[group[0]][0])
    end = min(duration, max(start + .04, times[group[-1]][1]))
    cues.append({'start': round(start, 3), 'end': round(end, 3),
                 'text': ' '.join(truth[j] for j in group)})
    group.clear()

for i, word in enumerate(truth):
    if group and (len(group) >= 4 or len(' '.join(truth[j] for j in group) + ' ' + word) > 27):
        flush()
    group.append(i)
    if len(group) >= 4 or (len(group) >= 3 and word[-1:] in '.!?'):
        flush()
flush()

stem = args.audio.with_suffix('')
stem.with_name(stem.name + '-asr.json').write_text(json.dumps(heard, indent=2) + '\n')
stem.with_name(stem.name + '-captions.json').write_text(json.dumps(cues, indent=2) + '\n')
report = {'audio': str(args.audio), 'duration': duration,
    'script_asr_similarity': round(ratio, 4), 'caption_count': len(cues),
    'expected_words': len(truth), 'heard_words': len(heard), 'applied': args.apply}
if args.apply:
    project['voice'] = {'path': str(args.audio.resolve().relative_to(args.project.parent.resolve())),
                        'lead': 0, 'tail': 0}
    project['captions'] = cues
    project['series']['voice_status'] = 'review'
    args.project.write_text(json.dumps(project, indent=2) + '\n')
print(json.dumps(report))
