import { NextRequest } from "next/server";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { execFile } from "child_process";
import { promisify } from "util";

export const runtime = "nodejs";
const execFileAsync = promisify(execFile);

const PYTHON_SCRIPT = `
import sys, json, tempfile, os
import numpy as np

MAJOR_KEY_NAMES = ["C","C#","D","Eb","E","F","F#","G","Ab","A","Bb","B"]
MINOR_KEY_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","Bb","B"]
MAJOR_PROFILE = [6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88]
MINOR_PROFILE = [6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17]

def key_name(i, scale): return MAJOR_KEY_NAMES[i] if scale=="major" else MINOR_KEY_NAMES[i]
def pearson(a,b): a,b=np.array(a),np.array(b); return np.corrcoef(a,b)[0,1]

path = sys.argv[1]
import librosa
y, sr = librosa.load(path, sr=None, mono=True, duration=120)
chroma = librosa.feature.chroma_cqt(y=y, sr=sr, bins_per_octave=36)
mean_chroma = np.mean(chroma, axis=1)
mean_chroma = mean_chroma / mean_chroma.max()
best_key, best_scale, best_corr = 0, "major", -np.inf
for i in range(12):
    maj = pearson(mean_chroma, np.roll(MAJOR_PROFILE, i))
    min_ = pearson(mean_chroma, np.roll(MINOR_PROFILE, i))
    if maj > best_corr: best_corr, best_key, best_scale = maj, i, "major"
    if min_ > best_corr: best_corr, best_key, best_scale = min_, i, "minor"
strength = float(np.clip((best_corr+1)/2, 0, 1))
rel_idx = (best_key+9)%12 if best_scale=="major" else (best_key+3)%12
rel_scale = "minor" if best_scale=="major" else "major"
print(json.dumps({"key":key_name(best_key,best_scale),"scale":best_scale,"strength":round(strength,3),"relativeKey":key_name(rel_idx,rel_scale),"relativeScale":rel_scale}))
`;

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof Blob)) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }

  const ext = (file as File).name?.split(".").pop() || "mp3";
  const audioPath = join(tmpdir(), `key-${Date.now()}.${ext}`);
  const scriptPath = join(tmpdir(), `detect-key-${Date.now()}.py`);

  try {
    const bytes = await file.arrayBuffer();
    await writeFile(audioPath, Buffer.from(bytes));
    await writeFile(scriptPath, PYTHON_SCRIPT);

    const { stdout, stderr } = await execFileAsync("python3", [scriptPath, audioPath], {
      timeout: 60000,
      encoding: "utf-8",
    });

    if (stderr) console.error("[detect-key] stderr:", stderr.slice(0, 200));
    const result = JSON.parse(stdout.trim());
    return Response.json(result);
  } catch (err: any) {
    console.error("[detect-key] error:", err.message);
    return Response.json({ error: err.message || "Key detection failed" }, { status: 500 });
  } finally {
    unlink(audioPath).catch(() => {});
    unlink(scriptPath).catch(() => {});
  }
}
