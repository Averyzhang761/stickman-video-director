import fs from 'node:fs';

export function seriesSummary(registry) {
  if (!registry || typeof registry.series !== 'string' || !Array.isArray(registry.episodes))
    throw Error('B3 registry needs series and episodes');
  const numbers = registry.episodes.map(e => e.file_number);
  if (numbers.some(n => !Number.isInteger(n) || n < 1 || n > 999) || new Set(numbers).size !== numbers.length)
    throw Error('B3 registry file numbers must be unique integers from 1 to 999');
  return {series:registry.series,produced_count:numbers.length,
    published_count:registry.episodes.filter(e => e.publication?.status === 'published').length,
    next_file_number:Math.max(0,...numbers) + 1};
}

export function registerEpisode(registry, episode) {
  const next = seriesSummary(registry).next_file_number;
  if (episode.file_number !== next || !episode.title?.trim())
    throw Error(`Next B3 episode must have file_number ${next} and a title`);
  registry.episodes.push({...episode,publication:{status:'not_published'}});
  return seriesSummary(registry);
}

if (process.argv[1] && process.argv[1].endsWith('b3-series-registry.mjs')) {
  const [command,file,number,title] = process.argv.slice(2);
  if (!['summary','register'].includes(command) || !file)
    throw Error('usage: node b3-series-registry.mjs summary REGISTRY | register REGISTRY NUMBER TITLE');
  const registry = JSON.parse(fs.readFileSync(file,'utf8'));
  const result = command === 'summary' ? seriesSummary(registry) :
    registerEpisode(registry,{file_number:Number(number),title});
  if (command === 'register') fs.writeFileSync(file,JSON.stringify(registry,null,2) + '\n');
  console.log(JSON.stringify(result));
}
