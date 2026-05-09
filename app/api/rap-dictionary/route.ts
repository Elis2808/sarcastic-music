import { readFile } from 'fs/promises';
import { join } from 'path';

export const runtime = "nodejs";

export async function GET() {
  try {
    const filePath = join(process.cwd(), 'app', 'data', 'rap-dictionary.json');
    const fileContents = await readFile(filePath, 'utf8');
    const rapDictionary = JSON.parse(fileContents);
    return Response.json(rapDictionary);
  } catch (error) {
    console.error('Error loading rap dictionary:', error);
    return Response.json({ error: 'Failed to load rap dictionary' }, { status: 500 });
  }
}
