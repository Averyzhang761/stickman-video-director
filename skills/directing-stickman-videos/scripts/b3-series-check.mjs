import fs from 'node:fs';
import path from 'node:path';
import {loadProject, mediaPath, probe} from './autopilot-core.mjs';
import {walkLayers} from './b3-graphics.mjs';
import {makeSeriesBug} from './b3-series-bug.mjs';
import {reconcileProps} from './b3-prop-continuity.mjs';

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
  const chapters=p.series.chapters;
  if(p.series.character_style==='solid_pictogram_v1') {
    for(const [index,shot] of p.shots.entries()) for(const layer of shot.layers) {
      if(layer.type==='puppet'&&(!['pictogram_female','pictogram_male'].includes(layer.appearance)||layer.color!=='#fafafa'||layer.headStyle!=='solid'))
        fail(`shot ${index} has a puppet outside the locked white-fill/black-outline character style`);
    }
  }
  if(!Array.isArray(chapters)||!chapters.length||chapters[0].shot!==0||chapters.length>12||
    chapters.some((c,i)=>!Number.isInteger(c.shot)||c.shot<0||c.shot>=p.shots.length||
      (i>0&&c.shot<=chapters[i-1].shot)||!c.title))fail('ordered story chapter starts are required');
  let activeChapter=0;
  for (const [index,shot] of p.shots.entries()) {
    if(['universal_outro','end_card'].includes(shot.kind))continue;
    if(activeChapter+1<chapters.length&&index===chapters[activeChapter+1].shot)activeChapter++;
    if (!shot.layers.some(l => l.type === 'text' && l.screenFixed && l.text === bug.text))
      fail(`story shot at ${shot.start}s lacks the current file/channel identifier`);
    if (index === chapters[activeChapter].shot) {
      const card = shot.layers.filter(l => l.seriesChrome === 'chapter_card_file');
      const expected = String(p.series.file_number).padStart(3, '0');
      if (card.length !== 1 || card[0].text !== expected)
        fail(`chapter card at ${shot.start}s must show FILE ${expected}, not its chapter number`);
    }
    const boxes=shot.layers.filter(l=>l.seriesChrome==='chapter_progress'&&l.type==='rect');
    if(boxes.length!==chapters.length||boxes.filter(l=>l.fill==='#fafafa').length!==1||
      boxes[activeChapter].fill!=='#fafafa'||boxes.some(l=>!l.screenFixed))
      fail(`story shot at ${shot.start}s lacks its current chapter progress boxes`);
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
  if (p.series.profile_cover) {
    const profileStream = probe(local(p.series.profile_cover)).streams.find(s => s.codec_type === 'video');
    if (profileStream?.width !== 1080 || profileStream?.height !== 1440) fail('profile cover must be 1080×1440');
  }
  const ledger = JSON.parse(fs.readFileSync(local(p.series.acting_ledger), 'utf8'));
  if (!Array.isArray(ledger)) fail('acting_ledger must be an array');
  if (!p.series.prop_continuity) fail('series.prop_continuity ledger required before rendering');
  const plan = JSON.parse(fs.readFileSync(local(p.series.prop_continuity), 'utf8'));
  if (!Array.isArray(plan.tracks) || !plan.tracks.length) fail('prop continuity ledger needs tracked story elements');
  const continuity = reconcileProps(p, plan);
  if (!continuity.valid) fail(`prop continuity failed: ${continuity.problems.join('; ')}`);
  if (!p.score.length || new Set(p.score.map(s => s.path)).size < 2) fail('at least two distinct score segments required');
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
  const out = {valid: true, title: p.series.title, channel_name:p.series.channel_name, file_number:p.series.file_number, chapter_count:chapters.length, chapter_guidance:chapters.length>=7&&chapters.length<=9?'within preferred 7–9 for 8–9 minutes':'review the story beats; 7–9 is preferred, not required', duration: p.duration, picture: `${p.width}x${p.height}`, cover: path.basename(cover), ...(p.series.profile_cover ? {profile_cover:p.series.profile_cover} : {}), score_segments: score.length, actor_motion_shots: actorShots, contact_performances: contactActors.length, acting_ledger_entries: ledger.length, voice_status: p.series.voice_status, delivery_ready: false, human_review: 'acting, music, captions, cover and rights remain required'};
  console.log(JSON.stringify(out, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
