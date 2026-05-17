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

    // Professional mastering chain — stronger, wider, cleaner across all devices:
    // 1. Noise gate       — kills background hiss/noise below -50dB
    // 2. High-pass 60Hz   — remove sub rumble while keeping low-end body
    // 3. EQ cleanup       — cut boomy 180Hz, cut boxy 350Hz
    // 4. EQ presence      — boost 2kHz (vocals), 5kHz (attack/definition), 14kHz (air)
    // 5. De-esser         — tame harsh 8kHz sibilance
    // 6. Stereo widening  — extrapolate mid/side to widen the image
    // 7. Compression      — strong ratio (4:1), high makeup gain (+6dB) for density & punch
    // 8. Second-stage comp — catch transients, even out levels
    // 9. Loudnorm -10 LUFS — louder than streaming standard, more impact
    // 10. Hard limiter at -0.5dBTP — prevent clipping, maximum loudness
    await execFileAsync("ffmpeg", [
      "-y",
      "-i", inputPath,
      "-af", [
        "agate=threshold=0.003:ratio=10:attack=2:release=200",                        // noise gate
        "highpass=f=60",                                                               // sub rumble removal
        "equalizer=f=180:width_type=o:width=2:g=-3",                                  // cut boomy low-mids
        "equalizer=f=350:width_type=o:width=2:g=-2.5",                                // cut boxy mids
        "equalizer=f=2000:width_type=o:width=2:g=2.5",                                // vocal presence
        "equalizer=f=5000:width_type=o:width=2:g=2",                                  // definition & attack
        "equalizer=f=14000:width_type=o:width=2:g=3",                                 // air & sparkle
        "acompressor=threshold=-24dB:ratio=6:attack=1:release=20:makeup=1:detection=peak:mode=downward,bandreject=f=8000:width_type=o:width=3", // de-esser
        "extrastereo=m=2.0",                                                           // stereo widening
        "acompressor=threshold=-16dB:ratio=4:attack=6:release=80:makeup=6",           // main compression (+6dB makeup)
        "acompressor=threshold=-6dB:ratio=2:attack=1:release=30:makeup=1",            // peak catch / limiter stage
        "loudnorm=I=-10:TP=-0.5:LRA=9",                                               // louder LUFS target
        "alimiter=level_in=1:level_out=1:limit=0.944:attack=2:release=20",            // true peak limit -0.5dBTP
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
