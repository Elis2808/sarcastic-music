export const wordToPhones = new Map<string, string[]>();

let loaded = false;

export async function loadDictionary() {
  if (loaded) return;

  const res = await fetch("/api/cmu");
  const dict = await res.json();

  for (const [word, phones] of Object.entries(dict)) {
    wordToPhones.set(word.toLowerCase(), phones as string[]);
  }

  loaded = true;
}