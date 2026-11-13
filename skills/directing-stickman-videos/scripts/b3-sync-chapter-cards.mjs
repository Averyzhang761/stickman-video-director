import fs from 'node:fs';
import {makeChapterCard} from './b3-chapter-card.mjs';

export function syncChapterCards(project) {
  const chapters = project.series?.chapters;
  const fileNumber = project.series?.file_number;
  if (!Array.isArray(chapters) || !Number.isInteger(fileNumber))
    throw Error('B3 chapter sync needs series.chapters and series.file_number');
  let changed = 0;
  for (const [index, chapter] of chapters.entries()) {
    const shot = project.shots[chapter.shot];
    if (!shot) throw Error(`Chapter ${index + 1} has no shot`);
    const at = shot.layers.findIndex(l => l.type === 'rect' && l.screenFixed && l.x === 0 && l.y === 0 &&
      l.w === 1280 && l.h === 2276 && l.from === 0 && l.to >= .5 && l.to <= 3);
    if (at < 0 || !['FILE', 'CHAPTER'].includes(shot.layers[at + 1]?.text))
      throw Error(`Chapter ${index + 1} has no replaceable card`);
    const old = shot.layers.slice(at, at + 6);
    const next = makeChapterCard({number:index + 1,total:chapters.length,title:chapter.title,
      fileNumber,until:old[0].to,showProgress:false});
    if (JSON.stringify(old) !== JSON.stringify(next)) {
      shot.layers.splice(at, 6, ...next);
      changed++;
    }
  }
  return {file_number:fileNumber,chapters:chapters.length,changed};
}

if (process.argv[1] && process.argv[1].endsWith('b3-sync-chapter-cards.mjs')) {
  const file = process.argv[2];
  if (!file || process.argv.length !== 3) throw Error('usage: node b3-sync-chapter-cards.mjs PROJECT');
  const project = JSON.parse(fs.readFileSync(file,'utf8'));
  const result = syncChapterCards(project);
  if (result.changed) fs.writeFileSync(file,JSON.stringify(project,null,2) + '\n');
  console.log(JSON.stringify(result));
}
