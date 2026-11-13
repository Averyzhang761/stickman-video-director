import fs from 'node:fs';
import path from 'node:path';
import {loadProject, mediaPath, probe} from './autopilot-core.mjs';
import {walkLayers} from './b3-graphics.mjs';

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
  if (!p.score.length || new Set(p.score.map(s => s.source)).size < 2) fail('at least two distinct score segments required');
  if (score[0].start > .002 || score.at(-1).end < p.duration - .002) fail('score does not span the film');
  for (let i = 1; i < score.length; i++) if (score[i].start > score[i - 1].end + .002) fail('score has an uncovered gap');
  const actorShots = p.shots.filter(s => [...walkLayers(s.layers)].some(l => l.motion?.role === 'actor')).length;
  if (actorShots / p.shots.length < .2) fail(`actor performance is specified in only ${actorShots}/${p.shots.length} shots; author pose, gesture and contact changes in at least 20%`);
  const out = {valid: true, title: p.series.title, duration: p.duration, picture: `${p.width}x${p.height}`, cover: path.basename(cover), score_segments: score.length, actor_motion_shots: actorShots, voice_status: p.series.voice_status, delivery_ready: false, human_review: 'acting, music, captions, cover and rights remain required'};
  console.log(JSON.stringify(out, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
