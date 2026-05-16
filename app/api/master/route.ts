import { NextRequest } from "next/server";
import { writeFile, unlink, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let inputPath = "";
  let outputPath = "";

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const url = formData.get("url") as string | null;
    const platform = formData.get("platform") as string | null;

    const id = randomUUID();
    inputPath = join(tmpdir(), `master-in-${id}.mp3`);
    outputPath = join(tmpdir(), `master-out-${id}.mp3`);

    if (file) {
      const buf = Buffer.from(await file.arrayBuffer());
      await writeFile(inputPath, buf);
    } else if (url) {
      // Download via yt-dlp
      await execFileAsync("yt-dlp", [
        "--no-playlist",
        "-x", "--audio-format", "mp3",
        "--audio-quality", "0",
        "-o", inputPath.replace(".mp3", ".%(ext)s"),
        url,
      ], { timeout: 120000 });

      // yt-dlp may rename the file — find the actual output
      const actual = inputPath.replace(".mp3", ".mp3");
      inputPath = actual;
    } else {
      return Response.json({ error: "No file or URL provided" }, { status: 400 });
    }

    // Mastering chain:
    // 1. Normalize loudness to -14 LUFS (streaming standard)
    // 2. Gentle multiband compression via EQ + dynamic normalization
    // 3. Stereo widening with haas effect
    // 4. Hard limiter at -1 dBTP
    await execFileAsync("ffmpeg", [
      "-y",
      "-i", inputPath,
      "-af", [
        "equalizer=f=80:width_type=o:width=2:g=2",        // boost low end
        "equalizer=f=200:width_type=o:width=2:g=-1",      // cut muddy mids
        "equalizer=f=3000:width_type=o:width=2:g=1.5",    // presence boost
        "equalizer=f=10000:width_type=o:width=2:g=2",     // air/sparkle
        "acompressor=threshold=-18dB:ratio=3:attack=5:release=100:makeup=3", // compression
        "dynaudnorm=p=0.95:m=100:s=12", // dynamic normalization
        "loudnorm=I=-14:TP=-1:LRA=11",  // LUFS normalization
        "alimiter=level_in=1:level_out=1:limit=0.891:attack=5:release=50", // true peak limiter
      ].join(","),
      "-c:a", "libmp3lame",
      "-b:a", "320k",
      "-q:a", "0",
      outputPath,
    ], { timeout: 180000 });

    const outBuf = await readFile(outputPath);

    return new Response(outBuf, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": `attachment; filename="mastered.mp3"`,
        "Content-Length": String(outBuf.length),
      },
    });
  } catch (err: any) {
    console.error("[master] Error:", err.message);
    return Response.json({ error: err.message || "Mastering failed" }, { status: 500 });
  } finally {
    if (inputPath) unlink(inputPath).catch(() => {});
    if (outputPath) unlink(outputPath).catch(() => {});
  }
}
