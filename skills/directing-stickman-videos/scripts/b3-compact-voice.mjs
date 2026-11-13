import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

function run(bin, args) {
  const result = spawnSync(bin, args, {encoding:'utf8'});
  if (result.status !== 0) throw Error(result.stderr || `${bin} failed`);
  return result;
}

export function compactVoice(input, output, maxPause = .35) {
  if (!Number.isFinite(maxPause) || maxPause <= 0) throw Error('max pause must be positive seconds');
  const scan = run('ffmpeg', ['-v','info','-i',input,'-af','silencedetect=noise=-40dB:d=0.5','-f','null','-']).stderr;
  const starts = [...scan.matchAll(/silence_start: ([\d.]+)/g)].map(match => Number(match[1]));
  const ends = [...scan.matchAll(/silence_end: ([\d.]+)/g)].map(match => Number(match[1]));
  if (starts.length !== ends.length) throw Error('incomplete silence scan');
  const cuts = starts.flatMap((start, i) => ends[i] - start > .5 ?
    [[start + maxPause / 2, ends[i] - maxPause / 2]] : []);
  if (!cuts.length) fs.copyFileSync(input, output);
  else {
    const expression = cuts.map(([start,end]) => `between(t\\,${start.toFixed(4)}\\,${end.toFixed(4)})`).join('+');
    run('ffmpeg', ['-v','error','-y','-i',input,'-af',`aselect=not(${expression}),asetpts=N/SR/TB`,output]);
  }
  const duration = file => Number(run('ffprobe',['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1',file]).stdout.trim().split('=')[1]);
  return {input:path.resolve(input),output:path.resolve(output),before:duration(input),after:duration(output),removed:cuts.length};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [input,output,pause] = process.argv.slice(2);
  if (!input || !output) throw Error('usage: node b3-compact-voice.mjs INPUT OUTPUT [MAX_PAUSE_SECONDS]');
  console.log(JSON.stringify(compactVoice(input,output,pause === undefined ? .35 : Number(pause))));
}
