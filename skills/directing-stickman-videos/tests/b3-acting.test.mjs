import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas} from '@napi-rs/canvas';
import {makePuppet, neutralPose} from '../scripts/b3-acting.mjs';
import {validatePuppet, puppetJoints, drawPuppet} from '../scripts/b3-puppet.mjs';

test('B3 people have solid heads unless an outline is explicitly requested', () => {
  const p = makePuppet({id:'solid', action:'notice', reason:'see the receipt', objective:'read it', x:250, y:600, scale:1, duration:5});
  p.color = '#fafafa';
  const canvas = createCanvas(500, 700), ctx = canvas.getContext('2d');
  ctx.translate(250, 600); drawPuppet(ctx, p, 0);
  assert.deepEqual([...ctx.getImageData(250, 55, 1, 1).data], [250, 250, 250, 255]);
  p.headStyle = 'outline';
  ctx.clearRect(-250, -600, 500, 700); drawPuppet(ctx, p, 0);
  assert.deepEqual([...ctx.getImageData(250, 55, 1, 1).data], [6, 9, 13, 255]);
  p.headStyle = 'cat';
  assert.throws(() => validatePuppet(p, 5), /head style/);
  p.headStyle = 'solid'; p.appearance = 'cat_archivist';
  assert.doesNotThrow(() => validatePuppet(p, 5));
  p.appearance = 'catgirl';
  assert.throws(() => validatePuppet(p, 5), /appearance/);
});

test('reach makes hand contact while both feet remain planted', () => {
  const p = makePuppet({id:'reach', action:'reach', reason:'take the slip', objective:'retrieve proof', x:400, y:1700, scale:1, duration:5, target:[560,1500], appearance:'cat_archivist'});
  validatePuppet(p, 5);
  assert.equal(p.appearance, 'cat_archivist');
  const contact = puppetJoints(p, p.poses[2].t);
  assert.ok(Math.hypot(contact.handR[0] - 160, contact.handR[1] + 200) < 1);
  assert.deepEqual(contact.footL, neutralPose().footL);
  assert.deepEqual(contact.footR, neutralPose().footR);
});

test('step lifts one foot and lands it while the support foot stays fixed', () => {
  const p = makePuppet({id:'step', action:'step', reason:'approach the door', objective:'cross the threshold', x:400, y:1700, scale:1, duration:5});
  validatePuppet(p, 5);
  assert.ok(p.poses[2].joints.footR[1] < -50);
  assert.ok(p.poses[3].joints.footR[0] > 100);
  assert.equal(p.poses[3].joints.footR[1], 0);
  assert.deepEqual(p.poses[2].joints.footL, neutralPose().footL);
});

test('carried pose starts continuously without accumulating a previous lean', () => {
  const first = makePuppet({id:'a', action:'notice', reason:'see the receipt', objective:'read it', x:400, y:1700, scale:1, duration:5});
  const second = makePuppet({id:'b', action:'notice', reason:'see the date', objective:'check it', x:400, y:1700, scale:1, duration:5, startPose:first.poses.at(-1).joints});
  assert.deepEqual(second.poses[0].joints, first.poses.at(-1).joints);
  assert.deepEqual(second.poses.at(-1).joints.head, first.poses.at(-1).joints.head);
});
