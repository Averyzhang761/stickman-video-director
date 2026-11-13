import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {makeSeriesBug} from './b3-series-bug.mjs';
import {makeChapterCard} from './b3-chapter-card.mjs';
import {makeOpeningSignal} from './b3-opening-signal.mjs';
import {stampSeriesChrome} from './b3-chapter-progress.mjs';
import {lockCharacterStyle} from './b3-lock-character-style.mjs';

// Apply the repeatable B3 series grammar to an already authored story manifest.
// Story, actor poses, prop states, narration and sound remain authored inputs.
export function finishSuspenseSeries(project, {channelName, fileNumber, chapters, faults = []}) {
  if (project.style !== 'B3' || !Array.isArray(project.shots) || !project.shots.length)
    throw Error('B3 series finishing needs authored B3 shots');
  makeSeriesBug({channelName,fileNumber});
  const chapterByShot = new Map(chapters.map((chapter, index) => {
    if (!Number.isInteger(chapter.shot) || chapter.shot < 0 || chapter.shot >= project.shots.length)
      throw Error('B3 chapter shot is outside the episode');
    return [chapter.shot,{number:index + 1,total:chapters.length,title:chapter.title}];
  }));
  if (!chapters.length || chapters[0].shot !== 0 || chapterByShot.size !== chapters.length)
    throw Error('B3 chapters must start at shot zero and use distinct shots');
  const opening = makeOpeningSignal({fps:project.fps});
  const shots = project.shots.map((shot, index) => {
    const layers = shot.layers.filter(layer => !(layer.type === 'text' && /^FILE \d{3}\s*\/\//.test(layer.text || '')));
    for (const layer of layers) {
      if (layer.type === 'puppet') layer.headStyle = 'solid';
      if (layer.type === 'text' && layer.y < 250) layer.screenFixed = true;
    }
    const evidenceText = layers.filter(layer => layer.type === 'group' &&
      (layer.children || []).filter(child => child.type === 'text').length >= 3).length > 0;
    const push = evidenceText ? 1.025 : 1.08;
    return {...shot,camera:{from:1,to:push,pivotX:640,pivotY:1050},
      layers:[...layers,
        ...(chapterByShot.has(index) ? makeChapterCard({...chapterByShot.get(index),fileNumber,showProgress:false}) : []),
        ...(index === 0 ? [opening.cover] : [])]};
  });
  return lockCharacterStyle({...project,shots:stampSeriesChrome(shots,{channelName,fileNumber,chapters}),
    series:{...project.series,channel_name:channelName,file_number:fileNumber,chapters},
    television:{enabled:true,intensity:.75,grain:.8,flicker:.08,
      events:[opening.event,...faults]}});
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [input, output, configFile] = process.argv.slice(2);
  if (!input || !output || !configFile)
    throw Error('usage: node b3-series-finish.mjs INPUT OUTPUT CONFIG');
  const project = JSON.parse(fs.readFileSync(input,'utf8'));
  const config = JSON.parse(fs.readFileSync(configFile,'utf8'));
  fs.writeFileSync(output,JSON.stringify(finishSuspenseSeries(project,config),null,2) + '\n');
}
