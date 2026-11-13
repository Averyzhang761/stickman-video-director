// A small B3 cutout rig. Complete joint poses interpolate with planted feet and
// attached hands; the story still chooses its objectives, contacts and holds.
export const JOINTS = ['head', 'neck', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'handL', 'handR', 'hipL', 'hipR', 'kneeL', 'kneeR', 'footL', 'footR'];

export function validatePuppet(layer, span) {
  if (!Array.isArray(layer.poses) || layer.poses.length < 2 || layer.poses.length > 12) throw Error('B3 puppet needs 2–12 complete poses');
  if (layer.headStyle !== undefined && !['solid', 'outline'].includes(layer.headStyle)) throw Error('Invalid B3 puppet head style');
  if (layer.appearance !== undefined && !['plain', 'cat_archivist', 'pictogram_female', 'pictogram_male'].includes(layer.appearance)) throw Error('Invalid B3 puppet appearance');
  if (layer.profileView !== undefined && !['front', 'side', 'back'].includes(layer.profileView)) throw Error('Invalid B3 pictogram view');
  if (layer.appearance === 'cat_archivist' && layer.headStyle === 'outline') throw Error('Cat archivist needs a solid head');
  if (layer.occludeBelow !== undefined && !Number.isFinite(layer.occludeBelow)) throw Error('Invalid B3 puppet occlusion edge');
  let previous = -1;
  for (const pose of layer.poses) {
    if (!Number.isFinite(pose.t) || pose.t <= previous || pose.t < 0 || pose.t > span + .001) throw Error('B3 puppet pose times must increase within the shot');
    previous = pose.t;
    if (!pose.joints || Object.keys(pose.joints).length !== JOINTS.length) throw Error('B3 puppet poses need every joint');
    for (const name of JOINTS) {
      const point = pose.joints[name];
      if (!Array.isArray(point) || point.length !== 2 || point.some(n => !Number.isFinite(n) || Math.abs(n) > 5000)) throw Error(`Invalid B3 puppet joint ${name}`);
    }
  }
  if (layer.poses[0].t !== 0) throw Error('B3 puppet must establish its starting pose at t=0');
}

export function puppetJoints(layer, t) {
  const poses = layer.poses;
  if (t <= poses[0].t) return poses[0].joints;
  if (t >= poses.at(-1).t) return poses.at(-1).joints;
  const i = poses.findIndex(p => p.t > t), a = poses[i - 1], b = poses[i];
  let k = (t - a.t) / (b.t - a.t);
  k = k * k * (3 - 2 * k);
  return Object.fromEntries(JOINTS.map(name => [name, [0, 1].map(axis => a.joints[name][axis] + (b.joints[name][axis] - a.joints[name][axis]) * k)]));
}

export function drawPuppet(ctx, layer, t) {
  const j = puppetJoints(layer, t), color = layer.color || '#fafafa', outline = '#050505';
  if (layer.appearance === 'pictogram_female' || layer.appearance === 'pictogram_male') {
    drawPictogram(ctx, layer, j, color, outline);
    return;
  }
  const stroke = (points, width) => {
    ctx.beginPath(); ctx.moveTo(...j[points[0]]);
    for (const name of points.slice(1)) ctx.lineTo(...j[name]);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = outline; ctx.lineWidth = width + 14; ctx.stroke();
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
  };
  const dot = (name, radius) => {
    ctx.beginPath(); ctx.arc(...j[name], radius + 7, 0, Math.PI * 2); ctx.fillStyle = outline; ctx.fill();
    ctx.beginPath(); ctx.arc(...j[name], radius, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
  };
  ctx.save();
  if (layer.occludeBelow !== undefined) {
    ctx.beginPath(); ctx.rect(-5000,-5000,10000,5000 + layer.occludeBelow); ctx.clip();
  }
  stroke(['head', 'neck'], 54);
  ctx.beginPath(); ctx.moveTo(...j.shoulderL); ctx.lineTo(...j.shoulderR);
  ctx.lineTo(...j.hipR); ctx.lineTo(...j.hipL); ctx.closePath();
  ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = outline; ctx.lineWidth = 14; ctx.stroke();
  if (layer.appearance === 'cat_archivist') {
    ctx.beginPath(); ctx.moveTo(...j.shoulderL); ctx.lineTo(...j.neck); ctx.lineTo(j.hipL[0],j.hipL[1]); ctx.closePath();
    ctx.fillStyle = '#bdbdbd'; ctx.fill(); ctx.strokeStyle = outline; ctx.lineWidth = 5; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(...j.shoulderR); ctx.lineTo(...j.neck); ctx.lineTo(j.hipR[0],j.hipR[1]); ctx.closePath();
    ctx.fillStyle = '#d9d9d9'; ctx.fill(); ctx.strokeStyle = outline; ctx.lineWidth = 5; ctx.stroke();
  }
  for (const side of ['L', 'R']) {
    stroke([`hip${side}`, `knee${side}`, `foot${side}`], 29);
    const [x, y] = j[`foot${side}`];
    ctx.beginPath(); ctx.moveTo(x - (side === 'L' ? 26 : 12), y + 5); ctx.lineTo(x + (side === 'L' ? 12 : 26), y + 5);
    ctx.strokeStyle = outline; ctx.lineWidth = 35; ctx.lineCap = 'round'; ctx.stroke();
    ctx.strokeStyle = color; ctx.lineWidth = 21; ctx.stroke();
  }
  ctx.restore();
  for (const side of ['L', 'R']) {
    stroke([`shoulder${side}`, `elbow${side}`, `hand${side}`], 27);
    dot(`hand${side}`, 17);
  }
  if (layer.appearance === 'cat_archivist') {
    const [x, y] = j.head;
    // Shoulder-length gray hair reads as a woman host at portrait phone scale.
    // It sits behind the solid feline face and keeps the ears unobstructed.
    ctx.beginPath(); ctx.moveTo(x - 70,y - 60);
    ctx.quadraticCurveTo(x - 112,y + 16,x - 93,y + 138);
    ctx.lineTo(x - 37,y + 141); ctx.lineTo(x - 48,y + 45);
    ctx.lineTo(x + 48,y + 45); ctx.lineTo(x + 37,y + 141);
    ctx.lineTo(x + 93,y + 138);
    ctx.quadraticCurveTo(x + 112,y + 16,x + 70,y - 60);
    ctx.closePath(); ctx.fillStyle = '#777777'; ctx.fill();
    ctx.strokeStyle = outline; ctx.lineWidth = 12; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 69,y - 48); ctx.lineTo(x - 60,y - 105);
    ctx.lineTo(x - 24,y - 75); ctx.quadraticCurveTo(x,y - 83,x + 24,y - 75);
    ctx.lineTo(x + 60,y - 105); ctx.lineTo(x + 69,y - 48);
    ctx.quadraticCurveTo(x + 83,y + 9,x + 59,y + 55);
    ctx.quadraticCurveTo(x + 39,y + 78,x,y + 78);
    ctx.quadraticCurveTo(x - 39,y + 78,x - 59,y + 55);
    ctx.quadraticCurveTo(x - 83,y + 9,x - 69,y - 48); ctx.closePath();
    ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = outline; ctx.lineWidth = 16; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x,y + 27,47,26,0,0,Math.PI * 2);
    ctx.fillStyle = '#d6d6d6'; ctx.fill(); ctx.strokeStyle = outline; ctx.lineWidth = 5; ctx.stroke();
    for (const side of [-1,1]) {
      ctx.beginPath(); ctx.ellipse(x + side * 31,y - 18,12,10,side * .15,0,Math.PI * 2);
      ctx.fillStyle = outline; ctx.fill();
    }
    ctx.beginPath(); ctx.moveTo(x - 6,y + 20); ctx.lineTo(x + 6,y + 20); ctx.lineTo(x,y + 29); ctx.closePath();
    ctx.fillStyle = outline; ctx.fill();
  } else {
    ctx.beginPath(); ctx.arc(...j.head, 76, 0, Math.PI * 2);
    ctx.fillStyle = layer.headStyle === 'outline' ? '#06090d' : color; ctx.fill();
    ctx.strokeStyle = layer.headStyle === 'outline' ? color : outline;
    ctx.lineWidth = 17; ctx.stroke();
  }
}

function drawPictogram(ctx, layer, j, color, outline) {
  const side = layer.profileView === 'side';
  const male = layer.appearance === 'pictogram_male';
  const strokeLimb = (names, width) => {
    ctx.beginPath(); ctx.moveTo(...j[names[0]]);
    for (const name of names.slice(1)) ctx.lineTo(...j[name]);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = outline; ctx.lineWidth = width + 17; ctx.stroke();
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
  };
  ctx.save();
  if (layer.occludeBelow !== undefined) {
    ctx.beginPath(); ctx.rect(-5000,-5000,10000,5000 + layer.occludeBelow); ctx.clip();
  }
  for (const s of ['L','R']) {
    strokeLimb([`hip${s}`,`knee${s}`,`foot${s}`],side ? 47 : 52);
    const [x,y] = j[`foot${s}`];
    ctx.beginPath(); ctx.moveTo(x-22,y+3); ctx.lineTo(x+22,y+3);
    ctx.strokeStyle=outline;ctx.lineWidth=46;ctx.lineCap='round';ctx.stroke();
    ctx.strokeStyle=color;ctx.lineWidth=30;ctx.stroke();
  }
  if (side) strokeLimb(['shoulderL','elbowL','handL'],40);
  else for (const s of ['L','R']) strokeLimb([`shoulder${s}`,`elbow${s}`,`hand${s}`],44);
  strokeLimb(['neck','head'],55);
  const left=j.shoulderL,right=j.shoulderR,hipL=j.hipL,hipR=j.hipR;
  const shoulder=[(left[0]+right[0])/2,(left[1]+right[1])/2];
  const hip=[(hipL[0]+hipR[0])/2,(hipL[1]+hipR[1])/2];
  const torsoWidth=side?104:male?130:118;
  ctx.beginPath();ctx.moveTo(...shoulder);ctx.lineTo(...hip);
  ctx.lineCap='round';ctx.lineJoin='round';
  ctx.strokeStyle=outline;ctx.lineWidth=torsoWidth+17;ctx.stroke();
  ctx.strokeStyle=color;ctx.lineWidth=torsoWidth;ctx.stroke();
  if (side) strokeLimb(['shoulderR','elbowR','handR'],44);
  const [hx,hy]=j.head;
  ctx.beginPath();ctx.arc(hx,hy,65,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();
  ctx.strokeStyle=outline;ctx.lineWidth=17;ctx.stroke();
  if (side) {
    ctx.beginPath();ctx.arc(hx+42,hy-3,8,0,Math.PI*2);ctx.fillStyle=outline;ctx.fill();
  }
  ctx.restore();
}
