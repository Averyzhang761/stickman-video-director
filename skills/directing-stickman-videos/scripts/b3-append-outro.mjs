import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

function command(bin, args) {
  const result = spawnSync(bin,args,{encoding:'utf8'});
  if (result.status !== 0) throw Error(result.stderr || `${bin} failed`);
  return result.stdout;
}
function probe(file) {
  return JSON.parse(command('ffprobe',['-v','error','-show_streams','-show_format','-of','json',file]));
}
function signature(info) {
  return info.streams.map(s => [s.codec_type,s.codec_name,s.width,s.height,s.r_frame_rate,s.sample_rate,s.channels].join(':')).join('|');
}
function concatPath(file) { return `file '${path.resolve(file).replaceAll("'", "'\\''")}'`; }

export function appendB3Outro(story, outro, output, {replace=false} = {}) {
  if (!fs.existsSync(story) || !fs.existsSync(outro)) throw Error('B3 story and outro files are required');
  if (fs.existsSync(output) && !replace) throw Error('B3 output exists; pass --replace to overwrite it');
  if ([story,outro].some(file => path.resolve(file) === path.resolve(output))) throw Error('B3 output must differ from its inputs');
  const a = probe(story), b = probe(outro);
  if (signature(a) !== signature(b)) throw Error('B3 story and outro codecs, size, frame rate and audio layout must match');
  if (a.streams.find(s=>s.codec_type==='video')?.width !== 1080 ||
    a.streams.find(s=>s.codec_type==='video')?.height !== 1920) throw Error('B3 series output must be native 1080x1920');
  const list = `${output}.ffconcat`;
  fs.writeFileSync(list,`${concatPath(story)}\n${concatPath(outro)}\n`);
  try { command('ffmpeg',['-v','error','-y','-f','concat','-safe','0','-i',list,'-c','copy','-movflags','+faststart',output]); }
  finally { fs.rmSync(list,{force:true}); }
  const final = probe(output);
  const duration = Number(final.format.duration);
  if (duration < 480 || duration > 540) throw Error(`B3 film including outro is ${duration}s, outside 8–9 minutes`);
  command('ffmpeg',['-v','error','-i',output,'-f','null','-']);
  return {output:path.resolve(output),duration,video:signature(final),decoded:true};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [story,outro,output,flag] = process.argv.slice(2);
  if (!story || !outro || !output) throw Error('usage: node b3-append-outro.mjs STORY OUTRO OUTPUT [--replace]');
  console.log(JSON.stringify(appendB3Outro(story,outro,output,{replace:flag==='--replace'}),null,2));
}
