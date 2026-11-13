"""Generate one Google Gemini TTS audition from an exact text file; no retries."""
import argparse
import base64
import json
import os
import urllib.error
import urllib.request
import wave
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('text_file', type=Path)
parser.add_argument('output_wav', type=Path)
parser.add_argument('--voice', required=True)
parser.add_argument('--model', default='gemini-2.5-flash-preview-tts')
args = parser.parse_args()

key = os.environ.get('GEMINI_API_KEY')
if not key:
    raise SystemExit('GEMINI_API_KEY is required')
if args.output_wav.exists():
    raise SystemExit('Output exists; choose a new path to avoid duplicate paid calls')
script = args.text_file.read_text().strip()
if not script:
    raise SystemExit('Text file is empty')
payload = {
    'contents': [{'parts': [{'text':
        'Say in a calm, low, investigative voice, with restrained suspense and unhurried pacing. '
        'Read the following words exactly:\n' + script}]}],
    'generationConfig': {'responseModalities': ['AUDIO'], 'speechConfig':
        {'voiceConfig': {'prebuiltVoiceConfig': {'voiceName': args.voice}}}},
}
url = f'https://generativelanguage.googleapis.com/v1beta/models/{args.model}:generateContent'
request = urllib.request.Request(url, data=json.dumps(payload).encode(),
    headers={'Content-Type': 'application/json', 'x-goog-api-key': key}, method='POST')
try:
    with urllib.request.urlopen(request, timeout=120) as response:
        result = json.load(response)
except urllib.error.HTTPError as error:
    detail = error.read().decode(errors='replace')
    raise SystemExit(f'Google TTS HTTP {error.code}: {detail[:500]}')
part = result['candidates'][0]['content']['parts'][0]['inlineData']
audio = base64.b64decode(part['data'])
args.output_wav.parent.mkdir(parents=True, exist_ok=True)
if audio[:4] == b'RIFF':
    args.output_wav.write_bytes(audio)
else:
    with wave.open(str(args.output_wav), 'wb') as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(24000)
        wav.writeframes(audio)
print(json.dumps({'voice': args.voice, 'model': args.model,
    'output': str(args.output_wav), 'usage': result.get('usageMetadata', {})}))
