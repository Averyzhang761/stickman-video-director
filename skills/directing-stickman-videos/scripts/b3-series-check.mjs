import fs from 'node:fs';
import path from 'node:path';
import {loadProject, mediaPath, probe} from './autopilot-core.mjs';
import {walkLayers} from './b3-graphics.mjs';
import {makeSeriesBug} from './b3-series-bug.mjs';

function fail(message) { throw new Error(`B3 series: ${message}`); }
const file = process.argv[2];
if (!file || process.argv.length !== 3) fail('usage: node scripts/b3-series-check.mjs PROJECT');

try {
  const p = loadProject(file);
  if (p.style !== 'B3') fail('project must use B3');
  if (p.duration < 480 || p.duration > 540) fail('narration-led duration must be 8–9 minutes');
  if (p.width * 16 !== p.height * 9) fail('picture must be native 9:16');
  if (!p.series || typeof p.series !== 'object') fail('series metadata required');
  if (typeof p.series.title !== 'string' || !p.series.title.trim()) fail('title required');
  let bug;
  try { bug = makeSeriesBug({fileNumber:p.series.file_number,channelName:p.series.channel_name}); }
  catch { fail('series.channel_name and series.file_number are required'); }
  for (const shot of p.shots.filter(s => !['universal_outro','end_card'].includes(s.kind))) {
    if (!shot.layers.some(l => l.type === 'text' && l.screenFixed && l.text === bug.text))
      fail(`story shot at ${shot.start}s lacks the current file/channel identifier`);
  }
  if (!['placeholder', 'approved'].includes(p.series.voice_status)) fail('voice_status must be placeholder or approved');
  const score = [...p.score].sort((a, b) => a.start - b.start);
  const local = name => {
    if (typeof name !== 'string' || path.isAbsolute(name)) fail('episode assets must use relative paths');
    const resolved = mediaPath(p.base, name);
    const relative = path.relative(p.base, resolved);
    if (relative.startsWith('..' + path.sep) || relative === '..') fail('episode assets must stay inside the project');
    return resolved;
  };
  local(p.voice.path);
  for (const track of [...(p.ambience || []), ...score]) local(track.path);
  const script = local(p.series.script);
  if (!fs.readFileSync(script, 'utf8').trim()) fail('script is empty');
  const cover = local(p.series.cover);
  const coverStream = probe(cover).streams.find(s => s.codec_type === 'video');
  if (coverStream?.width !== 1080 || coverStream?.height !== 1920) fail('cover must be 1080×1920');
  const ledger = JSON.parse(fs.readFileSync(local(p.series.acting_ledger), 'utf8'));
  if (!Array.isArray(ledger)) fail('acting_ledger must be an array');
  if (!p.score.length || new Set(p.score.map(s => s.source)).size < 2) fail('at least two distinct score segments required');
  if (score[0].start > .002 || score.at(-1).end < p.duration - .002) fail('score does not span the film');
  for (let i = 1; i < score.length; i++) if (score[i].start > score[i - 1].end + .002) fail('score has an uncovered gap');
  const actors = p.shots.flatMap(s => [...walkLayers(s.layers)].filter(l => l.motion?.role === 'actor'));
  const actorShots = p.shots.filter(s => [...walkLayers(s.layers)].some(l => l.motion?.role === 'actor')).length;
  if (actorShots / p.shots.length < .5) fail(`actor performance is specified in only ${actorShots}/${p.shots.length} shots; plan story actions in at least half`);
  if (ledger.length < actors.length) fail('acting ledger omits actor performances');
  if (actors.some(l => !l.motion.action || !l.motion.objective || !l.motion.reason)) fail('every actor motion needs an action, objective and reason');
  const contacts = new Set(['reach','take','offer','turn','point','write','pull']);
  const contactActors = actors.filter(l => contacts.has(l.motion.action));
  if (contactActors.length / p.shots.length < .15) fail('too few contact-driven performances for this suspense series');
  for (const l of contactActors) {
    if (!Array.isArray(l.motion.target) || l.motion.target.length !== 2) fail('contact action needs a visible target');
    if (l.type === 'puppet') {
      const joints = l.poses[2]?.joints;
      const distance = side => Math.hypot(l.x + joints[`hand${side}`][0] * l.scaleX - l.motion.target[0], l.y + joints[`hand${side}`][1] * l.scaleY - l.motion.target[1]);
      if (!joints || Math.min(distance('L'), distance('R')) > 30) fail(`puppet ${l.id} misses its declared contact point`);
    }
  }
  const out = {valid: true, title: p.series.title, channel_name:p.series.channel_name, file_number:p.series.file_number, duration: p.duration, picture: `${p.width}x${p.height}`, cover: path.basename(cover), score_segments: score.length, actor_motion_shots: actorShots, contact_performances: contactActors.length, acting_ledger_entries: ledger.length, voice_status: p.series.voice_status, delivery_ready: false, human_review: 'acting, music, captions, cover and rights remain required'};
  console.log(JSON.stringify(out, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
