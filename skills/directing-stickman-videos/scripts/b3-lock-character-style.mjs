import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export function lockCharacterStyle(project) {
  const next = structuredClone(project);
  next.series ??= {};
  next.series.character_style = 'solid_pictogram_v1';
  for (const shot of next.shots ?? []) {
    for (const layer of shot.layers ?? []) {
      if (layer.type !== 'puppet') continue;
      layer.appearance = layer.characterGender === 'male' ? 'pictogram_male' : 'pictogram_female';
      layer.color = '#fafafa';
      layer.headStyle = 'solid';
      if (!layer.profileView) layer.profileView = 'front';
    }
  }
  return next;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) throw Error('usage: node b3-lock-character-style.mjs INPUT OUTPUT');
  fs.writeFileSync(output, JSON.stringify(lockCharacterStyle(JSON.parse(fs.readFileSync(input, 'utf8'))), null, 2));
}
