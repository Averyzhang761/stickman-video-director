// Declarative B3 artwork only: no source-code evaluation or SVG/URL loading.
// Shared interpolation keeps rendering and geometric motion checks in agreement.
export function keyState(l, t) {
  const out = {...l};
  for (const prop of ['x', 'y', 'w', 'angle', 'alpha', 'progress', 'scaleX', 'scaleY']) {
    const keys = (l.keys || []).filter(k => k[prop] !== undefined);
    if (!keys.length) continue;
    if (t <= keys[0].t) out[prop] = keys[0][prop];
    else if (t >= keys.at(-1).t) out[prop] = keys.at(-1)[prop];
    else {
      const i = keys.findIndex(k => k.t > t), a = keys[i - 1], b = keys[i];
      const x = Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t)));
      out[prop] = a[prop] + (b[prop] - a[prop]) * x * x * (3 - 2 * x);
    }
  }
  return out;
}
export function* walkLayers(layers) {
  for (const layer of layers) {
    yield layer;
    if (layer.type === 'group') yield* walkLayers(layer.children);
  }
}
const arity = {M: 2, L: 2, Q: 4, C: 6, Z: 0};
// Preview validation must not require media belonging only to an unfinished
// nested branch. Child visibility is still relative to the shot, not the group.
export function visibleLayers(layers, shotStart, end) {
  return layers.filter(l => shotStart + (l.from ?? 0) < end).map(l => l.type === 'group'
    ? {...l, children: visibleLayers(l.children, shotStart, end)} : l)
    .filter(l => l.type !== 'group' || l.children.length);
}
const finite = (v, label, min = -10000, max = 10000) => {
  if (!Number.isFinite(v) || v < min || v > max) throw new Error(`Invalid B3 ${label}`);
};
export function validateB3(layers, television) {
  let count = 0;
  function visit(list, depth) {
    if (!Array.isArray(list) || !list.length || depth > 8) throw new Error('B3 groups need children; maximum nesting is 8');
    for (const l of list) {
      if (++count > 2000 || !l || typeof l !== 'object') throw new Error('Invalid B3 layer tree');
      for (const k of ['pivotX', 'pivotY', 'radius']) if (l[k] !== undefined) finite(l[k], k, k === 'radius' ? 0 : -10000);
      if (l.screenFixed !== undefined && typeof l.screenFixed !== 'boolean') throw new Error('B3 screenFixed must be boolean');
      if (l.tracking !== undefined && (l.type !== 'text' || !Number.isFinite(l.tracking) || l.tracking < 0 || l.tracking > 12)) throw new Error('B3 text tracking must be 0–12');
      if (l.fontRole !== undefined && (l.type !== 'text' || l.fontRole !== 'tag')) throw new Error('B3 fontRole must be tag text');
      if (l.align !== undefined && (l.type !== 'text' || !['left','center'].includes(l.align))) throw new Error('B3 text align must be left or center');
      for (const k of ['scaleX', 'scaleY']) if (l[k] !== undefined) finite(l[k], k, 0.001, 100);
      for (const k of ['fill', 'stroke', 'color', 'glowColor']) if (l[k] !== undefined && (typeof l[k] !== 'string' || !/^(?:#(?:[a-f\d]{3}|[a-f\d]{4}|[a-f\d]{6}|[a-f\d]{8})|rgba?\([\d\s.,%]+\)|[a-z]{1,20})$/i.test(l[k]))) throw new Error('Invalid B3 color');
      if (l.glow !== undefined) finite(l.glow, 'glow', 0, 200);
      for (const k of ['alpha', 'progress']) if (l[k] !== undefined) finite(l[k], k, 0, 1);
      if (l.lineWidth !== undefined) finite(l.lineWidth, 'line width', 0.001, 200);
      if (l.type === 'group') visit(l.children, depth + 1);
      else if (l.children !== undefined) throw new Error('Only B3 group layers have children');
      if (l.type === 'path') {
        if (!Array.isArray(l.commands) || !l.commands.length || l.commands.length > 1000 || l.commands[0]?.[0] !== 'M') throw new Error('B3 path needs numeric commands beginning with M');
        for (const c of l.commands) if (!Array.isArray(c) || !Object.hasOwn(arity, c[0]) || c.length !== arity[c[0]] + 1 || c.slice(1).some(n => !Number.isFinite(n) || Math.abs(n) > 10000)) throw new Error('Invalid B3 path command');
      }
      if (['rect', 'ellipse'].includes(l.type)) { finite(l.w, 'shape width', 0.001); finite(l.h, 'shape height', 0.001); }
    }
  }
  visit(layers, 0);
  if (television !== undefined) {
    if (!television || typeof television !== 'object' || Array.isArray(television) || Object.keys(television).some(k => !['enabled', 'intensity', 'grain', 'flicker', 'events'].includes(k))) throw new Error('Invalid B3 television settings');
    if (television.enabled !== undefined && typeof television.enabled !== 'boolean') throw new Error('B3 television enabled must be boolean');
    if (television.intensity !== undefined) finite(television.intensity, 'television intensity', 0, 1);
    if (television.grain !== undefined) finite(television.grain, 'television grain', 0, 1);
    if (television.flicker !== undefined) finite(television.flicker, 'television flicker', 0, 1);
    if (television.events !== undefined) {
      if (!Array.isArray(television.events) || television.events.length > 100) throw new Error('Invalid B3 television events');
      for (const event of television.events) {
        if (!event || Object.keys(event).some(k => !['time', 'kind', 'frames', 'strength'].includes(k)) || !['line', 'rgb', 'snow'].includes(event.kind)) throw new Error('Invalid B3 television event');
        finite(event.time, 'television event time', 0, 86400);
        if (event.frames !== undefined && (!Number.isInteger(event.frames) || event.frames < 1 || event.frames > 12)) throw new Error('B3 television event frames must be 1–12');
        if (event.strength !== undefined) finite(event.strength, 'television event strength', 0.1, 2);
      }
    }
  }
}
export function drawB3Shape(ctx, l) {
  ctx.save();
  if (l.glow) {
    ctx.shadowColor = l.glowColor || l.fill || l.stroke || '#ffffff';
    ctx.shadowBlur = l.glow;
  }
  ctx.beginPath();
  if (l.type === 'path') for (const [op, ...v] of l.commands) {
    if (op === 'M') ctx.moveTo(...v);
    if (op === 'L') ctx.lineTo(...v);
    if (op === 'Q') ctx.quadraticCurveTo(...v);
    if (op === 'C') ctx.bezierCurveTo(...v);
    if (op === 'Z') ctx.closePath();
  }
  else if (l.type === 'rect') ctx.roundRect(0, 0, l.w, l.h, Math.min(l.radius ?? 0, l.w / 2, l.h / 2));
  else ctx.ellipse(l.w / 2, l.h / 2, l.w / 2, l.h / 2, 0, 0, Math.PI * 2);
  if (l.fill !== 'none') { ctx.fillStyle = l.fill || '#dedfdf'; ctx.fill(); }
  if (l.stroke && l.stroke !== 'none') { ctx.strokeStyle = l.stroke; ctx.lineWidth = l.lineWidth ?? 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); }
  ctx.restore();
}
export function televisionFinish(ctx, source, width, height, intensity = 0.45, options = {}) {
  if (!intensity) return;
  ctx.save(); ctx.resetTransform();
  // Stable bloom and scanlines; time-varying signal noise stays below captions.
  ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.14 * intensity;
  ctx.filter = `blur(${Math.max(0.4, width / 640)}px)`; ctx.drawImage(source, 0, 0);
  ctx.filter = 'none'; ctx.globalAlpha = 0.045 * intensity; ctx.drawImage(source, Math.max(1, width / 1280), 0);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  ctx.fillStyle = `rgba(0,0,0,${0.12 * intensity})`;
  for (let y = 0; y < height; y += Math.max(3, Math.round(height / 240))) ctx.fillRect(0, y, width, 1);
  const vignette = ctx.createRadialGradient(width / 2, height / 2, width * 0.2, width / 2, height / 2, width * 0.7);
  vignette.addColorStop(0, 'rgba(0,0,0,0)'); vignette.addColorStop(1, `rgba(0,0,0,${0.3 * intensity})`);
  ctx.fillStyle = vignette; ctx.fillRect(0, 0, width, height);
  const frame = Math.round((options.time ?? 0) * (options.fps ?? 24));
  let seed = (Math.imul(frame + 1, 1664525) + 1013904223) >>> 0;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  if (options.flicker) {
    const pulse = (random() - .5) * .018 * options.flicker * intensity;
    ctx.fillStyle = pulse >= 0 ? `rgba(255,255,255,${pulse})` : `rgba(0,0,0,${-pulse})`;
    ctx.fillRect(0, 0, width, height);
  }
  if (options.grain) {
    ctx.fillStyle = `rgba(255,255,255,${.22 * options.grain * intensity})`;
    for (let i = 0, n = Math.round(width * height / 3000); i < n; i++) {
      const x = Math.floor(random() * width), y = Math.floor(random() * height);
      ctx.fillRect(x, y, random() < .85 ? 2 : 5, random() < .9 ? 2 : 1);
    }
  }
  const event = options.events?.find(e => frame >= Math.round(e.time * (options.fps ?? 24)) &&
    frame < Math.round(e.time * (options.fps ?? 24)) + (e.frames ?? 1));
  const eventFrame = event ? frame - Math.round(event.time * (options.fps ?? 24)) : -1;
  if (event?.kind === 'line') {
    ctx.fillStyle = `rgba(255,255,255,${.35 * intensity})`;
    for (let i = 0; i < 14; i++) {
      const y = Math.floor(random() * height), x = Math.floor(random() * width);
      ctx.fillRect(x, y, 30 + random() * width * .32, random() < .7 ? 1 : 2);
    }
  }
  if (event?.kind === 'rgb') {
    ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = .34 * intensity;
    ctx.filter = 'sepia(1) saturate(7) hue-rotate(-35deg)'; ctx.drawImage(source, -4, 0);
    ctx.filter = 'sepia(1) saturate(7) hue-rotate(145deg)'; ctx.drawImage(source, 4, 0);
    ctx.filter = 'none'; ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  if (event?.kind === 'snow') {
    const eventStrength = event.strength ?? 1;
    const strength = (1 - eventFrame / (event.frames ?? 1)) * intensity * eventStrength;
    ctx.fillStyle = `rgba(255,255,255,${Math.min(1, .65 * strength)})`;
    for (let i = 0, n = Math.round(width * height / 3200 * eventStrength); i < n; i++)
      ctx.fillRect(random() * width, random() * height, 1 + random() * 4, 1 + random() * 3);
    ctx.fillStyle = `rgba(0,0,0,${Math.min(1, .5 * strength)})`;
    for (let i = 0, n = Math.round(width * height / 6400 * eventStrength); i < n; i++)
      ctx.fillRect(random() * width, random() * height, 1 + random() * 4, 1 + random() * 3);
    ctx.fillStyle = `rgba(255,255,255,${Math.min(1, .7 * strength)})`;
    for (let i = 0; i < Math.round(28 * eventStrength); i++)
      ctx.fillRect(random() * width, random() * height, 20 + random() * width * .45, random() < .8 ? 1 : 2);
    if (eventFrame === 0) {
      const tearY = Math.round(height * (.38 + random() * .25));
      ctx.drawImage(source, 0, tearY, width, 14, 10, tearY, width, 14);
      ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = Math.min(1, .48 * intensity * eventStrength);
      ctx.filter = 'sepia(1) saturate(7) hue-rotate(-35deg)'; ctx.drawImage(source, -7, 0);
      ctx.filter = 'sepia(1) saturate(7) hue-rotate(145deg)'; ctx.drawImage(source, 7, 0);
      ctx.filter = 'none'; ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
  }
  ctx.restore();
}
