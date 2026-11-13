// A single filled profile silhouette with connected head, torso and two legs.
// Use this for a small on-screen person where separate puppet limbs break apart.
export function makeSolidProfileActor({id, fromX, toX, y, duration, visibleUntil, leanAngle = 0}) {
  if (!id || ![fromX,toX,y,duration,visibleUntil,leanAngle].every(Number.isFinite))
    throw Error('Solid profile actor needs an id, positions and timing');
  const edge = '#050505', body = '#fafafa';
  return {type:'group',id,x:fromX,y,to:visibleUntil,pivotX:125,pivotY:1000,
    keys:[{t:0,x:fromX,angle:0},{t:Math.min(duration,visibleUntil),x:toX,angle:leanAngle}],
    motion:{role:'actor',action:'inspect',reason:'The complete figure approaches and looks into the door lens',
      objective:'See whether anyone is in the hallway'},
    children:[
      {type:'path',fill:body,stroke:edge,lineWidth:17,commands:[
        ['M',125,0],['C',53,0,0,52,0,125],['C',0,185,34,226,82,245],
        ['L',76,260],['C',30,262,25,288,25,335],['L',25,615],
        ['C',25,645,35,661,48,672],['L',48,964],['Q',48,1000,78,1000],
        ['L',98,1000],['Q',125,1000,125,970],['L',125,695],['L',145,695],
        ['L',145,970],['Q',145,1000,171,1000],['L',191,1000],
        ['Q',220,1000,220,964],['L',220,672],['C',234,654,235,636,235,615],
        ['L',235,335],['C',235,288,211,262,170,255],['L',169,245],
        ['C',218,224,250,180,250,125],['C',250,52,197,0,125,0],['Z']]},
      {type:'path',fill:body,stroke:edge,lineWidth:14,commands:[
        ['M',196,319],['Q',226,299,247,324],['L',307,448],
        ['Q',325,478,304,495],['Q',286,509,269,490],
        ['L',210,399],['Z']]},
      {type:'ellipse',x:207,y:112,w:22,h:22,fill:edge},
      {type:'path',fill:body,stroke:edge,lineWidth:9,commands:[
        ['M',244,140],['L',264,148],['L',245,156],['Z']]}
    ]};
}
