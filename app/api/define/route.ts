import { readFile } from "fs/promises";
import { join } from "path";
import { checkRateLimit, getClientIp } from "@/app/lib/rateLimit";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const ip = getClientIp(request);
  const { allowed } = checkRateLimit(ip, "define", 200);
  if (!allowed) return Response.json({ error: "Daily limit reached. Try again tomorrow." }, { status: 429 });

  const { searchParams } = new URL(request.url);
  const word = searchParams.get("word")?.toLowerCase().trim();

  if (!word) {
    return Response.json({ error: "No word provided" }, { status: 400 });
  }

  // Load custom definition to potentially append later
  let customDef: string | null = null;
  try {
    const customPath = join(process.cwd(), "app", "data", "custom-dictionary.json");
    const customContents = await readFile(customPath, "utf8");
    const customDict = JSON.parse(customContents);
    if (customDict.terms?.[word]) customDef = customDict.terms[word];
  } catch {}

  // Load rap dictionary slang def to potentially append later
  let rapDef: string | null = null;
  try {
    const filePath = join(process.cwd(), "app", "data", "rap-dictionary.json");
    const fileContents = await readFile(filePath, "utf8");
    const rapDict = JSON.parse(fileContents);
    if (rapDict.terms?.[word]) {
      const def = rapDict.terms[word];
      if (!def.includes("Proper noun, surname, place name")) rapDef = def;
    }
  } catch {}

  // The slang context to append (custom takes priority over rap dictionary)
  const slangContext = customDef ?? rapDef;

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

      // Append slang/name context if we have one
      if (slangContext) {
        definitions.push({ partOfSpeech: "slang context", definition: slangContext });
      }

      return Response.json({
        word: entry.word,
        phonetic: entry.phonetic,
        source: "dictionaryapi.dev",
        definitions,
      });
    }
  } catch {}

  // If no real definition found but we have a custom/slang def, return that
  if (slangContext) {
    return Response.json({
      word,
      source: "local",
      definitions: [{ partOfSpeech: "slang", definition: slangContext }],
    });
  }

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
  // Only accept if the returned word is clearly related (shares the same root as the query)
  const baseForms = [word.replace(/ing$/, ""), word.replace(/ed$/, ""), word.replace(/s$/, ""), word.replace(/es$/, "")];
  for (const base of baseForms) {
    if (base === word || base.length < 3) continue;
    try {
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(base)}`);
      if (res.ok) {
        const data = await res.json();
        const entry = data[0];
        const returned = entry.word.toLowerCase();
        // Only use if the returned word starts with the base we tried
        if (!returned.startsWith(base) && !base.startsWith(returned)) continue;
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
