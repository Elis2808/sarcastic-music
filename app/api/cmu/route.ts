import { dictionary } from 'cmu-pronouncing-dictionary';

export const runtime = "nodejs";

export async function GET() {
  try {
    // Convert the CMU dictionary to a plain object with phone arrays
    const dict: Record<string, string[]> = {};
    
    for (const [word, phones] of Object.entries(dictionary)) {
      // CMU dictionary stores phones as space-separated string, convert to array
      dict[word.toLowerCase()] = (phones as string).split(' ');
    }

    return Response.json(dict);
  } catch (error) {
    console.error('Error loading CMU dictionary:', error);
    return Response.json({ error: 'Failed to load dictionary' }, { status: 500 });
  }
}
