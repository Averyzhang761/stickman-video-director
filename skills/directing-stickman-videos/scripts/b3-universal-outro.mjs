import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {makePuppet} from './b3-acting.mjs';

function pawPrint(x, y, scale = 1, ring = false) {
  const circle = (dx,dy,w,h) => ({type:'ellipse',x:dx,y:dy,w,h,fill:'#fafafa',stroke:'#050505',lineWidth:9});
  return {type:'group',x,y,scaleX:scale,scaleY:scale,children:[
    ...(ring ? [
      {type:'ellipse',x:-145,y:-145,w:290,h:290,fill:'none',stroke:'#fafafa',lineWidth:7},
      {type:'ellipse',x:-128,y:-128,w:256,h:256,fill:'none',stroke:'#777777',lineWidth:3}
    ] : []),
    circle(-62,3,124,91),circle(-95,-80,44,55),circle(-48,-111,43,54),
    circle(7,-113,43,54),circle(61,-83,44,55)
  ]};
}

// Fixed visual sign-off for every case. Supply the actual female voice and
// align its captions in the episode; this helper never synthesizes speech.
export function makeUniversalOutro({start = 0, nextFile = 2, channelName} = {}) {
  if (!Number.isFinite(start) || start < 0 || !Number.isInteger(nextFile) || nextFile < 2 || nextFile > 999)
    throw Error('B3 universal outro needs a start time and next file number');
  if (typeof channelName !== 'string' || !/^[A-Za-z][A-Za-z0-9 ]{1,21}$/.test(channelName.trim()))
    throw Error('B3 universal outro needs a channel name');
  const black = {type:'rect',x:0,y:0,w:1280,h:2276,fill:'#020202'};
  const presenter = makePuppet({id:`cat_archivist_${Math.round(start * 1000)}`,
    action:'inspect',reason:'The archivist turns toward the viewer before closing the transmission',
    objective:'make the institution feel unexpectedly personal',x:315,y:1815,scale:1.7,duration:4.5,
    appearance:'cat_archivist'});
  const seal = pawPrint(640,1010,1,true);
  seal.id = `archive_seal_${Math.round(start * 1000)}`;
  seal.motion = {role:'prop',reason:'The institutional paw seal stamps into view after the identity slate'};
  seal.keys = [{t:0,scaleX:.85,scaleY:.85,alpha:0},{t:.2,scaleX:.9,scaleY:.9,alpha:1},
    {t:1.1,scaleX:1,scaleY:1,alpha:1}];
  return {
    spoken:['Officially, that is the end.','Look again.'],
    events:[{time:start + 4.25,kind:'snow',frames:3}],
    shots:[
      {start,end:start + 4.5,kind:'universal_outro',camera:{from:1,to:1.06,pivotX:640,pivotY:1120},layers:[
        black,
        {type:'text',text:`${channelName.trim().toUpperCase()} // TRANSMISSION`,x:70,y:105,size:36,color:'#bcbcbc',tracking:3,fontRole:'tag',screenFixed:true},
        presenter,
        {type:'rect',x:0,y:1460,w:1280,h:600,fill:'#020202'},
        pawPrint(955,1110,1.05,true),
        {type:'text',text:'DEPARTMENT OF OPEN CASES',x:670,y:1370,w:545,size:35,
          color:'#c5c5c5',tracking:2,fontRole:'tag',align:'center',screenFixed:true}
      ]},
      {start:start + 4.5,end:start + 5.7,kind:'universal_outro',layers:[
        black,seal,
        {type:'text',text:channelName.trim().toUpperCase(),x:190,y:1230,w:900,size:47,
          color:'#fafafa',tracking:4,fontRole:'tag',align:'center',screenFixed:true},
        {type:'text',text:'TRANSMISSION COMPLETE',x:190,y:1650,w:900,size:43,
          color:'#c5c5c5',tracking:3,fontRole:'tag',align:'center',screenFixed:true}
      ]},
      {start:start + 5.7,end:start + 10,kind:'end_card',
        reason:'Hold the recurring sign-off after the archivist looks up',layers:[
          black,
          {type:'text',text:'LOOK',x:420,y:775,w:600,size:160,color:'#fafafa',tracking:2,bold:true,screenFixed:true},
          {type:'text',text:'AGAIN.',x:360,y:955,w:700,size:160,color:'#fafafa',tracking:2,bold:true,screenFixed:true},
          pawPrint(1000,750,.48),
          {type:'line',points:[[230,1180],[1050,1180]],color:'#bd2631',lineWidth:8,screenFixed:true},
          {type:'text',text:`NEXT FILE: ${String(nextFile).padStart(3,'0')}`,
            x:425,y:1255,w:560,size:41,color:'#999999',tracking:3,fontRole:'tag',screenFixed:true}
        ]}
    ]
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [start, nextFile, ...channelName] = process.argv.slice(2);
  process.stdout.write(JSON.stringify(makeUniversalOutro({start:Number(start),nextFile:Number(nextFile),channelName:channelName.join(' ')})) + '\n');
}
