import { NextRequest } from "next/server";
import { writeFile, unlink, readFile, mkdir, readdir } from "fs/promises";
import { join, basename, extname } from "path";
import { tmpdir } from "os";
import { execFile } from "child_process";
import { promisify } from "util";
import { existsSync } from "fs";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
const execFileAsync = promisify(execFile);

// Filesystem-based job state — works across all worker processes
const JOB_DIR = join(tmpdir(), "sep-jobs");

type JobState = {
  status: "pending" | "processing" | "done" | "error";
  error?: string;
  resultPath?: string;
  dlName?: string;
  outDir?: string;
  createdAt: number;
};

async function ensureJobDir() {
  await mkdir(JOB_DIR, { recursive: true });
}

async function writeJob(jobId: string, state: JobState) {
  await ensureJobDir();
  await writeFile(join(JOB_DIR, `${jobId}.json`), JSON.stringify(state));
}

async function readJob(jobId: string): Promise<JobState | null> {
  try {
    const raw = await readFile(join(JOB_DIR, `${jobId}.json`), "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function deleteJob(jobId: string) {
  await unlink(join(JOB_DIR, `${jobId}.json`)).catch(() => {});
}

async function countActiveJobs(): Promise<number> {
  await ensureJobDir();
  const files = await readdir(JOB_DIR).catch(() => [] as string[]);
  let count = 0;
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    try {
      const raw = await readFile(join(JOB_DIR, f), "utf-8");
      const job: JobState = JSON.parse(raw);
      if (job.createdAt < cutoff) {
        await unlink(join(JOB_DIR, f)).catch(() => {});
        continue;
      }
      if (job.status === "pending" || job.status === "processing") count++;
    } catch {}
  }
  return count;
}

async function runSeparation(jobId: string, audioPath: string, outDir: string, stem: string, originalName: string) {
  await writeJob(jobId, { status: "processing", outDir, createdAt: Date.now() });

  try {
    const model = "htdemucs_ft";
    const demucs = process.env.DEMUCS_PATH || "demucs";

    console.log(`[separate:${jobId}] Running demucs model=${model} stem=${stem}`);
    const { stderr } = await execFileAsync(
      demucs,
      ["-n", model, "--two-stems", "vocals", "--jobs", "1", "--mp3", "--mp3-bitrate", "256", "-o", outDir, audioPath],
      { timeout: 600000, encoding: "utf-8" }
    );
    if (stderr) console.error(`[separate:${jobId}] stderr:`, stderr.slice(0, 600));

    const base = basename(audioPath, extname(audioPath));
    const wantedStem = stem === "no_vocals" ? "no_vocals" : "vocals";
    const stemPath = join(outDir, model, base, `${wantedStem}.mp3`);

    console.log(`[separate:${jobId}] Looking for stem at: ${stemPath}`);
    const { stdout: lsAll } = await execFileAsync("find", [outDir, "-type", "f"], { encoding: "utf-8" }).catch(() => ({ stdout: "" }));
    console.log(`[separate:${jobId}] Files in outDir: ${lsAll.trim() || "none"}`);

    if (!existsSync(stemPath)) {
      throw new Error(`Output not found at ${stemPath}. Files: ${lsAll.trim() || "none"}`);
    }

    const dlName = `${originalName}_${wantedStem === "no_vocals" ? "instrumental" : "vocals"}.mp3`;
    await writeJob(jobId, { status: "done", resultPath: stemPath, dlName, outDir, createdAt: Date.now() });
    console.log(`[separate:${jobId}] Done`);
  } catch (err: any) {
    console.error(`[separate:${jobId}] error:`, err.message);
    await writeJob(jobId, { status: "error", error: err.message || "Separation failed", outDir, createdAt: Date.now() });
    import("fs").then(fs => fs.rmSync(outDir, { recursive: true, force: true })).catch(() => {});
  } finally {
    unlink(audioPath).catch(() => {});
  }
}

const MAX_CONCURRENT = 2;

// POST /api/separate — start a job, return jobId immediately
export async function POST(request: NextRequest) {
  const active = await countActiveJobs();
  if (active >= MAX_CONCURRENT) {
    return Response.json({ error: "Server is busy, please try again in a moment" }, { status: 429 });
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

  const jobId = randomUUID();
  const ext = (file as File).name?.split(".").pop() || "mp3";
  const originalName = (file as File).name?.replace(/\.[^.]+$/, "") || "track";
  const audioPath = join(tmpdir(), `sep-${jobId}.${ext}`);
  const outDir = join(tmpdir(), `sep-out-${jobId}`);

  await writeJob(jobId, { status: "pending", outDir, createdAt: Date.now() });

  try {
    const bytes = await file.arrayBuffer();
    await writeFile(audioPath, Buffer.from(bytes));
    await mkdir(outDir, { recursive: true });
  } catch {
    await deleteJob(jobId);
    return Response.json({ error: "Failed to save file" }, { status: 500 });
  }

  // Fire and forget — runs in background, client polls for status
  runSeparation(jobId, audioPath, outDir, stem, originalName);

  return Response.json({ jobId });
}

// GET /api/separate?id=<jobId> — poll status or fetch result
export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get("id");
  if (!jobId) return Response.json({ error: "Missing id" }, { status: 400 });

  const job = await readJob(jobId);
  if (!job) return Response.json({ error: "Job not found" }, { status: 404 });

  if (job.status === "done" && job.resultPath && job.dlName) {
    const audioBuffer = await readFile(job.resultPath).catch(() => null);
    if (!audioBuffer) return Response.json({ error: "Result file missing" }, { status: 500 });
    await deleteJob(jobId);
    unlink(job.resultPath).catch(() => {});
    if (job.outDir) import("fs").then(fs => fs.rmSync(job.outDir!, { recursive: true, force: true })).catch(() => {});
    return new Response(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": `attachment; filename="${job.dlName}"`,
      },
    });
  }

  if (job.status === "error") {
    await deleteJob(jobId);
    return Response.json({ error: job.error || "Separation failed" }, { status: 500 });
  }

  return Response.json({ status: job.status });
}
