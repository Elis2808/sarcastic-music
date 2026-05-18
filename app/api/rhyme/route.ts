import { dictionary } from 'cmu-pronouncing-dictionary';
import { readFile } from 'fs/promises';
import { join } from 'path';

export const runtime = "nodejs";

interface RhymeResult {
  word: string;
  score: number;
  category: 'perfect' | 'sounding' | 'written' | 'near';
  rhymeType: 'both' | 'phonetic' | 'spelling' | 'partial';
}

function getRhymingPhones(phones: string[]): string {
  // Extract the rhyming part (from the last stressed vowel to the end)
  for (let i = phones.length - 1; i >= 0; i--) {
    const phone = phones[i];
    // Look for the last stressed vowel (ending with 1)
    if (phone.match(/\d+$/) && parseInt(phone[phone.length - 1]) === 1) {
      return phones.slice(i).join(' ');
    }
  }
  // If no stressed vowel found, use last vowel
  for (let i = phones.length - 1; i >= 0; i--) {
    const phone = phones[i];
    if (phone.match(/[AEIOU]/)) {
      return phones.slice(i).join(' ');
    }
  }
  return phones.join(' ');
}

function calculateWrittenRhymeScore(word1: string, word2: string): { score: number; isWrittenRhyme: boolean } {
  // Normalize: remove trailing numbers, lowercase
  const w1 = word1.replace(/\(\d+\)$/, '').toLowerCase();
  const w2 = word2.replace(/\(\d+\)$/, '').toLowerCase();
  
  if (w1 === w2) return { score: 0, isWrittenRhyme: false };
  
  // Get last 2-4 characters for comparison
  const maxCheck = Math.min(4, Math.min(w1.length, w2.length));
  let matchingChars = 0;
  
  for (let i = 1; i <= maxCheck; i++) {
    const end1 = w1.slice(-i);
    const end2 = w2.slice(-i);
    if (end1 === end2) {
      matchingChars = i;
    } else {
      break;
    }
  }
  
  // Need at least 2 matching ending characters for a written rhyme
  const isWrittenRhyme = matchingChars >= 2;
  const score = matchingChars * 10; // 20-40 points for written match
  
  return { score, isWrittenRhyme };
}

function calculateRhymeScore(phones1: string[], phones2: string[], word1: string, word2: string): { 
  score: number; 
  category: 'perfect' | 'sounding' | 'written' | 'near';
  rhymeType: 'both' | 'phonetic' | 'spelling' | 'partial';
} {
  const rhyme1 = getRhymingPhones(phones1);
  const rhyme2 = getRhymingPhones(phones2);
  
  // Check written (spelling) rhyme
  const writtenResult = calculateWrittenRhymeScore(word1, word2);
  const isWrittenRhyme = writtenResult.isWrittenRhyme;
  
  // Perfect phonetic match
  if (rhyme1 === rhyme2) {
    const score = 100 + (isWrittenRhyme ? 10 : 0);
    const category = isWrittenRhyme ? 'perfect' : 'sounding';
    const rhymeType: RhymeResult['rhymeType'] = isWrittenRhyme ? 'both' : 'phonetic';
    return { score, category, rhymeType };
  }
  
  // Check similarity for sounding and near rhymes
  const r1Parts = rhyme1.split(' ');
  const r2Parts = rhyme2.split(' ');
  
  let matches = 0;
  const minLength = Math.min(r1Parts.length, r2Parts.length);
  
  // Compare from the end (rhyming part)
  for (let i = 0; i < minLength; i++) {
    if (r1Parts[r1Parts.length - 1 - i] === r2Parts[r2Parts.length - 1 - i]) {
      matches++;
    } else {
      break;
    }
  }
  
  // More lenient categorization with usefulness scoring
  if (matches >= 1) {
    const similarity = matches / Math.max(r1Parts.length, r2Parts.length);
    let baseScore = 0;
    
    // Perfect: identical rhyming phones (already handled above)
    // Sounding: high similarity or multiple matching phones
    if (matches >= 2 || (matches === 1 && similarity >= 0.5)) {
      baseScore = 75 + similarity * 20;
    }
    // Near: at least one matching phone
    else if (matches === 1) {
      baseScore = 40 + similarity * 30;
    }
    
    // Apply usefulness modifiers
    let usefulnessScore = baseScore;
    
    // Favor shorter words (more usable)
    if (word2.length <= 4) {
      usefulnessScore += 10;
    } else if (word2.length <= 6) {
      usefulnessScore += 5;
    }
    
    // Favor common English words
    const commonWords = ['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use'];
    if (commonWords.includes(word2.toLowerCase())) {
      usefulnessScore += 15;
    }
    
    // Penalize very long or complex words
    if (word2.length > 8) {
      usefulnessScore -= 5;
    }
    
    // Penalize words with numbers or unusual characters
    if (/\d/.test(word2)) {
      usefulnessScore -= 10;
    }
    
    // Determine category based on phonetic + written match
    let category: RhymeResult['category'];
    let rhymeType: RhymeResult['rhymeType'];
    let finalScore = usefulnessScore;
    
    if (matches >= 2 || (matches === 1 && similarity >= 0.5)) {
      if (isWrittenRhyme) {
        category = 'perfect';
        rhymeType = 'both';
        finalScore += 15; // Boost for both types matching
      } else {
        category = 'sounding';
        rhymeType = 'phonetic';
      }
    } else {
      category = 'near';
      rhymeType = 'partial';
    }
    
    // Add written rhyme bonus if applicable
    if (isWrittenRhyme && rhymeType !== 'both') {
      finalScore += writtenResult.score;
      category = 'written';
      rhymeType = 'spelling';
    }
    
    return { score: Math.max(0, finalScore), category, rhymeType };
  }
  
  // Check for written-only rhyme (no phonetic match but spelling match)
  if (isWrittenRhyme && writtenResult.score > 0) {
    return { 
      score: Math.max(20, writtenResult.score), 
      category: 'written', 
      rhymeType: 'spelling' 
    };
  }
  
  return { score: 0, category: 'near', rhymeType: 'partial' }; // No rhyme
}

function normalizeWord(word: string): string {
  // Remove punctuation for duplicate detection
  return word.replace(/[.'"',]/g, '').toLowerCase();
}

function filterWord(word: string): boolean {
  // Keep all words, just filter out quotes and commas
  return !word.includes('"') && !word.includes(',');
}

function addApostrophes(word: string): string {
  // Common contractions that might be typed without apostrophes
  const contractions: Record<string, string> = {
    'dont': "don't",
    'cant': "can't", 
    'wont': "won't",
    'didnt': "didn't",
    'couldnt': "couldn't",
    'shouldnt': "shouldn't",
    'wouldnt': "wouldn't",
    'doesnt': "doesn't",
    'havent': "haven't",
    'hasnt': "hasn't",
    'hadnt': "hadn't",
    'wasnt': "wasn't",
    'werent': "weren't",
    'arent': "aren't",
    'isnt': "isn't",
    'am': "am",
    'im': "i'm",
    'youre': "you're",
    'theyre': "they're",
    'were': "we're",
    'ive': "i've",
    'youve': "you've",
    'weve': "we've",
    'theyve': "they've",
    'id': "i'd",
    'youd': "you'd",
    'hed': "he'd",
    'shed': "she'd",
    'wed': "we'd",
    'theyd': "they'd",
    'ill': "i'll",
    'youll': "you'll",
    'hell': "he'll",
    'shell': "she'll",
    'well': "we'll",
    'theyll': "they'll"
  };
  
  return contractions[word.toLowerCase()] || word;
}

// Single-pass phoneme approximator — handles slang/foreign words not in CMU
// Processes longest matches first so 'tch' beats 't', 'sh' beats 's', etc.
function approximatePhones(word: string): string | null {
  if (!word || word.length < 1) return null;
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return null;

  // Ordered rules: longest patterns first to avoid partial matches
  const rules: [string, string][] = [
    // Multi-char combos
    ['tch',  'CH'],
    ['ck',   'K'],
    ['ph',   'F'],
    ['qu',   'K W'],
    ['sh',   'SH'],
    ['ch',   'CH'],
    ['th',   'DH'],
    ['ng',   'NG'],
    ['wr',   'R'],
    ['kn',   'N'],
    ['gn',   'N'],
    ['wh',   'W'],
    ['gh',   ''],
    // Vowel digraphs
    ['oo',   'UW1'],
    ['ee',   'IY1'],
    ['ea',   'IY1'],
    ['ai',   'EY1'],
    ['ay',   'EY1'],
    ['oa',   'OW1'],
    ['ou',   'AW1'],
    ['ow',   'OW1'],
    ['oi',   'OY1'],
    ['oy',   'OY1'],
    ['au',   'AO1'],
    ['aw',   'AO1'],
    ['ie',   'AY1'],
    ['ue',   'UW1'],
    // Single vowels (trailing e = long vowel handled below)
    ['a',    'AH0'],
    ['e',    'EH1'],
    ['i',    'IH1'],
    ['o',    'AO1'],
    ['u',    'AH1'],
    ['y',    'IY1'],
    // Consonants
    ['b',    'B'],
    ['c',    'K'],
    ['d',    'D'],
    ['f',    'F'],
    ['g',    'G'],
    ['h',    'HH'],
    ['j',    'JH'],
    ['k',    'K'],
    ['l',    'L'],
    ['m',    'M'],
    ['n',    'N'],
    ['p',    'P'],
    ['q',    'K'],
    ['r',    'R'],
    ['s',    'S'],
    ['t',    'T'],
    ['v',    'V'],
    ['w',    'W'],
    ['x',    'K S'],
    ['z',    'Z'],
  ];

  const phones: string[] = [];
  let i = 0;
  while (i < w.length) {
    let matched = false;
    for (const [pat, phone] of rules) {
      if (w.startsWith(pat, i)) {
        if (phone) phones.push(...phone.split(' '));
        i += pat.length;
        matched = true;
        break;
      }
    }
    if (!matched) i++;
  }

  if (phones.length === 0) return null;
  return phones.join(' ');
}

export async function POST(req: Request) {
  const { word } = await req.json();

  const input = word?.toLowerCase().trim();

  if (!input) {
    return Response.json({ results: [] });
  }

  // Try to add apostrophes to common contractions
  const normalizedInput = addApostrophes(input);

  // Load rap dictionary
  let rapDictionary: any = null;
  try {
    const filePath = join(process.cwd(), 'app', 'data', 'rap-dictionary.json');
    const fileContents = await readFile(filePath, 'utf8');
    rapDictionary = JSON.parse(fileContents);
  } catch (error) {
    console.log('Rap dictionary not found, using only CMU dictionary');
  }

  // Load custom dictionary
  let customDictionary: any = null;
  try {
    const customPath = join(process.cwd(), 'app', 'data', 'custom-dictionary.json');
    const customContents = await readFile(customPath, 'utf8');
    customDictionary = JSON.parse(customContents);
  } catch {}

  // Check rap dictionary first for slang and rap terms
  if (rapDictionary) {
    const slangRhymes = rapDictionary.slang?.[normalizedInput.toLowerCase()];
    const rapTermRhymes = rapDictionary.rap_terms?.[normalizedInput.toLowerCase()];
    
        
    if (slangRhymes || rapTermRhymes) {
      const rapResults: RhymeResult[] = [];
      
      // Add slang rhymes with high score (rap terms get priority)
      if (slangRhymes) {
        slangRhymes.forEach((rhyme: string) => {
          if (filterWord(rhyme)) {
            rapResults.push({
              word: rhyme.charAt(0).toUpperCase() + rhyme.slice(1),
              score: 95,
              category: 'perfect', // Rap dictionary words are treated as perfect matches
              rhymeType: 'both'
            });
          }
        });
      }
      
      // Add rap term rhymes
      if (rapTermRhymes) {
        rapTermRhymes.forEach((rhyme: string) => {
          if (filterWord(rhyme)) {
            rapResults.push({
              word: rhyme.charAt(0).toUpperCase() + rhyme.slice(1),
              score: 90,
              category: 'perfect', // Rap dictionary words are treated as perfect matches
              rhymeType: 'both'
            });
          }
        });
      }
      
      // Sort by score and return rap dictionary results
      rapResults.sort((a, b) => b.score - a.score);
      const topResults = rapResults.slice(0, 20).map(r => r.word);
      const allResults = rapResults.map(r => r.word);

      // Categorize rap results with rhyme types
      const perfectRhymes = rapResults.filter(r => r.category === 'perfect').map(r => r.word);
      const soundingRhymes = rapResults.filter(r => r.category === 'sounding').map(r => r.word);
      const writtenRhymes = rapResults.filter(r => r.category === 'written').map(r => r.word);
      const nearRhymes = rapResults.filter(r => r.category === 'near').map(r => r.word);
      
      return Response.json({
        results: rapResults.slice(0, 20).map(r => ({ word: r.word, category: r.category, rhymeType: r.rhymeType })),
        allResults: rapResults.map(r => ({ word: r.word, category: r.category, rhymeType: r.rhymeType })),
        totalFound: rapResults.length,
        source: 'rap-dictionary',
        rhymeTypes: {
          both: rapResults.filter(r => r.rhymeType === 'both').map(r => r.word),
          phonetic: rapResults.filter(r => r.rhymeType === 'phonetic').map(r => r.word),
          spelling: rapResults.filter(r => r.rhymeType === 'spelling').map(r => r.word),
          partial: rapResults.filter(r => r.rhymeType === 'partial').map(r => r.word)
        },
        categories: {
          perfect: perfectRhymes,
          sounding: soundingRhymes,
          written: writtenRhymes,
          near: nearRhymes
        }
      });
    }
  }

  // Clean input word (remove suffixes) and get phones from CMU dictionary
  const cleanInput = normalizedInput.replace(/\(\d+\)$/, '');
  let inputPhones: string | null = dictionary[cleanInput] ?? null;

  // Fallback: approximate pronunciation from spelling for slang/foreign words not in CMU
  if (!inputPhones) {
    inputPhones = approximatePhones(cleanInput);
  }

  if (!inputPhones) {
    return Response.json({ results: [] });
  }

  const inputPhoneArray = inputPhones.split(' ');
  const results: RhymeResult[] = [];
  const processedWords = new Set<string>();

  // 1. Search CMU dictionary (standard English words with known pronunciations)
  for (const [candidateWord, candidatePhones] of Object.entries(dictionary)) {
    const cleanWord = candidateWord.replace(/\(\d+\)$/, '');
    const normalizedWord = normalizeWord(cleanWord);
    if (normalizedWord === input || processedWords.has(normalizedWord) || !filterWord(cleanWord)) continue;
    const candidatePhoneArray = (candidatePhones as string).split(' ');
    const rhymeResult = calculateRhymeScore(inputPhoneArray, candidatePhoneArray, normalizedInput, cleanWord);
    if (rhymeResult.score > 0) {
      results.push({
        word: cleanWord.charAt(0).toUpperCase() + cleanWord.slice(1),
        score: rhymeResult.score,
        rhymeType: rhymeResult.rhymeType,
        category: rhymeResult.category
      });
      processedWords.add(normalizedWord);
    }
  }

  // 2. Also search rap dictionary words using phonetic approximation
  // Only include words with real definitions (not generic "Proper noun" placeholders)
  // to keep the candidate set small (~5-10k words) and relevant
  if (rapDictionary?.terms) {
    for (const [candidateWord, definition] of Object.entries(rapDictionary.terms)) {
      // Skip generic placeholder definitions — only real slang/defined words
      if ((definition as string).startsWith('Proper noun, surname')) continue;
      const cleanWord = candidateWord.toLowerCase().trim();
      const normalizedWord = normalizeWord(cleanWord);
      if (normalizedWord === input || processedWords.has(normalizedWord) || !filterWord(cleanWord)) continue;
      if (dictionary[cleanWord]) continue; // already covered by CMU above
      const approxPhones = approximatePhones(cleanWord);
      if (!approxPhones) continue;
      const candidatePhoneArray = approxPhones.split(' ');
      const rhymeResult = calculateRhymeScore(inputPhoneArray, candidatePhoneArray, normalizedInput, cleanWord);
      if (rhymeResult.score > 0) {
        results.push({
          word: cleanWord.charAt(0).toUpperCase() + cleanWord.slice(1),
          score: rhymeResult.score,
          rhymeType: rhymeResult.rhymeType,
          category: rhymeResult.category
        });
        processedWords.add(normalizedWord);
      }
    }
  }

  // 3. Search custom dictionary words as phonetic candidates
  if (customDictionary?.terms) {
    for (const candidateWord of Object.keys(customDictionary.terms)) {
      const cleanWord = candidateWord.toLowerCase().trim();
      const normalizedWord = normalizeWord(cleanWord);
      if (normalizedWord === input || processedWords.has(normalizedWord) || !filterWord(cleanWord)) continue;
      if (dictionary[cleanWord]) continue;
      const approxPhones = approximatePhones(cleanWord);
      if (!approxPhones) continue;
      const candidatePhoneArray = approxPhones.split(' ');
      const rhymeResult = calculateRhymeScore(inputPhoneArray, candidatePhoneArray, normalizedInput, cleanWord);
      if (rhymeResult.score > 0) {
        results.push({
          word: cleanWord.charAt(0).toUpperCase() + cleanWord.slice(1),
          score: rhymeResult.score,
          rhymeType: rhymeResult.rhymeType,
          category: rhymeResult.category
        });
        processedWords.add(normalizedWord);
      }
    }
  }

  // Sort by score (descending) - closest rhymes first
  results.sort((a, b) => b.score - a.score);
  
  // Categorize results
  const perfectRhymes = results.filter(r => r.category === 'perfect').map(r => r.word);
  const soundingRhymes = results.filter(r => r.category === 'sounding').map(r => r.word);
  const writtenRhymes = results.filter(r => r.category === 'written').map(r => r.word);
  const nearRhymes = results.filter(r => r.category === 'near').map(r => r.word);

  return Response.json({
    results: results.slice(0, 20).map(r => ({ word: r.word, category: r.category, rhymeType: r.rhymeType })),
    allResults: results.map(r => ({ word: r.word, category: r.category, rhymeType: r.rhymeType })),
    totalFound: results.length,
    source: 'cmu-dictionary',
    rhymeTypes: {
      both: results.filter(r => r.rhymeType === 'both').map(r => r.word),
      phonetic: results.filter(r => r.rhymeType === 'phonetic').map(r => r.word),
      spelling: results.filter(r => r.rhymeType === 'spelling').map(r => r.word),
      partial: results.filter(r => r.rhymeType === 'partial').map(r => r.word)
    },
    categories: {
      perfect: perfectRhymes,
      sounding: soundingRhymes,
      written: writtenRhymes,
      near: nearRhymes
    }
  });
}