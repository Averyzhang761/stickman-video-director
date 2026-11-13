import fs from 'node:fs';
import path from 'node:path';

const copy = value => structuredClone(value);
const stable = value => JSON.stringify(value, (key, item) =>
  ['id', 'keys', 'motion'].includes(key) ? undefined : item);
const transitions = {present:['present','disappearing'], disappearing:['absent'],
  absent:['absent','reappearing'], reappearing:['present']};

export function presenceKeys(state, duration, seconds = 1.2) {
  if (!(state in transitions) || !Number.isFinite(duration) || duration <= 0 ||
      !Number.isFinite(seconds) || seconds <= 0) throw Error('invalid presence state or duration');
  const end = Math.max(.05, duration - .03), change = Math.min(seconds, end);
  if (state === 'disappearing') return [{t:0,alpha:1},{t:change,alpha:0},{t:end,alpha:0}];
  if (state === 'reappearing') return [{t:0,alpha:0},{t:change,alpha:1},{t:end,alpha:1}];
  const alpha = state === 'present' ? 1 : 0;
  return [{t:0,alpha},{t:end,alpha}];
}

export function presenceGroup(id, children, event, duration) {
  if (!id || !Array.isArray(children)) throw Error('presence group needs id and artwork');
  const keys = presenceKeys(event.state, duration, event.seconds);
  return {type:'group',id,x:0,y:0,alpha:keys[0].alpha,keys,
    motion:{role:'prop',reason:event.reason || `Object is ${event.state}`},children:copy(children)};
}

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
  if (plan.forbid_cover_blocks) for (const [shotIndex, shot] of project.shots.entries()) {
    for (const layer of shot.layers) if (layer.type === 'rect' && /vanish|disappear|reappear/i.test(layer.id || ''))
      problems.push(`shot ${shotIndex}: cover rectangle ${layer.id} must be replaced by motion on the object itself`);
  }
  for (const rule of plan.absent_layers || []) {
    const shot = project.shots[rule.shot];
    if (!shot || !rule.match || !Object.keys(rule.match).length) throw Error('invalid absent layer rule');
    const matches = shot.layers.filter(layer => Object.entries(rule.match).every(([key, value]) => layer[key] === value));
    if (matches.length) {
      problems.push(`shot ${rule.shot}: ${matches.length} unwanted ${JSON.stringify(rule.match)} layers`);
      if (repair) { shot.layers = shot.layers.filter(layer => !matches.includes(layer)); repaired += matches.length; }
    }
  }
  for (const rule of plan.layer_properties || []) {
    const layer = layerAt(project, rule.shot, rule);
    for (const [key, value] of Object.entries(rule.properties || {})) if (layer[key] !== value) {
      problems.push(`shot ${rule.shot}: ${rule.id_pattern || rule.layer_id} ${key} differs`);
      if (repair) { layer[key] = value; repaired++; }
    }
  }
  for (const track of plan.tracks || []) {
    if (!track.id || !track.states || !Array.isArray(track.instances)) throw Error('prop track needs id, states and instances');
    if (track.coverage) {
      const covered = new Set([...track.instances.map(item => item.shot),
        ...(track.motion_runs || []).flatMap(run => run.shots),
        ...(track.presence || []).map(event => event.shot)]);
      for (const [shotIndex, shot] of project.shots.entries()) for (const layer of shot.layers) {
        const matches = track.layer_id ? layer.id === track.layer_id :
          track.id_pattern ? new RegExp(track.id_pattern).test(layer.id || '') :
          layer.type === 'group' && layer.children?.some(child => child.type === 'text' && child.text === track.match_text);
        if (matches && !covered.has(shotIndex)) problems.push(`${track.id} shot ${shotIndex}: recurring prop appearance is missing from continuity ledger`);
      }
    }
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
    let previousPresence;
    for (const event of track.presence || []) {
      if (previousPresence && event.shot <= previousPresence.shot) throw Error(`${track.id}: presence events must be ordered`);
      if (previousPresence && !transitions[previousPresence.state].includes(event.state))
        problems.push(`${track.id} shot ${event.shot}: invalid presence transition ${previousPresence.state} -> ${event.state}`);
      if (['disappearing','reappearing'].includes(event.state) && !event.reason)
        problems.push(`${track.id} shot ${event.shot}: presence change needs a story reason`);
      const layer = layerAt(project, event.shot, track);
      if (layer.type !== 'group') throw Error(`${track.id} shot ${event.shot}: presence must animate the object group`);
      const shot = project.shots[event.shot];
      const want = presenceKeys(event.state, shot.end - shot.start, event.seconds);
      const actual = layer.keys?.map(key => ({t:key.t,alpha:key.alpha}));
      if (JSON.stringify(actual) !== JSON.stringify(want) || layer.alpha !== want[0].alpha) {
        problems.push(`${track.id} shot ${event.shot}: ${event.state} animation differs`);
        if (repair) { layer.alpha = want[0].alpha; layer.keys = want; repaired++; }
      }
      previousPresence = event;
    }
    for (const run of track.motion_runs || []) {
      if (!Array.isArray(run.shots) || run.shots.length < 1 || !run.axis || !Number.isFinite(run.from) || !Number.isFinite(run.to)) throw Error(`${track.id}: invalid motion run`);
      run.shots.forEach((shotIndex, i) => {
        const layer = layerAt(project, shotIndex, track);
        const first = run.from + (run.to - run.from) * i / run.shots.length;
        const last = run.from + (run.to - run.from) * (i + 1) / run.shots.length;
        const keys = layer.keys;
        if (!keys || keys.length < 2) throw Error(`${track.id} shot ${shotIndex}: motion keys missing`);
        const hold = run.hold_after;
        if (hold !== undefined && (run.shots.length !== 1 || !Number.isFinite(hold) || hold <= 0 || hold >= keys.at(-1).t)) throw Error(`${track.id}: invalid hold_after`);
        const hasHold = hold === undefined || keys.some(key => Math.abs(key.t - hold) < .01 && Math.abs((key[run.axis] ?? layer[run.axis]) - last) < .01);
        if (Math.abs((keys[0][run.axis] ?? layer[run.axis]) - first) > .01 ||
            Math.abs((keys.at(-1)[run.axis] ?? layer[run.axis]) - last) > .01 || !hasHold) {
          problems.push(`${track.id} shot ${shotIndex}: ${run.axis} resets across cut`);
          if (repair) {
            const duration = keys.at(-1).t - keys[0].t;
            if (hold !== undefined) {
              const firstKey = copy(keys[0]), lastKey = copy(keys.at(-1));
              firstKey[run.axis] = first;
              lastKey[run.axis] = last;
              layer.keys = [firstKey, {...copy(lastKey), t: hold}, lastKey];
            } else for (const key of keys) key[run.axis] = first + (last - first) * (duration ? (key.t - keys[0].t) / duration : 0);
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
