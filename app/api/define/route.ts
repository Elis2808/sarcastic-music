import { readFile } from "fs/promises";
import { join } from "path";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const word = searchParams.get("word")?.toLowerCase().trim();

  if (!word) {
    return Response.json({ error: "No word provided" }, { status: 400 });
  }

  // Try local rap dictionary FIRST for slang/rap terms
  try {
    const filePath = join(process.cwd(), "app", "data", "rap-dictionary.json");
    const fileContents = await readFile(filePath, "utf8");
    const rapDict = JSON.parse(fileContents);
    if (rapDict.terms?.[word]) {
      const def = rapDict.terms[word];
      const isGeneric = def.includes("Proper noun, surname, place name");
      if (!isGeneric) {
        return Response.json({
          word,
          source: "local",
          definitions: [{ partOfSpeech: "slang", definition: def }],
        });
      }
    }
  } catch {}

  // Try Dictionary API.dev (real definitions)
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    if (res.ok) {
      const data = await res.json();
      const entry = data[0];
      const definitions: { partOfSpeech: string; definition: string; example?: string }[] = [];

      for (const meaning of entry.meanings || []) {
        for (const def of meaning.definitions.slice(0, 3)) {
          definitions.push({
            partOfSpeech: meaning.partOfSpeech,
            definition: def.definition,
            example: def.example,
          });
        }
      }

      return Response.json({
        word: entry.word,
        phonetic: entry.phonetic,
        source: "dictionaryapi.dev",
        definitions,
      });
    }
  } catch {}

  // Fallback to Datamuse API
  try {
    const res = await fetch(`https://api.datamuse.com/words?sp=${encodeURIComponent(word)}&md=dp&max=1`);
    if (res.ok) {
      const data = await res.json();
      if (data.length > 0 && data[0].defs) {
        const definitions: { partOfSpeech: string; definition: string }[] = [];
        for (const def of data[0].defs.slice(0, 3)) {
          const [pos, meaning] = def.split("\t");
          definitions.push({
            partOfSpeech: pos || "unknown",
            definition: meaning || def,
          });
        }
        return Response.json({
          word: data[0].word,
          source: "datamuse",
          definitions,
        });
      }
    }
  } catch {}

  // Final fallback: check if it's a form of a base word
  const baseForms = [word.replace(/ing$/, ""), word.replace(/ed$/, ""), word.replace(/s$/, ""), word.replace(/es$/, "")];
  for (const base of baseForms) {
    if (base === word) continue;
    try {
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(base)}`);
      if (res.ok) {
        const data = await res.json();
        const entry = data[0];
        return Response.json({
          word: entry.word,
          originalQuery: word,
          phonetic: entry.phonetic,
          source: "dictionaryapi.dev (derived)",
          definitions: entry.meanings?.flatMap((m: any) =>
            m.definitions.slice(0, 2).map((d: any) => ({
              partOfSpeech: m.partOfSpeech,
              definition: d.definition,
              example: d.example,
            }))
          ) || [],
        });
      }
    } catch {}
  }

  return Response.json({ error: "Word not found in any dictionary" }, { status: 404 });
}
