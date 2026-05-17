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

    // Mastering chain optimised for cars, speakers, iPhone & AirPods:
    // 1. High-pass at 80 Hz — removes rumble, sub-bass mud, cleans up small speakers
    // 2. Cut 150-200 Hz — removes boominess that masks clarity in car subs & earbuds
    // 3. Cut 400 Hz — removes boxiness / honky mid-range
    // 4. Boost 2.5 kHz — vocal presence, cuts through car noise & earbuds
    // 5. Boost 5 kHz — definition, attack, snare snap
    // 6. Boost 12 kHz — air & sparkle, makes AirPods/earbuds sound open
    // 7. Gentle compression — tightens dynamics without pumping
    // 8. Dynamic normalisation — consistent level
    // 9. Loudnorm -14 LUFS — streaming standard
    // 10. True peak limiter at -1 dBTP
    await execFileAsync("ffmpeg", [
      "-y",
      "-i", inputPath,
      "-af", [
        "highpass=f=80",                                             // remove rumble below 80 Hz
        "equalizer=f=150:width_type=o:width=2:g=-2.5",              // cut boomy low-mids
        "equalizer=f=400:width_type=o:width=2:g=-2",                // cut boxy mids
        "equalizer=f=2500:width_type=o:width=2:g=2",                // presence / vocal clarity
        "equalizer=f=5000:width_type=o:width=2:g=1.5",              // definition & attack
        "equalizer=f=12000:width_type=o:width=2:g=2.5",             // air / openness
        "acompressor=threshold=-24dB:ratio=6:attack=1:release=20:makeup=1:detection=peak:mode=downward,bandreject=f=8000:width_type=o:width=3", // de-esser: compress + notch sibilance 6-10kHz
        "acompressor=threshold=-20dB:ratio=2.5:attack=8:release=120:makeup=2", // gentle compression
        "dynaudnorm=p=0.95:m=100:s=12",                             // dynamic normalisation
        "loudnorm=I=-14:TP=-1:LRA=11",                              // LUFS target
        "alimiter=level_in=1:level_out=1:limit=0.891:attack=5:release=50", // true peak limit
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
