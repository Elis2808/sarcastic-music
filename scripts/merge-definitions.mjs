import { readFile, writeFile } from "fs/promises";
import { join } from "path";

const GENERIC_PLACEHOLDER = "Proper noun, surname, place name, brand, or specialized term. Exact definition may vary by context.";

// Read definitions.txt
const defsText = await readFile("scripts/definitions.txt", "utf8");
const newDefs = {};

for (const line of defsText.split("\n")) {
  const match = line.match(/^([a-z]+) - (.+)$/);
  if (match) {
    const [, word, def] = match;
    if (def && def !== GENERIC_PLACEHOLDER && def.length > 5) {
      newDefs[word] = def;
    }
  }
}

console.log(`Found ${Object.keys(newDefs).length} real definitions`);

// Read existing rap-dictionary.json
const dictPath = join(process.cwd(), "app", "data", "rap-dictionary.json");
const dictText = await readFile(dictPath, "utf8");
const dict = JSON.parse(dictText);

// Merge new definitions
for (const [word, def] of Object.entries(newDefs)) {
  dict.terms[word] = def;
}

// Sort terms alphabetically
const sortedTerms = {};
for (const key of Object.keys(dict.terms).sort()) {
  sortedTerms[key] = dict.terms[key];
}
dict.terms = sortedTerms;

await writeFile(dictPath, JSON.stringify(dict, null, 2), "utf8");
console.log(`Merged ${Object.keys(newDefs).length} definitions into rap-dictionary.json`);
console.log(`Total terms now: ${Object.keys(dict.terms).length}`);
