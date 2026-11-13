// A small B3 cutout rig. Complete joint poses interpolate with planted feet and
// attached hands; the story still chooses its objectives, contacts and holds.
export const JOINTS = ['head', 'neck', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'handL', 'handR', 'hipL', 'hipR', 'kneeL', 'kneeR', 'footL', 'footR'];

export function validatePuppet(layer, span) {
  if (!Array.isArray(layer.poses) || layer.poses.length < 2 || layer.poses.length > 12) throw Error('B3 puppet needs 2–12 complete poses');
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
  const j = puppetJoints(layer, t), color = layer.color || '#eff1ee';
  const stroke = (points, width) => {
    ctx.beginPath(); ctx.moveTo(...j[points[0]]);
    for (const name of points.slice(1)) ctx.lineTo(...j[name]);
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
  };
  const dot = (name, radius) => {
    ctx.beginPath(); ctx.arc(...j[name], radius, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
  };
  ctx.save();
  if (layer.occludeBelow !== undefined) {
    ctx.beginPath(); ctx.rect(-5000,-5000,10000,5000 + layer.occludeBelow); ctx.clip();
  }
  stroke(['head', 'neck'], 54);
  ctx.beginPath(); ctx.moveTo(...j.shoulderL); ctx.lineTo(...j.shoulderR);
  ctx.lineTo(...j.hipR); ctx.lineTo(...j.hipL); ctx.closePath();
  ctx.fillStyle = color; ctx.fill();
  for (const side of ['L', 'R']) {
    stroke([`hip${side}`, `knee${side}`, `foot${side}`], 29);
    const [x, y] = j[`foot${side}`];
    ctx.beginPath(); ctx.moveTo(x - (side === 'L' ? 26 : 12), y + 5); ctx.lineTo(x + (side === 'L' ? 12 : 26), y + 5);
    ctx.strokeStyle = color; ctx.lineWidth = 21; ctx.lineCap = 'round'; ctx.stroke();
  }
  ctx.restore();
  for (const side of ['L', 'R']) {
    stroke([`shoulder${side}`, `elbow${side}`, `hand${side}`], 27);
    dot(`hand${side}`, 17);
  }
  ctx.beginPath(); ctx.arc(...j.head, 76, 0, Math.PI * 2);
  ctx.fillStyle = '#06090d'; ctx.fill(); ctx.strokeStyle = color; ctx.lineWidth = 17; ctx.stroke();
}
