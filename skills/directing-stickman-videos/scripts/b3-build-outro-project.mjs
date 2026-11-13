import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {makeUniversalOutro} from './b3-universal-outro.mjs';

// Reuse a ten-second B3 audio template while replacing only the visual outro.
export function buildOutroProject(template, {channelName, nextFile, identityImage, headSideImage, headMidImage, headTurnImage}) {
  if (template.style !== 'B3' || template.width * 16 !== template.height * 9)
    throw Error('B3 outro template must be native portrait');
  const outro = makeUniversalOutro({start:0,channelName,nextFile,identityImage,headSideImage,headMidImage,headTurnImage});
  return {...template,shots:outro.shots,
    television:{...template.television,enabled:true,
      events:[...(template.television?.events || []).filter(e => e.time < 4.25),...outro.events]},
    series:{...template.series,channel_name:channelName,file_number:nextFile - 1}};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [templateFile, outputFile, channelName, nextFile, identityImage, headSideImage, headMidImage, headTurnImage] = process.argv.slice(2);
  if (!templateFile || !outputFile || !channelName || !nextFile || !identityImage)
    throw Error('usage: node b3-build-outro-project.mjs TEMPLATE OUTPUT CHANNEL NEXT_FILE IDENTITY_IMAGE');
  const project = buildOutroProject(JSON.parse(fs.readFileSync(templateFile,'utf8')),
    {channelName,nextFile:Number(nextFile),identityImage,headSideImage,headMidImage,headTurnImage});
  fs.writeFileSync(outputFile,JSON.stringify(project,null,2) + '\n');
}
