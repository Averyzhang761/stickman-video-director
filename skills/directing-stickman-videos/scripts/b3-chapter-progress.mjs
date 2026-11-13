import fs from 'node:fs';
import {makeSeriesBug} from './b3-series-bug.mjs';

// Persistent, screen-fixed series chrome. The story determines the chapters;
// the number of boxes is never hard-coded to a reference episode.
export function makeChapterProgress({number,total}) {
  if (!Number.isInteger(number) || !Number.isInteger(total) || number<1 || total<number || total>12)
    throw Error('B3 chapter progress needs a number within 1–12 chapters');
  const box=total>9?34:42,gap=total>9?7:9;
  const left=(1280-(total*box+(total-1)*gap))/2;
  return Array.from({length:total},(_,i)=>{
    const active=i+1===number,x=left+i*(box+gap),label=String(i+1);
    return [
      {type:'rect',seriesChrome:'chapter_progress',x,y:32,w:box,h:box,
        fill:active?'#fafafa':'#020202',stroke:active?'#fafafa':'#777777',
        lineWidth:3,radius:6,screenFixed:true},
      {type:'text',seriesChrome:'chapter_progress',text:label,
        x:x+(label.length===1?box*.33:box*.17),y:33,size:total>9?21:25,
        color:active?'#020202':'#777777',bold:true,screenFixed:true}
    ];
  }).flat();
}

export function stampSeriesChrome(shots,{channelName,fileNumber,chapters}) {
  if (!Array.isArray(shots)||!shots.length||!Array.isArray(chapters)||!chapters.length||chapters[0].shot!==0)
    throw Error('B3 series chrome needs shots and chapters beginning at shot zero');
  for(let i=0;i<chapters.length;i++)
    if(!Number.isInteger(chapters[i].shot)||chapters[i].shot<0||chapters[i].shot>=shots.length||
      (i>0&&chapters[i].shot<=chapters[i-1].shot))
      throw Error('B3 chapter shots must increase within the episode');
  makeChapterProgress({number:1,total:chapters.length});
  const bug=makeSeriesBug({channelName,fileNumber});
  let active=0;
  return shots.map((shot,index)=>{
    if(active+1<chapters.length&&index===chapters[active+1].shot)active++;
    const layers=shot.layers.filter(l=>
      l.seriesChrome!=='chapter_progress' &&
      !(l.type==='text'&&/^FILE \d{3}\s*\/\//.test(l.text||'')) &&
      !(l.type==='text'&&l.y<250&&/^\d{1,2}\s*\/\s*\d{1,2}$/.test(l.text||'')) &&
      !(chapters.some(c=>c.shot===index)&&l.screenFixed&&l.from===0&&l.to<=3&&
        ((l.type==='rect'&&l.y===1350&&l.w===74&&l.h===74)||
         (l.type==='text'&&l.y===1355&&/^\d+$/.test(l.text||'')))));
    const cover=index===0&&layers.at(-1)?.type==='rect'&&layers.at(-1)?.x===0&&
      layers.at(-1)?.y===0&&layers.at(-1)?.w===1280&&layers.at(-1)?.h===2276&&
      layers.at(-1)?.to<=.6?layers.pop():null;
    return {...shot,layers:[...layers,{...bug},...makeChapterProgress({number:active+1,total:chapters.length}),
      ...(cover?[cover]:[])]};
  });
}

if(process.argv[1]&&process.argv[1].endsWith('b3-chapter-progress.mjs')){
  const [input,output,configFile]=process.argv.slice(2);
  if(!input||!output||!configFile)throw Error('usage: node b3-chapter-progress.mjs INPUT OUTPUT CONFIG');
  const project=JSON.parse(fs.readFileSync(input,'utf8'));
  const config=JSON.parse(fs.readFileSync(configFile,'utf8'));
  project.shots=stampSeriesChrome(project.shots,config);
  project.series={...project.series,channel_name:config.channelName,file_number:config.fileNumber,
    chapters:config.chapters};
  fs.writeFileSync(output,JSON.stringify(project,null,2)+'\n');
}
