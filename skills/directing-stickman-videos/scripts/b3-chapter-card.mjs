import path from 'node:path';
import {fileURLToPath} from 'node:url';

// A short, screen-fixed B3 chapter card. Add the returned layers at the end
// of the opening shot for that chapter; narration and captions keep their timing.
export function makeChapterCard({number, total, title, fileNumber, until = 1.4, showProgress = true}) {
  if (!Number.isInteger(number) || !Number.isInteger(total) || number < 1 || total < number || total > 12)
    throw Error('B3 chapter card needs a valid number and total (max 12)');
  if (typeof title !== 'string' || !title.trim() || title.length > 30)
    throw Error('B3 chapter card title must be 1–30 characters');
  if (fileNumber !== undefined && (!Number.isInteger(fileNumber) || fileNumber < 1 || fileNumber > 999))
    throw Error('B3 chapter card fileNumber must be 1–999');
  if (!Number.isFinite(until) || until < .5 || until > 3) throw Error('B3 chapter card hold must be 0.5–3 seconds');
  const fixed = layer => ({...layer, from: 0, to: until, screenFixed: true});
  const ink = '#fafafa', black = '#020202', dim = '#777777';
  const box = 74, gap = 14, row = total * box + (total - 1) * gap, left = (1280 - row) / 2;
  return [
    fixed({type: 'rect', x: 0, y: 0, w: 1280, h: 2276, fill: black}),
    fixed({type: 'text', text: fileNumber === undefined ? 'CHAPTER' : 'FILE', x: 160, y: 750,
      size: fileNumber === undefined ? 130 : 175, color: ink, bold: true}),
    fixed({type: 'rect', x: 790, y: 735, w: 300, h: 205, fill: ink, radius: 22}),
    fixed({type: 'text', text: fileNumber === undefined ? String(number) : String(fileNumber).padStart(3, '0'),
      x: fileNumber === undefined ? 850 : 812, y: 755, size: fileNumber === undefined ? 165 : 135,
      color: black, bold: true, ...(fileNumber === undefined ? {} : {seriesChrome: 'chapter_card_file'})}),
    fixed({type: 'line', points: [[220, 1045], [1060, 1045]], color: '#d32331', lineWidth: 8}),
    fixed({type: 'text', text: title.trim().toUpperCase(), x: 160, y: 1115, w: 960, size: 72, color: ink, bold: true}),
    ...(showProgress ? Array.from({length: total}, (_, i) => {
      const x = left + i * (box + gap), active = i + 1 === number;
      return [
        fixed({type: 'rect', x, y: 1350, w: box, h: box, fill: active ? ink : black,
          stroke: active ? ink : dim, lineWidth: 4, radius: 10}),
        fixed({type: 'text', text: String(i + 1), x: x + 21, y: 1355, size: 46,
          color: active ? black : dim, bold: true})
      ];
    }).flat() : [])
  ];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [number, total, title, until, fileNumber] = process.argv.slice(2);
  process.stdout.write(JSON.stringify(makeChapterCard({number: Number(number), total: Number(total), title,
    until: until === undefined ? 1.4 : Number(until),
    ...(fileNumber === undefined ? {} : {fileNumber:Number(fileNumber)})})) + '\n');
}
