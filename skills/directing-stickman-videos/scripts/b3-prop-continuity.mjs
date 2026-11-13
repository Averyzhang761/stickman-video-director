import fs from 'node:fs';
import path from 'node:path';

const copy = value => structuredClone(value);
const stable = value => JSON.stringify(value, (key, item) =>
  ['id', 'keys', 'motion', 'from', 'to'].includes(key) ? undefined : item);

function layerAt(project, shotIndex, match) {
  const shot = project.shots[shotIndex];
  if (!shot) throw Error(`missing shot ${shotIndex}`);
  const matches = shot.layers.filter(layer =>
    match.layer_id ? layer.id === match.layer_id :
    match.id_pattern ? new RegExp(match.id_pattern).test(layer.id || '') :
    layer.type === 'group' && layer.children?.some(child => child.type === 'text' && child.text === match.match_text));
  if (matches.length !== 1) throw Error(`shot ${shotIndex}: expected one ${match.layer_id || match.id_pattern || match.match_text} layer, found ${matches.length}`);
  return matches[0];
}

function template(project, track, name, stack = []) {
  if (stack.includes(name)) throw Error(`circular prop state: ${[...stack, name].join(' > ')}`);
  const state = track.states[name];
  if (!state) throw Error(`${track.id}: missing state ${name}`);
  let children = state.inherits ? template(project, track, state.inherits, [...stack, name]) :
    copy(layerAt(project, state.source_shot, track).children);
  if (state.replace_text) for (const child of children) {
    if (child.type === 'text' && child.text in state.replace_text) child.text = state.replace_text[child.text];
  }
  if (state.text_color) for (const child of children) {
    if (child.type === 'text' && child.text in state.text_color) child.color = state.text_color[child.text];
  }
  if (state.remove_text) children = children.filter(child =>
    child.type !== 'text' || !state.remove_text.includes(child.text));
  if (state.add) children.push(...copy(state.add));
  return children;
}

export function reconcileProps(project, plan, repair = false) {
  const problems = [];
  let repaired = 0;
  for (const track of plan.tracks || []) {
    if (!track.id || !track.states || !Array.isArray(track.instances)) throw Error('prop track needs id, states and instances');
    const expected = Object.fromEntries(Object.keys(track.states).map(name => [name, template(project, track, name)]));
    let prior;
    for (const item of track.instances) {
      const layer = layerAt(project, item.shot, track);
      const want = expected[item.state];
      if (!want) throw Error(`${track.id}: unknown state ${item.state}`);
      if (prior && item.state !== prior.state && !item.reason) problems.push(`${track.id} shot ${item.shot}: state change needs a story reason`);
      if (stable(layer.children) !== stable(want)) {
        problems.push(`${track.id} shot ${item.shot}: content differs from ${item.state}`);
        if (repair) { layer.children = copy(want); repaired++; }
      }
      prior = item;
    }
    for (const run of track.motion_runs || []) {
      if (!Array.isArray(run.shots) || run.shots.length < 2 || !run.axis || !Number.isFinite(run.from) || !Number.isFinite(run.to)) throw Error(`${track.id}: invalid motion run`);
      run.shots.forEach((shotIndex, i) => {
        const layer = layerAt(project, shotIndex, track);
        const first = run.from + (run.to - run.from) * i / run.shots.length;
        const last = run.from + (run.to - run.from) * (i + 1) / run.shots.length;
        const keys = layer.keys;
        if (!keys || keys.length < 2) throw Error(`${track.id} shot ${shotIndex}: motion keys missing`);
        if (Math.abs((keys[0][run.axis] ?? layer[run.axis]) - first) > .01 ||
            Math.abs((keys.at(-1)[run.axis] ?? layer[run.axis]) - last) > .01) {
          problems.push(`${track.id} shot ${shotIndex}: ${run.axis} resets across cut`);
          if (repair) {
            const duration = keys.at(-1).t - keys[0].t;
            for (const key of keys) key[run.axis] = first + (last - first) * (duration ? (key.t - keys[0].t) / duration : 0);
            if (run.axis in layer) layer[run.axis] = first;
            repaired++;
          }
        }
      });
    }
  }
  return {valid: problems.length === 0, problems, repaired};
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const [projectFile, planFile, mode] = process.argv.slice(2);
  if (!projectFile || !planFile || !['--check', '--repair'].includes(mode)) throw Error('usage: b3-prop-continuity.mjs PROJECT PLAN --check|--repair');
  const project = JSON.parse(fs.readFileSync(projectFile, 'utf8'));
  const plan = JSON.parse(fs.readFileSync(planFile, 'utf8'));
  const result = reconcileProps(project, plan, mode === '--repair');
  if (mode === '--repair' && result.repaired) fs.writeFileSync(projectFile, JSON.stringify(project, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
  if (mode === '--check' && !result.valid) process.exitCode = 1;
}
