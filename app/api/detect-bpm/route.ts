import { NextRequest } from "next/server";
import { checkRateLimit, getClientIp } from "@/app/lib/rateLimit";

export const runtime = "nodejs";

const AUDIO_SERVER = process.env.AUDIO_SERVER_URL || "http://localhost:5001";

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const { allowed } = checkRateLimit(ip, "detect-bpm", 50);
  if (!allowed) return Response.json({ error: "Daily limit reached. Try again tomorrow." }, { status: 429 });

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
