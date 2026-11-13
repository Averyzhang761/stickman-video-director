// Reusable, provider-free B3 acting poses. A shot supplies a concrete action,
// target/contact point and story reason; this expands them into a joint timeline.
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';

const clone = p => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, [...v]]));
export function neutralPose() {
  return {head:[0,-545],neck:[0,-440],shoulderL:[-48,-421],shoulderR:[48,-421],
    elbowL:[-99,-319],elbowR:[99,-319],handL:[-105,-248],handR:[105,-248],
    hipL:[-32,-192],hipR:[32,-192],kneeL:[-42,-103],kneeR:[42,-103],footL:[-55,0],footR:[55,0]};
}
function lean(p, direction, amount) {
  for (const name of ['head','neck','shoulderL','shoulderR']) p[name][0] += direction * amount;
  for (const name of ['elbowL','elbowR','handL','handR']) p[name][0] += direction * amount * .7;
  for (const name of ['hipL','hipR']) p[name][0] += direction * amount * .2;
  return p;
}
function aim(p, side, target) {
  const sh = p[`shoulder${side}`], elbow = p[`elbow${side}`], hand = p[`hand${side}`];
  hand[0] = target[0]; hand[1] = target[1];
  elbow[0] = (sh[0] + target[0]) / 2 + (side === 'R' ? 55 : -55);
  elbow[1] = (sh[1] + target[1]) / 2 + 20;
  return p;
}
function posture(p, direction) {
  p.head[0] += direction * 22; p.head[1] += 12;
  p.handL[0] += 38; p.handL[1] -= 70;
  p.handR[0] -= 38; p.handR[1] -= 70;
  return p;
}
function bendDown(p) {
  for (const name of ['head','neck','shoulderL','shoulderR']) p[name][1] += 105;
  for (const name of ['elbowL','elbowR','handL','handR']) p[name][1] += 55;
  return p;
}
export function makePuppet(spec) {
  const {id, action, reason, x, y, scale, duration} = spec;
  if (!id || !reason || !['notice','inspect','reach','take','offer','turn','step','recoil','point','write','pull','listen'].includes(action)) throw Error('Acting needs id, concrete action and story reason');
  if (![x,y,scale,duration].every(Number.isFinite) || scale <= 0 || duration < .8) throw Error('Invalid acting position, scale or duration');
  if (['reach','take','offer','turn','point','write','pull'].includes(action) && (!Array.isArray(spec.target) || spec.target.length !== 2)) throw Error(`${action} needs a visible contact target`);
  const start = spec.startPose ? clone(spec.startPose) : neutralPose();
  const base = neutralPose(), direction = spec.facing === -1 ? -1 : 1;
  const target = spec.target ? [(spec.target[0] - x) / scale, (spec.target[1] - y) / scale] : [direction * 185,-360];
  if (target.some(n => !Number.isFinite(n))) throw Error('Invalid acting target');
  const side = target[0] < 0 ? 'L' : 'R';
  const p1 = clone(base), p2 = clone(base), p3 = clone(base), p4 = clone(base);
  if (['notice','inspect','listen'].includes(action)) {
    lean(p1,direction,18); lean(p2,direction,48); lean(p3,direction,65);
    p2.head[1] += action === 'inspect' ? 38 : 10; p3.head[1] += action === 'inspect' ? 60 : 18;
    p2[`hand${side}`][1] -= 95; p3[`hand${side}`][1] -= 130;
  } else if (['reach','take','offer','turn','point','write','pull'].includes(action)) {
    lean(p1,direction,24); lean(p2,direction,55); lean(p3,direction,55);
    if (target[1] > -220) { bendDown(p1); bendDown(p2); bendDown(p3); }
    const mid = [(target[0] + base[`hand${side}`][0]) / 2,(target[1] + base[`hand${side}`][1]) / 2];
    aim(p1,side,mid); aim(p2,side,target); aim(p3,side,target);
    if (action === 'reach') { aim(p3,side,[target[0] + direction * 24,target[1] - 12]); p3.head[0] += direction * 16; }
    if (action === 'take') { aim(p3,side,[direction * 65,-325]); lean(p3,direction,20); }
    if (action === 'turn') { aim(p3,side,[target[0] + direction * 42,target[1] + 24]); }
    if (action === 'write') { aim(p3,side,[target[0] + direction * 45,target[1] + 14]); }
    if (action === 'point') { aim(p3,side,[target[0] + direction * 46,target[1] + 8]); p3.head[0] += direction * 18; }
    if (action === 'pull') { lean(p3,-direction,42); aim(p3,side,[target[0] - direction * 90,target[1] + 25]); }
    if (action === 'offer') { lean(p3,direction,75); }
  } else if (action === 'recoil') {
    lean(p1,-direction,22); posture(p2,-direction); lean(p2,-direction,65);
    posture(p3,-direction); lean(p3,-direction,85);
    p3[`foot${side}`][0] -= direction * 62; p3[`knee${side}`][0] -= direction * 40;
  } else if (action === 'step') {
    p1[`foot${side}`][1] -= 65; p1[`knee${side}`][1] -= 43;
    p2[`foot${side}`][0] += direction * 120; p2[`foot${side}`][1] -= 75;
    p2[`knee${side}`][0] += direction * 60; p2[`knee${side}`][1] -= 42;
    p3[`foot${side}`][0] += direction * 125; p3[`knee${side}`][0] += direction * 65;
    lean(p3,direction,58);
  }
  Object.assign(p4,clone(p3));
  const beat = [0,.2,.53,.79,.96].map(q => Math.round(duration * q * 1000) / 1000);
  const poses = [start,p1,p2,p3,p4].map((joints,i) => ({t:beat[i],joints}));
  return {type:'puppet',id,x,y,scaleX:scale,scaleY:scale,poses,
    ...(spec.appearance ? {appearance:spec.appearance} : {}),
    ...(spec.headStyle ? {headStyle:spec.headStyle} : {}),
    motion:{role:'actor',reason,action,objective:spec.objective || reason,target:spec.target || null}};
}

if (process.argv[1] && fs.existsSync(process.argv[1]) && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  const input = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const last = new Map();
  const layers = input.map(spec => {
    const puppet = makePuppet({...spec, ...(spec.carryKey && last.has(spec.carryKey) ? {startPose:last.get(spec.carryKey)} : {})});
    if (spec.carryKey) last.set(spec.carryKey,puppet.poses.at(-1).joints);
    return puppet;
  });
  fs.writeFileSync(process.argv[3], JSON.stringify(layers, null, 2) + '\n');
}
