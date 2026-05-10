import { NextRequest } from "next/server";
import { writeFile, unlink, readFile, mkdir } from "fs/promises";
import { join, basename, extname } from "path";
import { tmpdir } from "os";
import { execFile } from "child_process";
import { promisify } from "util";
import { existsSync } from "fs";

export const runtime = "nodejs";
const execFileAsync = promisify(execFile);

let _separationBusy = false;

export async function POST(request: NextRequest) {
  if (_separationBusy) {
    return Response.json({ error: "Server busy processing another request, try again shortly" }, { status: 429 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  const stem = (formData.get("stem") as string) ?? "no_vocals";

  if (!file || !(file instanceof Blob)) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }

  _separationBusy = true;

  const ext = (file as File).name?.split(".").pop() || "mp3";
  const originalName = (file as File).name?.replace(/\.[^.]+$/, "") || "track";
  const audioPath = join(tmpdir(), `sep-${Date.now()}.${ext}`);
  const outDir = join(tmpdir(), `sep-out-${Date.now()}`);

  try {
    const bytes = await file.arrayBuffer();
    await writeFile(audioPath, Buffer.from(bytes));
    await mkdir(outDir, { recursive: true });

    const model = "htdemucs";
    const demucs = process.env.DEMUCS_PATH || "demucs";

    console.log(`[separate] Running demucs model=${model} stem=${stem}`);
    const { stdout, stderr } = await execFileAsync(
      demucs,
      ["-n", model, "--two-stems", "vocals", "--jobs", "1", "--mp3", "--mp3-bitrate", "256", "-o", outDir, audioPath],
      { timeout: 600000, encoding: "utf-8" }
    );
    if (stderr) console.error("[separate] stderr:", stderr.slice(0, 300));

    const base = basename(audioPath, extname(audioPath));
    // htdemucs outputs: <outDir>/<model>/<basename>/<stem>.mp3
    // stem is "vocals" or "no_vocals" depending on what was requested
    const wantedStem = stem === "no_vocals" ? "no_vocals" : "vocals";
    const stemPath = join(outDir, model, base, `${wantedStem}.mp3`);

    if (!existsSync(stemPath)) {
      // Log what actually exists to help debug
      const { stdout: lsOut } = await execFileAsync("find", [outDir, "-name", "*.mp3"], { encoding: "utf-8" }).catch(() => ({ stdout: "" }));
      console.error("[separate] expected file not found:", stemPath, "| found:", lsOut.trim());
      return Response.json({ error: `Output not found. Available: ${lsOut.trim() || "none"}` }, { status: 500 });
    }

    const audioBuffer = await readFile(stemPath);
    const dlName = `${originalName}_${wantedStem === "no_vocals" ? "instrumental" : "vocals"}.mp3`;
    return new Response(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": `attachment; filename="${dlName}"`,
      },
    });
  } catch (err: any) {
    console.error("[separate] error:", err.message);
    return Response.json({ error: err.message || "Separation failed" }, { status: 500 });
  } finally {
    _separationBusy = false;
    unlink(audioPath).catch(() => {});
    import("fs").then(fs => fs.rmSync(outDir, { recursive: true, force: true })).catch(() => {});
  }
}
