import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Keep the first signal seizure timed separately from the chapter/title layers.
export function makeOpeningSignal({fps = 24, seconds = 1 / 3, strength = 1.7} = {}) {
  if (!Number.isInteger(fps) || fps < 12 || fps > 60 || !Number.isFinite(seconds) || seconds < .1 || seconds > .6 ||
    !Number.isFinite(strength) || strength < .1 || strength > 2) throw Error('Invalid B3 opening signal');
  const frames = Math.round(seconds * fps);
  if (frames > 12) throw Error('B3 opening signal exceeds 12 frames');
  return {event: {time: 0, kind: 'snow', frames, strength},
    cover: {type: 'rect', x: 0, y: 0, w: 1280, h: 2276, fill: '#020202',
      from: 0, to: frames / fps, screenFixed: true}};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [fps, seconds, strength] = process.argv.slice(2).map(Number);
  process.stdout.write(JSON.stringify(makeOpeningSignal({fps, seconds, strength})) + '\n');
}
