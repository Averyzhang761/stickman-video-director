import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {makeCatArchivist} from './b3-cat-archivist.mjs';

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
export function makeUniversalOutro({start = 0, nextFile = 2, channelName, identityImage, headSideImage, headMidImage, headTurnImage} = {}) {
  if (!Number.isFinite(start) || start < 0 || !Number.isInteger(nextFile) || nextFile < 2 || nextFile > 999)
    throw Error('B3 universal outro needs a start time and next file number');
  if (typeof channelName !== 'string' || !/^[A-Za-z][A-Za-z0-9 ]{1,21}$/.test(channelName.trim()))
    throw Error('B3 universal outro needs a channel name');
  if (identityImage !== undefined && (typeof identityImage !== 'string' || !/\.(png|jpe?g)$/i.test(identityImage)))
    throw Error('B3 universal outro identity image must be a PNG or JPEG path');
  if (headTurnImage !== undefined && (typeof headTurnImage !== 'string' || !/\.png$/i.test(headTurnImage) || !identityImage))
    throw Error('B3 head turn requires an identity image and a transparent PNG turn head');
  if (headMidImage !== undefined && (typeof headMidImage !== 'string' || !/\.png$/i.test(headMidImage) || !headTurnImage))
    throw Error('B3 middle pose requires a turn head and a transparent PNG middle head');
  if (headSideImage !== undefined && (typeof headSideImage !== 'string' || !/\.png$/i.test(headSideImage) || !headMidImage))
    throw Error('B3 side pose requires a middle head and a transparent PNG side head');
  const black = {type:'rect',x:0,y:0,w:1280,h:2276,fill:'#020202'};
  const presenter = makeCatArchivist({id:`cat_archivist_${Math.round(start * 1000)}`,
    x:90,y:685,scale:1.05,duration:4.5});
  const seal = pawPrint(640,1010,1,true);
  seal.id = `archive_seal_${Math.round(start * 1000)}`;
  seal.motion = {role:'prop',reason:'The institutional paw seal stamps into view after the identity slate'};
  seal.keys = [{t:0,scaleX:.85,scaleY:.85,alpha:0},{t:.2,scaleX:.9,scaleY:.9,alpha:1},
    {t:1.1,scaleX:1,scaleY:1,alpha:1}];
  return {
    spoken:['Officially, that is the end.','Look again.'],
    events:[{time:start + 4.25,kind:'snow',frames:3}],
    shots:[
      {start,end:start + 4.5,kind:'universal_outro',camera:{from:1,to:1.06,pivotX:640,pivotY:1120},layers:identityImage ? [
        black,
        {type:'image',path:identityImage,x:0,y:0,w:1280,h:2276,id:'identity_frame',
          ...(headSideImage ? {to:2.2} : {})},
        ...(headSideImage ? [
          {type:'image',path:headSideImage,x:200,y:380,w:880,h:845,id:'identity_head_side',from:2.2,to:2.52,
            motion:{role:'actor',reason:'The archivist begins turning toward the viewer'},
            keys:[{t:2.2,x:195},{t:2.52,x:205}]},
          {type:'image',path:headMidImage,x:200,y:380,w:880,h:845,id:'identity_head_mid',from:2.52,to:2.84,
            motion:{role:'actor',reason:'The archivist turns through a three-quarter angle'},
            keys:[{t:2.52,x:195},{t:2.84,x:205}]},
          {type:'image',path:headTurnImage,x:200,y:380,w:880,h:845,id:'identity_head_front',from:2.84,
            motion:{role:'actor',reason:'The archivist finishes her turn and holds eye contact'},
            keys:[{t:2.84,scaleX:1,scaleY:1},{t:4.5,scaleX:1.04,scaleY:1.04}]},
          {type:'text',text:channelName.trim().toUpperCase(),x:190,y:1370,w:900,size:80,
            color:'#fafafa',tracking:4,fontRole:'tag',align:'center',screenFixed:true,from:2.2}
        ] : []),
        {type:'ellipse',id:'evidence_activation',x:957,y:636,w:40,h:40,pivotX:20,pivotY:20,fill:'#e4313c',
          to:headSideImage ? 2.2 : 4.5,
          glow:32,glowColor:'#e4313c',
          motion:{role:'prop',reason:'The touched evidence node activates before the archive seal appears'},
          keys:[{t:0,scaleX:.7,scaleY:.7},{t:1.1,scaleX:1,scaleY:1},
            {t:2.2,scaleX:.7,scaleY:.7}]}
      ] : [
        black,
        {type:'text',text:`${channelName.trim().toUpperCase()} // TRANSMISSION`,x:70,y:105,size:36,color:'#bcbcbc',tracking:3,fontRole:'tag',screenFixed:true},
        presenter,
        pawPrint(955,1110,1.05,true),
        {type:'text',text:'DEPT. OF FELINE AFFAIRS',x:655,y:1365,w:570,size:30,
          color:'#d5d5d5',tracking:1.2,fontRole:'tag',align:'center',screenFixed:true},
        {type:'text',text:'OPEN CASES DIVISION',x:655,y:1425,w:570,size:25,
          color:'#777777',tracking:2,fontRole:'tag',align:'center',screenFixed:true}
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
