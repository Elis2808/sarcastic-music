import { NextRequest } from "next/server";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { execFile } from "child_process";
import { promisify } from "util";

export const runtime = "nodejs";
const execFileAsync = promisify(execFile);

const PYTHON_SCRIPT = `
import sys, json
path = sys.argv[1]
import essentia.standard as es
audio = es.MonoLoader(filename=path, sampleRate=44100)()
bpm, beats, _, _, _ = es.RhythmExtractor2013(method="multifeature")(audio)
print(json.dumps({"bpm": round(float(bpm), 1), "timeSignature": "4/4", "beatCount": int(len(beats))}))
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
  const audioPath = join(tmpdir(), `bpm-${Date.now()}.${ext}`);
  const scriptPath = join(tmpdir(), `detect-bpm-${Date.now()}.py`);

  try {
    const bytes = await file.arrayBuffer();
    await writeFile(audioPath, Buffer.from(bytes));
    await writeFile(scriptPath, PYTHON_SCRIPT);

    const { stdout, stderr } = await execFileAsync("python3", [scriptPath, audioPath], {
      timeout: 60000,
      encoding: "utf-8",
    });

    if (stderr) console.error("[detect-bpm] stderr:", stderr.slice(0, 200));
    const result = JSON.parse(stdout.trim());
    return Response.json(result);
  } catch (err: any) {
    console.error("[detect-bpm] error:", err.message);
    return Response.json({ error: err.message || "BPM detection failed" }, { status: 500 });
  } finally {
    unlink(audioPath).catch(() => {});
    unlink(scriptPath).catch(() => {});
  }
}
