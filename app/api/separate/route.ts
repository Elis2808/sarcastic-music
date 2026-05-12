import { NextRequest } from "next/server";
import { writeFile, unlink, readFile, mkdir } from "fs/promises";
import { join, basename, extname } from "path";
import { tmpdir } from "os";
import { execFile } from "child_process";
import { promisify } from "util";
import { existsSync } from "fs";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
const execFileAsync = promisify(execFile);

type JobStatus = "pending" | "processing" | "done" | "error";
type Job = {
  status: JobStatus;
  error?: string;
  resultPath?: string;
  dlName?: string;
  createdAt: number;
};

const jobs = new Map<string, Job>();

// Clean up jobs older than 30 minutes
function pruneJobs() {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [id, job] of jobs.entries()) {
    if (job.createdAt < cutoff) {
      if (job.resultPath) unlink(job.resultPath).catch(() => {});
      jobs.delete(id);
    }
  }
}

async function runSeparation(jobId: string, audioPath: string, outDir: string, stem: string, originalName: string) {
  const job = jobs.get(jobId)!;
  job.status = "processing";

  try {
    const model = "htdemucs_ft";
    const demucs = process.env.DEMUCS_PATH || "demucs";

    console.log(`[separate:${jobId}] Running demucs model=${model} stem=${stem}`);
    const { stderr } = await execFileAsync(
      demucs,
      ["-n", model, "--two-stems", "vocals", "--jobs", "2", "--mp3", "--mp3-bitrate", "256", "-o", outDir, audioPath],
      { timeout: 600000, encoding: "utf-8" }
    );
    if (stderr) console.error(`[separate:${jobId}] stderr:`, stderr.slice(0, 300));

    const base = basename(audioPath, extname(audioPath));
    const wantedStem = stem === "no_vocals" ? "no_vocals" : "vocals";
    const stemPath = join(outDir, model, base, `${wantedStem}.mp3`);

    if (!existsSync(stemPath)) {
      const { stdout: lsOut } = await execFileAsync("find", [outDir, "-name", "*.mp3"], { encoding: "utf-8" }).catch(() => ({ stdout: "" }));
      throw new Error(`Output not found. Available: ${lsOut.trim() || "none"}`);
    }

    job.resultPath = stemPath;
    job.dlName = `${originalName}_${wantedStem === "no_vocals" ? "instrumental" : "vocals"}.mp3`;
    job.status = "done";
    console.log(`[separate:${jobId}] Done`);
  } catch (err: any) {
    console.error(`[separate:${jobId}] error:`, err.message);
    job.status = "error";
    job.error = err.message || "Separation failed";
  } finally {
    unlink(audioPath).catch(() => {});
  }
}

const MAX_CONCURRENT = 2;
let _activeJobs = 0;

// POST /api/separate — start a job, return jobId immediately
export async function POST(request: NextRequest) {
  pruneJobs();

  if (_activeJobs >= MAX_CONCURRENT) {
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

  _activeJobs++;

  const jobId = randomUUID();
  const ext = (file as File).name?.split(".").pop() || "mp3";
  const originalName = (file as File).name?.replace(/\.[^.]+$/, "") || "track";
  const audioPath = join(tmpdir(), `sep-${jobId}.${ext}`);
  const outDir = join(tmpdir(), `sep-out-${jobId}`);

  jobs.set(jobId, { status: "pending", createdAt: Date.now() });

  try {
    const bytes = await file.arrayBuffer();
    await writeFile(audioPath, Buffer.from(bytes));
    await mkdir(outDir, { recursive: true });
  } catch (err: any) {
    _activeJobs--;
    jobs.delete(jobId);
    return Response.json({ error: "Failed to save file" }, { status: 500 });
  }

  // Fire and forget — runs in background, client polls for status
  runSeparation(jobId, audioPath, outDir, stem, originalName).finally(() => {
    _activeJobs--;
    import("fs").then(fs => fs.rmSync(outDir, { recursive: true, force: true })).catch(() => {});
  });

  return Response.json({ jobId });
}

// GET /api/separate?id=<jobId> — poll status or fetch result
export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get("id");
  if (!jobId) return Response.json({ error: "Missing id" }, { status: 400 });

  const job = jobs.get(jobId);
  if (!job) return Response.json({ error: "Job not found" }, { status: 404 });

  if (job.status === "done" && job.resultPath && job.dlName) {
    const audioBuffer = await readFile(job.resultPath).catch(() => null);
    if (!audioBuffer) return Response.json({ error: "Result file missing" }, { status: 500 });
    // Clean up after serving
    unlink(job.resultPath).catch(() => {});
    jobs.delete(jobId);
    return new Response(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": `attachment; filename="${job.dlName}"`,
      },
    });
  }

  if (job.status === "error") {
    jobs.delete(jobId);
    return Response.json({ error: job.error || "Separation failed" }, { status: 500 });
  }

  return Response.json({ status: job.status });
}
