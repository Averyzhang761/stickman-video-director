import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createCanvas,GlobalFonts} from '@napi-rs/canvas';

// Fit authored B3 series captions to the renderer's actual Nunito line width.
export function fitB3Captions(project) {
  if (project.style !== 'B3' || !project.series) throw Error('B3 series project required');
  const font = fileURLToPath(new URL('../assets/fonts/Nunito.ttf',import.meta.url));
  GlobalFonts.registerFromPath(font,'B3CaptionFit');
  const ctx = createCanvas(1,1).getContext('2d');
  ctx.font = '600 50px B3CaptionFit';
  ctx.letterSpacing = '1.5px';
  const maxWidth = 1076;
  const captions = [];
  for (const cue of project.captions) {
    const words = cue.text.trim().split(/\s+/);
    const groups = []; let group = [];
    for (const word of words) {
      if (ctx.measureText(word).width > maxWidth) throw Error(`Caption word too wide: ${word}`);
      const next = [...group,word];
      if (group.length && ctx.measureText(next.join(' ')).width > maxWidth) {
        groups.push(group); group = [word];
      } else group = next;
    }
    if (group.length) groups.push(group);
    const length = cue.end - cue.start;
    let used = 0;
    for (const wordsInGroup of groups) {
      const start = cue.start + length * used / words.length;
      used += wordsInGroup.length;
      const end = cue.start + length * used / words.length;
      if (end - start < .15) throw Error(`Caption fragment too short: ${wordsInGroup.join(' ')}`);
      captions.push({start:Number(start.toFixed(4)),end:Number(end.toFixed(4)),text:wordsInGroup.join(' ')});
    }
  }
  return {...project,captions};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [input,output] = process.argv.slice(2);
  if (!input || !output) throw Error('usage: node b3-fit-captions.mjs INPUT OUTPUT');
  const project = JSON.parse(fs.readFileSync(input,'utf8'));
  fs.writeFileSync(output,JSON.stringify(fitB3Captions(project),null,2) + '\n');
}
