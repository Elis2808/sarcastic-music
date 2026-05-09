import { dictionary } from 'cmu-pronouncing-dictionary';
import { writeFile } from 'fs/promises';

const BATCH_SIZE = 10;
const DELAY_MS = 200;

const words = [...new Set(
  Object.keys(dictionary).map(w => w.replace(/\(\d+\)$/, '').toLowerCase())
)].filter(w => /^[a-z]+$/.test(w)); // only plain alphabetic words

console.log(`Checking ${words.length} unique words...`);

const missing = [];
let checked = 0;

async function checkBatch(batch) {
  await Promise.all(batch.map(async (word) => {
    try {
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
      if (!res.ok) missing.push(word);
    } catch {
      missing.push(word);
    }
  }));
}

for (let i = 0; i < words.length; i += BATCH_SIZE) {
  const batch = words.slice(i, i + BATCH_SIZE);
  await checkBatch(batch);
  checked += batch.length;

  if (checked % 500 === 0) {
    console.log(`Progress: ${checked}/${words.length} — missing so far: ${missing.length}`);
  }

  await new Promise(r => setTimeout(r, DELAY_MS));
}

missing.sort();

await writeFile('scripts/missing-definitions.txt', missing.join('\n'), 'utf8');
console.log(`\nDone! ${missing.length} words with no definition saved to scripts/missing-definitions.txt`);
