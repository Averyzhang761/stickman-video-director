// Original B3 series host: a feline-headed adult woman in a solid tailored
// jacket. This is a portrait rig, separate from the generic story puppet.
export function makeCatArchivist({id, x, y, scale = 1, duration = 4.5}) {
  if (typeof id !== 'string' || !id || ![x,y,scale,duration].every(Number.isFinite) || scale <= 0 || duration < 2)
    throw Error('B3 cat archivist needs id, position, scale and duration');
  const path = (commands, fill, stroke = '#050505', lineWidth = 14) =>
    ({type:'path',commands,fill,stroke,...(lineWidth > 0 ? {lineWidth} : {})});
  const ink = '#050505', white = '#fafafa', gray = '#777777';
  const head = {type:'group',id:`${id}_head`,x:105,y:8,pivotX:110,pivotY:255,
    keys:[{t:0,x:105,angle:0},{t:duration*.27,x:105,angle:0},
      {t:duration*.53,x:111,angle:-.055},{t:duration*.76,x:111,angle:-.055},
      {t:duration*.96,x:107,angle:.018}],
    motion:{role:'actor',action:'turn',objective:'meet the viewer’s gaze',
      reason:'The archivist looks up after closing the file'},children:[
      path([['M',29,91],['Q',3,144,7,301],['L',67,301],['L',84,248],
        ['L',139,248],['L',158,301],['L',218,301],['Q',224,143,192,91],['Z']],gray),
      path([['M',29,99],['L',36,25],['L',89,66],['Q',112,58,139,66],
        ['L',191,25],['L',198,99],['Q',210,151,190,210],
        ['Q',165,270,113,274],['Q',59,270,34,213],['Q',15,160,29,99],['Z']],white),
      path([['M',32,111],['Q',63,76,100,85],['Q',143,79,189,112],
        ['Q',141,109,112,126],['Q',73,112,32,130],['Z']],'#bdbdbd','none',0),
      {type:'ellipse',x:61,y:166,w:30,h:11,fill:ink},
      {type:'ellipse',x:139,y:166,w:30,h:11,fill:ink},
      path([['M',108,194],['L',124,194],['L',116,204],['Z']],ink,'none',0),
      path([['M',101,220],['Q',116,219,132,220]],'none',ink,4)
    ]};
  const hand = {type:'group',id:`${id}_hand`,pivotX:349,pivotY:397,
    keys:[{t:0,angle:0},{t:duration*.31,angle:0},
      {t:duration*.59,angle:-.15},{t:duration*.82,angle:-.15},
      {t:duration*.97,angle:-.04}],
    motion:{role:'actor',action:'inspect',objective:'hold the closed file in view',
      reason:'The archivist deliberately lifts the file before the sign-off'},children:[
      {type:'line',points:[[351,408],[395,544],[357,630]],color:ink,lineWidth:69},
      {type:'line',points:[[351,408],[395,544],[357,630]],color:white,lineWidth:45},
      {type:'ellipse',x:331,y:602,w:55,h:58,fill:white,stroke:ink,lineWidth:12},
      {type:'rect',x:316,y:583,w:135,h:75,fill:'#d6d6d6',stroke:ink,lineWidth:10,radius:8},
      {type:'line',points:[[337,619],[431,619]],color:'#bd2631',lineWidth:7}
    ]};
  return {type:'group',id,x,y,scaleX:scale,scaleY:scale,children:[
    path([['M',76,352],['Q',26,354,18,430],['L',18,790],['L',412,790],
      ['L',412,430],['Q',402,354,352,352],['L',76,352],['Z']],white),
    {type:'rect',x:177,y:276,w:80,h:102,fill:white,stroke:ink,lineWidth:14,radius:8},
    path([['M',77,364],['L',184,370],['L',215,592],['L',135,487],['Z']],'#bdbdbd',ink,6),
    path([['M',352,364],['L',248,370],['L',215,592],['L',295,487],['Z']],'#dddddd',ink,6),
    path([['M',215,592],['L',215,790]],'none',ink,6),
    {type:'line',points:[[79,414],[32,571],[62,666]],color:ink,lineWidth:71},
    {type:'line',points:[[79,414],[32,571],[62,666]],color:white,lineWidth:47},
    {type:'ellipse',x:34,y:635,w:60,h:61,fill:white,stroke:ink,lineWidth:12},
    hand,head
  ]};
}
