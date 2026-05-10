import { NextRequest } from "next/server";

export const runtime = "nodejs";

const AUDIO_SERVER = process.env.AUDIO_SERVER_URL || "http://localhost:5001";

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

  try {
    const fwd = new FormData();
    fwd.append("file", file, (file as File).name || "audio.mp3");
    const res = await fetch(`${AUDIO_SERVER}/bpm`, { method: "POST", body: fwd, signal: AbortSignal.timeout(60000) });
    const data = await res.json();
    if (!res.ok) return Response.json({ error: data.error || "BPM detection failed" }, { status: 500 });
    return Response.json(data);
  } catch (err: any) {
    console.error("[detect-bpm] error:", err.message);
    return Response.json({ error: err.message || "BPM detection failed" }, { status: 500 });
  }
}
