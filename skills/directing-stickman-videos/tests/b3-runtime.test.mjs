import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createCanvas} from '@napi-rs/canvas';
import {ROOT, FFMPEG, run, save, loadProject, hashFile} from '../scripts/autopilot-core.mjs';
import {painter, render} from '../scripts/autopilot-render.mjs';
import {validateB3} from '../scripts/b3-graphics.mjs';
import {makeChapterCard} from '../scripts/b3-chapter-card.mjs';
import {makeChapterProgress,stampSeriesChrome} from '../scripts/b3-chapter-progress.mjs';
import {makeOpeningSignal} from '../scripts/b3-opening-signal.mjs';
import {makeUniversalOutro} from '../scripts/b3-universal-outro.mjs';
import {buildOutroProject} from '../scripts/b3-build-outro-project.mjs';
import {finishSuspenseSeries} from '../scripts/b3-series-finish.mjs';
import {lockCharacterStyle} from '../scripts/b3-lock-character-style.mjs';
import {makeSeriesBug, stampSeriesBug} from '../scripts/b3-series-bug.mjs';
import {neutralPose} from '../scripts/b3-acting.mjs';
import {drawPuppet,validatePuppet} from '../scripts/b3-puppet.mjs';

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stickman-b3-test-'));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  run(FFMPEG, ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=310:duration=0.85', '-y', path.join(dir, 'voice.wav')]);
  const project = {version: 1, style: 'B3', width: 640, height: 360, fps: 12,
    television: {enabled: false}, voice: {path: 'voice.wav'},
    ambience: [{path: 'voice.wav', start: 0, end: .85, gain: .01}], // Offline synthetic bed only.
    captions: [{start: 0.1, end: 0.75, text: 'A local interaction.'}],
    shots: [{start: 0, end: 0.85, layers: [
      {type: 'group', x: 100, y: 100, alpha: 0.5, children: [
        {type: 'rect', w: 80, h: 80, fill: '#ffffff', keys: [{t: 0, x: 0}, {t: 0.4, x: 100}]},
        {type: 'ellipse', x: 240, y: 0, w: 80, h: 80, fill: '#b8bcc1'}]},
      {type: 'path', x: 500, y: 200, fill: 'none', stroke: '#ffffff', lineWidth: 8,
        commands: [['M', 0, 0], ['Q', 60, -80, 120, 0], ['C', 130, 20, 150, 20, 160, 0]]}
    ]}], sfx: [{time: 0.2, kind: 'tap', gain: 0.02}]};
  const file = path.join(dir, 'project.json'); save(file, project);
  return {dir, project, file};
}
const pixel = (canvas, x, y) => [...canvas.getContext('2d').getImageData(x, y, 1, 1).data];

test('B3 draws independent group-local motion, inherited alpha and foreground occlusion', async t => {
  const f = fixture(t); let draw = await painter(loadProject(f.file));
  assert.deepEqual(pixel(draw(0), 5, 5), [17, 19, 22, 255]);
  const first = pixel(draw(0), 60, 60);
  assert.ok(first[0] > 120 && first[0] < 150, 'Parent alpha must be inherited, not overwritten');
  assert.deepEqual(pixel(draw(0.4), 60, 60), [17, 19, 22, 255]);
  assert.deepEqual(pixel(draw(0.4), 110, 60), first, 'Child moves in its own group coordinates');
  f.project.shots[0].layers.push({type: 'rect', x: 200, y: 100, w: 80, h: 80, fill: '#303236'});
  save(f.file, f.project); draw = await painter(loadProject(f.file));
  assert.deepEqual(pixel(draw(0.4), 110, 60), [48, 50, 54, 255], 'Later foreground layer hides the moving subject');
});

test('B3 pivots/scales without stretching the untouched subject', async t => {
  const f = fixture(t);
  f.project.shots[0].layers = [{type: 'group', x: 200, y: 120, pivotX: 40, pivotY: 40, angle: Math.PI,
    children: [{type: 'rect', w: 40, h: 40, fill: '#ffffff'}]}];
  save(f.file, f.project); const draw = await painter(loadProject(f.file));
  assert.deepEqual(pixel(draw(0), 130, 90), [255, 255, 255, 255]);
  assert.deepEqual(pixel(draw(0), 110, 70), [17, 19, 22, 255]);
});

test('B3 treatment changes the scene but leaves clean caption pixels unchanged', async t => {
  const f = fixture(t); f.project.shots[0].layers.push({type: 'rect', x: 400, y: 200, w: 100, h: 100, fill: '#ffffff'});
  save(f.file, f.project); const clean = await painter(loadProject(f.file));
  const a = Buffer.from(clean(0.3).data());
  f.project.television = {enabled: true, intensity: 0.8}; save(f.file, f.project);
  const treated = await painter(loadProject(f.file)); const b = Buffer.from(treated(0.3).data());
  assert.notDeepEqual(a, b);
  let ink = 0;
  for (let y = 319; y < 341; y++) for (let x = 170; x < 470; x++) {
    const i = (y * 640 + x) * 4;
    if (a[i] === 244 && a[i + 1] === 245) { ink++; assert.deepEqual(b.subarray(i, i + 4), a.subarray(i, i + 4)); }
  }
  assert.ok(ink > 50, 'White caption ink is composited after television treatment');
});

test('B3 camera pushes artwork while screen-fixed UI holds its position', async t => {
  const f = fixture(t);
  f.project.shots[0].camera = {from: 1, to: 1.12, pivotX: 640, pivotY: 360};
  f.project.shots[0].layers = [
    {type: 'rect', x: 800, y: 200, w: 100, h: 100, fill: '#ffffff'},
    {type: 'rect', x: 100, y: 100, w: 100, h: 100, fill: '#ff0000', screenFixed: true}
  ];
  save(f.file, f.project); const draw = await painter(loadProject(f.file));
  const first = Buffer.from(draw(0).data()), last = Buffer.from(draw(0.8).data());
  assert.notDeepEqual(first, last, 'Scene artwork should push in');
  const patch = bytes => Buffer.concat(Array.from({length: 65}, (_, row) =>
    bytes.subarray(((45 + row) * 640 + 45) * 4, ((45 + row) * 640 + 110) * 4)));
  assert.deepEqual(patch(first), patch(last), 'Screen-fixed UI must not drift');
  f.project.shots[0].camera.to = 2;
  save(f.file, f.project); assert.throws(() => loadProject(f.file), /camera to/);
});

test('B3 signal grain is frame-varying and reproducible', async t => {
  const f = fixture(t);
  f.project.television = {enabled: true, intensity: 1, grain: 1, flicker: 1,
    events: [{time: .333, kind: 'line'}]};
  save(f.file, f.project); const draw = await painter(loadProject(f.file));
  const first = Buffer.from(draw(.2).data());
  assert.deepEqual(first, Buffer.from(draw(.2).data()));
  assert.notDeepEqual(first, Buffer.from(draw(.3).data()));
  assert.throws(() => validateB3(f.project.shots[0].layers, {events: [{time: .2, kind: 'unknown'}]}), /event/);
});

test('B3 snow burst appears only on declared frames', async t => {
  const f = fixture(t);
  f.project.shots[0].layers = [{type: 'rect', x: 400, y: 200, w: 100, h: 100, fill: '#ffffff'}];
  f.project.television = {enabled: true, intensity: 1, grain: 0, flicker: 0,
    events: [{time: .333, kind: 'snow', frames: 3}]};
  save(f.file, f.project); const draw = await painter(loadProject(f.file));
  const clean = Buffer.from(draw(.15).data());
  assert.deepEqual(clean, Buffer.from(draw(.583).data()), 'No signal texture outside the event');
  assert.notDeepEqual(clean, Buffer.from(draw(.333).data()), 'Signal burst must be visible at its cue');
  assert.notDeepEqual(Buffer.from(draw(.333).data()), Buffer.from(draw(.417).data()), 'Burst frames should differ');
  assert.throws(() => validateB3(f.project.shots[0].layers,
    {events: [{time: .2, kind: 'snow', frames: 13}]}), /frames/);
  assert.throws(() => validateB3(f.project.shots[0].layers,
    {events: [{time: .2, kind: 'snow', frames: 8, strength: 2.1}]}), /strength/);
  assert.doesNotThrow(() => validateB3(f.project.shots[0].layers,
    {events: [{time: 0, kind: 'snow', frames: 8, strength: 1.7}]}));
});

test('B3 object glow lights only the nearby scene', async t => {
  const f = fixture(t);
  f.project.shots[0].layers = [{type: 'rect', x: 300, y: 200, w: 40, h: 40,
    fill: '#ffffff', glow: 55, glowColor: '#e7c86d'}];
  save(f.file, f.project); const draw = await painter(loadProject(f.file));
  const lit = draw(.2);
  assert.ok(pixel(lit, 140, 111)[0] > 17, 'Object light should spill beyond its outline');
  assert.deepEqual(pixel(lit, 5, 5), [17, 19, 22, 255], 'Far background should stay dark');
  assert.throws(() => validateB3([{type: 'rect', w: 10, h: 10, glow: 201}]), /glow/);
});

test('B3 chapter card supplies a bounded progress marker', () => {
  const layers = makeChapterCard({number: 2, total: 8, title: 'THE LOSSES', until: 1.4});
  assert.equal(layers.length, 22);
  assert.ok(layers.every(l => l.screenFixed && l.to === 1.4));
  assert.equal(layers.filter(l => l.type === 'rect' && l.fill === '#fafafa').length, 2);
  assert.doesNotThrow(() => validateB3(layers));
  assert.throws(() => makeChapterCard({number: 9, total: 8, title: 'BAD'}), /number/);
});

test('B3 pictogram actor has a filled torso and two visible feet', () => {
  const joints=neutralPose();
  for(const appearance of ['pictogram_female','pictogram_male']){
    const layer={type:'puppet',appearance,profileView:'front',color:'#fafafa',
      poses:[{t:0,joints},{t:1,joints}]};
    assert.doesNotThrow(()=>validatePuppet(layer,1));
    const canvas=createCanvas(640,800),ctx=canvas.getContext('2d');
    ctx.fillStyle='#020202';ctx.fillRect(0,0,640,800);
    ctx.save();ctx.translate(320,680);drawPuppet(ctx,layer,0);ctx.restore();
    const value=(x,y)=>ctx.getImageData(x,y,1,1).data[0];
    assert.ok(value(320,350)>180,'torso is filled');
    assert.ok(value(265,680)>180,'left foot is visible');
    assert.ok(value(375,680)>180,'right foot is visible');
    assert.ok(value(320,680)<50,'legs remain distinct');
  }
});

test('B3 character lock fixes both roles without changing animation or props', () => {
  const pose={t:0,joints:neutralPose()};
  const project={shots:[{layers:[
    {type:'puppet',id:'she',appearance:'plain',color:'#aaaaaa',poses:[pose]},
    {type:'puppet',id:'he',characterGender:'male',appearance:'plain',poses:[pose]},
    {type:'rect',id:'prop',fill:'#aaaaaa'}]}]};
  const out=lockCharacterStyle(project);
  assert.equal(out.shots[0].layers[0].appearance,'pictogram_female');
  assert.equal(out.shots[0].layers[1].appearance,'pictogram_male');
  assert.ok(out.shots[0].layers.slice(0,2).every(l=>l.color==='#fafafa'&&l.headStyle==='solid'));
  assert.deepEqual(out.shots[0].layers[0].poses,[pose]);
  assert.deepEqual(out.shots[0].layers[2],project.shots[0].layers[2]);
  assert.equal(project.shots[0].layers[0].appearance,'plain');
});

test('B3 chapter boxes persist across story shots and follow actual chapter starts', () => {
  const project={style:'B3',fps:24,series:{},shots:Array.from({length:4},(_,i)=>({
    start:i*2,end:(i+1)*2,layers:[{type:'rect',x:0,y:0,w:1280,h:2276,fill:'#020202'}]}))};
  const chapters=[{shot:0,title:'THE SLIP'},{shot:2,title:'THE LOSSES'}];
  const out=finishSuspenseSeries(project,{channelName:'Index Nine',fileNumber:1,chapters});
  assert.deepEqual(out.series.chapters,chapters);
  for(const [i,shot] of out.shots.entries()){
    const boxes=shot.layers.filter(l=>l.seriesChrome==='chapter_progress'&&l.type==='rect');
    assert.equal(boxes.length,2);
    assert.equal(boxes.findIndex(l=>l.fill==='#fafafa'),i<2?0:1);
    assert.equal(shot.layers.filter(l=>l.text==='FILE 001  //  INDEX NINE').length,1);
    assert.ok(boxes.every(l=>l.screenFixed));
  }
  assert.equal(out.shots[0].layers.at(-1).to,8/24,'opening fault still covers the first frames');
  assert.equal(out.shots[2].layers.at(-1).seriesChrome,'chapter_progress',
    'persistent boxes remain visible on the chapter card');
  assert.equal(makeChapterProgress({number:7,total:9}).filter(l=>l.type==='rect').length,9);
  assert.throws(()=>stampSeriesChrome(project.shots,{channelName:'Index Nine',fileNumber:1,
    chapters:[{shot:0,title:'A'},{shot:0,title:'B'}]}),/increase/);
});

test('B3 opening signal covers the reference-length heavy fault before the case card', () => {
  const a = makeOpeningSignal({fps:24}), b = makeOpeningSignal({fps:30});
  assert.equal(a.event.frames, 8); assert.equal(b.event.frames, 10);
  assert.equal(a.cover.to, 8/24);
  assert.equal(a.cover.screenFixed, true);
  assert.doesNotThrow(() => validateB3([a.cover], {enabled:true,events:[a.event]}));
  assert.throws(() => makeOpeningSignal({fps:60}), /12 frames/);
});

test('B3 universal outro has a full cat-woman presenter and story-independent last card', () => {
  const outro = makeUniversalOutro({start:20,nextFile:9,channelName:'Night Index'});
  assert.equal(outro.shots[0].start,20);
  assert.equal(outro.shots[2].end,30);
  assert.equal(outro.shots[2].kind,'end_card');
  const host = outro.shots[0].layers.find(l=>l.id==='cat_archivist_20000');
  assert.equal(host.type,'group');
  assert.ok(host.children.some(l=>l.id==='cat_archivist_20000_head'), 'The recurring host has an independently animated head');
  assert.ok(host.children.some(l=>l.id==='cat_archivist_20000_hand'), 'The recurring host has an independently animated file hand');
  assert.match(outro.shots[0].layers.find(l=>l.type==='text').text,/NIGHT INDEX/);
  assert.match(outro.shots[2].layers.find(l=>l.type==='text'&&l.text.startsWith('NEXT')).text,/009/);
  assert.ok(outro.shots[1].layers.some(l=>l.type==='group'), 'Institutional paw seal appears before the last card');
  assert.ok(outro.shots[2].layers.some(l=>l.type==='group'), 'Smaller paw print marks the upper right of the last card');
  assert.ok(outro.shots[0].layers.some(l=>l.type==='text'&&l.text==='DEPT. OF FELINE AFFAIRS'));
  for (const shot of outro.shots) assert.doesNotThrow(()=>validateB3(shot.layers));
  assert.throws(()=>makeUniversalOutro({nextFile:1}),/next file/);
});

test('B3 branded outro isolates the human-hand identity frame from the three head-turn poses', () => {
  const template = {style:'B3',width:1080,height:1920,television:{enabled:false},series:{}};
  const p = buildOutroProject(template,{channelName:'Index Nine',nextFile:2,
    identityImage:'identity.png',headSideImage:'side.png',headMidImage:'mid.png',headTurnImage:'front.png'});
  const layers = p.shots[0].layers;
  assert.equal(layers.find(l=>l.id==='identity_frame').to,2.2);
  assert.equal(layers.find(l=>l.id==='identity_head_side').from,2.2);
  assert.equal(layers.find(l=>l.id==='identity_head_mid').from,2.52);
  assert.equal(layers.find(l=>l.id==='identity_head_front').from,2.84);
  assert.ok(layers.some(l=>l.type==='text'&&l.text==='FILE 001  //  INDEX NINE'&&l.to===2.2),
    'A reusable raster identity must show the current case number');
  assert.ok(!layers.some(l=>l.type==='rect' && l.from===2.2), 'No head-cover rectangle can cut the neck');
  assert.equal(p.shots[2].kind,'end_card');
  assert.equal(p.series.channel_name,'Index Nine');
  assert.throws(()=>makeUniversalOutro({nextFile:2,channelName:'Index Nine',headSideImage:'side.png'}),/middle head/);
});

test('B3 series finishing stamps all authored shots and adds chapter cards only at plot turns', () => {
  const project = {style:'B3',fps:24,series:{},shots:[
    {start:0,end:2,layers:[{type:'rect',fill:'#020202'},{type:'text',text:'FILE 001  //  OLD',y:88}]},
    {start:2,end:4,layers:[{type:'rect',fill:'#020202'},{type:'text',text:'FILE 001  //  OLD',y:88}]}
  ]};
  const p = finishSuspenseSeries(project,{channelName:'Index Nine',fileNumber:1,
    chapters:[{shot:0,title:'THE SLIP'},{shot:1,title:'THE LOSSES'}]});
  assert.ok(p.shots.every(s=>s.layers.filter(l=>l.text==='FILE 001  //  INDEX NINE').length===1));
  assert.ok(p.shots.every(s=>s.layers.some(l=>l.text==='FILE')));
  assert.equal(p.television.events[0].frames,8);
  assert.equal(p.shots[0].layers.at(-1).to,8/24);
});

test('B3 episode bug repeats the file identity on every story shot', () => {
  const shots = stampSeriesBug([{start:0,end:2,layers:[{type:'text',text:'FILE 053  //  OLD NAME',x:70,y:110,screenFixed:true},
    {type:'rect',x:0,y:0,w:10,h:10}]},
    {start:2,end:4,layers:[{type:'rect',x:0,y:0,w:10,h:10}]}],
    {fileNumber:53,channelName:'Night Index'});
  assert.equal(shots.length,2);
  assert.equal(shots[0].layers.at(-1).text,'FILE 053  //  NIGHT INDEX');
  assert.equal(shots[1].layers.at(-1).text,shots[0].layers.at(-1).text);
  assert.equal(shots[0].layers.at(-1).screenFixed,true);
  assert.doesNotThrow(()=>validateB3([makeSeriesBug({fileNumber:53,channelName:'Night Index'})]));
  assert.throws(()=>makeSeriesBug({fileNumber:0,channelName:'Night Index'}),/number/);
});

test('B3 validates bounded declarative artwork and rejects cross-style leakage', t => {
  const f = fixture(t); assert.equal(loadProject(f.file).style, 'B3');
  for (const layer of [
    {type: 'path', commands: [['M', 0, 0], ['eval', 'process.exit()']]},
    {type: 'path', commands: [['M', 0, 0], ['C', 2, 3]]},
    {type: 'rect', w: 0, h: 80}, {type: 'ellipse', w: 20, h: 20, scaleX: -1},
    {type: 'rect', w: 10, h: 20, fill: 'url(https://example.com)'},
    {type: 'rect', w: 10, h: 20, fill: '#abcde'},
    {type: 'group', children: []}, {type: 'ellipse', w: 10, h: 20, alpha: 2}
  ]) assert.throws(() => validateB3([layer]));
  let nested = {type: 'ellipse', w: 10, h: 10};
  for (let i = 0; i < 10; i++) nested = {type: 'group', children: [nested]};
  assert.throws(() => validateB3([nested]), /nesting/);
  for (const style of ['B1', 'B2']) {
    f.project.style = style; f.project.television = {enabled: false}; save(f.file, f.project); assert.throws(() => loadProject(f.file), /Television finish/);
    delete f.project.television; save(f.file, f.project); assert.throws(() => loadProject(f.file), /Unknown layer/);
  }
});

test('B3 nested future images do not block preview, but do block full validation', async t => {
  const f = fixture(t);
  f.project.shots[0].layers[0].children.push({type: 'image', path: 'unfinished.png', from: 0.5, w: 100});
  save(f.file, f.project);
  assert.equal(loadProject(f.file, {seconds: 0.4}).shots[0].layers[0].children.length, 2);
  assert.throws(() => loadProject(f.file), /unfinished.png/);
  const result = await render(loadProject(f.file, {seconds: 0.4}), {seconds: 0.4});
  assert.equal(result.full_decode, 'pass');
});

test('B3 nested media and finish changes invalidate cache; original audio remains intact', async t => {
  const f = fixture(t); const image = path.join(f.dir, 'nested.png');
  fs.copyFileSync(path.join(ROOT, 'assets/b1/calendar-crayon.png'), image);
  f.project.shots[0].layers[0].children.push({type: 'image', path: 'nested.png', x: 500, w: 100});
  save(f.file, f.project); const voice = hashFile(path.join(f.dir, 'voice.wav'));
  const first = await render(loadProject(f.file));
  assert.equal((await render(loadProject(f.file), {replace: true})).cache_hits, 1);
  fs.copyFileSync(path.join(ROOT, 'assets/b1/idea-bulb-crayon.png'), image);
  assert.equal((await render(loadProject(f.file), {replace: true})).cache_hits, 0);
  f.project.television = {enabled: true, intensity: 0.4}; save(f.file, f.project);
  const finish = await render(loadProject(f.file), {replace: true});
  assert.equal(finish.cache_hits, 0); assert.notEqual(finish.output_sha256, first.output_sha256);
  assert.equal(finish.original_voice_sha256, voice); assert.equal(hashFile(path.join(f.dir, 'voice.wav')), voice);
});

test('B3 CLI creates an explicit non-overwriting B3 scaffold', t => {
  const f = fixture(t), destination = path.join(f.dir, 'new-project');
  const cmd = () => spawnSync(process.execPath, [path.join(ROOT, 'scripts/autopilot.mjs'), 'init', destination, '--style', 'B3'], {encoding: 'utf8'});
  const result = cmd(); assert.equal(result.status, 0, result.stderr);
  const scaffold = JSON.parse(fs.readFileSync(path.join(destination, 'project.json')));
  assert.equal(scaffold.style, 'B3'); assert.equal(scaffold.television.enabled, true);
  assert.notEqual(cmd().status, 0); assert.deepEqual(JSON.parse(fs.readFileSync(path.join(destination, 'project.json'))), scaffold);
});
