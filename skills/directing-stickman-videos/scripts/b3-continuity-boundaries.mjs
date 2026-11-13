import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import sharp from 'sharp';

const [video, projectFile, planFile, output] = process.argv.slice(2);
if (!video || !projectFile || !planFile || !output) throw Error('usage: b3-continuity-boundaries.mjs VIDEO PROJECT PLAN OUTPUT.jpg');
const project = JSON.parse(fs.readFileSync(projectFile, 'utf8'));
const plan = JSON.parse(fs.readFileSync(planFile, 'utf8'));
const targets = new Set();
for (const track of plan.tracks || []) {
  for (const instance of track.instances || []) if (instance.reason || instance.shot > 0) targets.add(instance.shot);
  for (const run of track.motion_runs || []) for (const shot of run.shots.slice(1)) targets.add(shot);
}
const shots = [...targets].filter(index => index > 0 && index < project.shots.length).sort((a,b) => a-b);
if (!shots.length) throw Error('no tracked cuts');
function frame(time) {
  const result = spawnSync('ffmpeg',['-v','error','-ss',String(Math.max(0,time)),'-i',video,'-frames:v','1','-vf','scale=240:427','-f','image2pipe','-vcodec','png','-'],{maxBuffer:8*1024*1024});
  if (result.status !== 0) throw Error(result.stderr.toString() || `ffmpeg failed at ${time}`);
  return result.stdout;
}
const rowHeight = 457;
const width = 520;
const composites = [];
for (const [row,index] of shots.entries()) {
  const time = project.shots[index].start;
  const before = frame(time-.08), after = frame(time+.08);
  composites.push({input:before,left:10,top:row*rowHeight+25},{input:after,left:270,top:row*rowHeight+25});
  const label = Buffer.from(`<svg width="520" height="25"><text x="10" y="19" fill="white" font-size="16" font-family="Arial">CUT ${index}  ${time.toFixed(2)}s   before / after</text></svg>`);
  composites.push({input:label,left:0,top:row*rowHeight});
}
await sharp({create:{width,height:shots.length*rowHeight,channels:3,background:'#111111'}})
  .composite(composites).jpeg({quality:85}).toFile(output);
console.log(JSON.stringify({cuts:shots.length,output}));
