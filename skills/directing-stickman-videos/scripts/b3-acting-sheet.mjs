import fs from 'node:fs';
import path from 'node:path';
import {createCanvas, loadImage} from '@napi-rs/canvas';
import {loadProject} from './autopilot-core.mjs';
import {painter} from './autopilot-render.mjs';
import {walkLayers} from './b3-graphics.mjs';

const [projectFile, directory] = process.argv.slice(2);
if (!projectFile || !directory) throw Error('Usage: node scripts/b3-acting-sheet.mjs PROJECT OUTPUT_DIR');
const p = loadProject(projectFile);
if (p.style !== 'B3') throw Error('Acting sheets require B3');
fs.mkdirSync(directory, {recursive:true});
const frame = await painter(p);
const selected = p.shots.map((shot,index) => ({shot,index})).filter(({shot}) => [...walkLayers(shot.layers)].some(l => l.motion?.role === 'actor'));
const index = [];
for (let offset = 0; offset < selected.length; offset += 4) {
  const page = Math.floor(offset / 4) + 1, rows = selected.slice(offset, offset + 4);
  const sheet = createCanvas(900, 2200), ctx = sheet.getContext('2d');
  ctx.fillStyle = '#202328'; ctx.fillRect(0, 0, 900, 2200);
  for (const [row,{shot, index: shotIndex}] of rows.entries()) {
    const times = [.04,.53,.90].map(f => shot.start + (shot.end - shot.start) * f);
    for (const [column,t] of times.entries()) {
      const still = await loadImage(frame(t).toBuffer('image/png'));
      ctx.drawImage(still,column * 300,row * 550,300,533);
    }
    ctx.fillStyle = '#f4f5f5'; ctx.font = '17px sans-serif';
    ctx.fillText(`SHOT ${shotIndex}   ${shot.start.toFixed(2)}–${shot.end.toFixed(2)}s   BEFORE / CONTACT / SETTLE`,8,row * 550 + 545);
    index.push({page,shot:shotIndex,start:shot.start,end:shot.end,times});
  }
  fs.writeFileSync(path.join(directory,`acting-sheet-${String(page).padStart(2,'0')}.png`),sheet.toBuffer('image/png'));
}
fs.writeFileSync(path.join(directory,'index.json'),JSON.stringify(index,null,2) + '\n');
console.log(JSON.stringify({shots:selected.length,pages:Math.ceil(selected.length/4),directory:path.resolve(directory)}));
