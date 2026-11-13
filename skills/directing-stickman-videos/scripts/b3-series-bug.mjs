import path from 'node:path';
import {fileURLToPath} from 'node:url';

// The same small top-left file identity is stamped on every story shot.
// Add it before the opening signal cover and before appending the universal outro.
export function makeSeriesBug({fileNumber, channelName}) {
  if (!Number.isInteger(fileNumber) || fileNumber < 1 || fileNumber > 999)
    throw Error('B3 file number must be 1–999');
  if (typeof channelName !== 'string' || !/^[A-Za-z][A-Za-z0-9 ]{1,21}$/.test(channelName.trim()))
    throw Error('B3 channel name must be 2–22 Latin letters, numbers or spaces');
  return {type:'text', text:`FILE ${String(fileNumber).padStart(3,'0')}  //  ${channelName.trim().toUpperCase()}`,
    x:36,y:88,w:1220,size:31,color:'#777777',tracking:5,bold:true,fontRole:'tag',screenFixed:true};
}

export function stampSeriesBug(shots, identity) {
  if (!Array.isArray(shots) || !shots.length) throw Error('B3 series needs story shots');
  const bug = makeSeriesBug(identity);
  return shots.map(shot => ({...shot, layers:[
    ...shot.layers.filter(l => !(l.type === 'text' && l.screenFixed && l.y < 200 && /^FILE \d{3}\s*\/\//.test(l.text))),
    {...bug}
  ]}));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [fileNumber, ...name] = process.argv.slice(2);
  process.stdout.write(JSON.stringify(makeSeriesBug({fileNumber:Number(fileNumber),channelName:name.join(' ')})) + '\n');
}
