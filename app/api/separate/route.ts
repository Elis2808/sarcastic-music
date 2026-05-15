import { NextRequest } from "next/server";
import { writeFile, unlink, readFile, mkdir, readdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import Replicate from "replicate";

const execFileAsync = promisify(execFile);

export const runtime = "nodejs";

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN! });

// Filesystem-based job state — works across all worker processes
const JOB_DIR = join(tmpdir(), "sep-jobs");

type JobState = {
  status: "pending" | "processing" | "done" | "error";
  error?: string;
  dlName?: string;
  stemUrl?: string;
  progress?: number;
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

const MIME_MAP: Record<string, string> = {
  mp3: "audio/mpeg", m4a: "audio/mp4", wav: "audio/wav",
  flac: "audio/flac", ogg: "audio/ogg", aac: "audio/aac", webm: "audio/webm",
};

// Extract a plain URL string from a Replicate FileOutput object or string
async function resolveUrl(val: any): Promise<string | null> {
  if (!val) return null;
  if (typeof val === "string") return val;
  if (typeof val.url === "function") return String(await val.url());
  if (typeof val.url === "string") return val.url;
  return null;
}

// Download a URL to a local temp file, return the path
async function downloadToTmp(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
}

async function runSeparation(jobId: string, audioPath: string, stem: string, originalName: string) {
  await writeJob(jobId, { status: "processing", createdAt: Date.now() });
  const tmpFiles: string[] = [];
  try {
    // Upload file to Replicate
    console.log(`[separate:${jobId}] Uploading to Replicate...`);
    const fileBytes = await readFile(audioPath);
    const ext = audioPath.split(".").pop()?.toLowerCase() ?? "mp3";
    const mime = MIME_MAP[ext] ?? "audio/mpeg";
    const uploadedFile = await replicate.files.create(new Blob([fileBytes], { type: mime }));
    const fileUrl = (uploadedFile as any).urls?.get ?? (uploadedFile as any).url;
    console.log(`[separate:${jobId}] Uploaded. Running htdemucs on Replicate GPU...`);

    const output = await replicate.run("cjwbw/demucs:25a173108cff36ef9f80f854c162d01df9e6528be175794b81158fa03836d953", {
      input: { audio: fileUrl, model: "htdemucs", two_stems: "vocals" },
    }) as any;

    console.log(`[separate:${jobId}] Output keys:`, Object.keys(output ?? {}));

    let stemUrl: string | null = null;

    if (stem === "vocals") {
      // Vocals stem — direct from output
      stemUrl = await resolveUrl(output?.vocals);
      if (!stemUrl) throw new Error(`No vocals in output: ${JSON.stringify(Object.keys(output ?? {}))}`);

    } else {
      // Instrumental — try no_vocals key first (if two_stems worked)
      stemUrl = await resolveUrl(output?.no_vocals);

      if (!stemUrl) {
        // two_stems not supported — mix bass + drums + other with ffmpeg
        console.log(`[separate:${jobId}] No no_vocals key — mixing bass+drums+other for instrumental`);
        const stemKeys = ["bass", "drums", "other"] as const;
        const localPaths: string[] = [];

        for (const key of stemKeys) {
          const url = await resolveUrl(output?.[key]);
          if (!url) continue;
          const p = join(tmpdir(), `sep-${jobId}-${key}.mp3`);
          await new Promise(r => setTimeout(r, 2000));
          await downloadToTmp(url, p);
          localPaths.push(p);
          tmpFiles.push(p);
        }

        if (localPaths.length === 0) throw new Error("No stems available to build instrumental");

        const mixedPath = join(tmpdir(), `sep-${jobId}-instrumental.mp3`);

        // ffmpeg amix: sum all stems into one file
        const inputs = localPaths.flatMap(p => ["-i", p]);
        await execFileAsync("ffmpeg", [
          "-y", ...inputs,
          "-filter_complex", `amix=inputs=${localPaths.length}:duration=longest:normalize=0`,
          "-c:a", "libmp3lame", "-b:a", "256k", mixedPath,
        ], { timeout: 120000 });

        const dlName = `${originalName}_instrumental.mp3`;
        await writeJob(jobId, { status: "done", stemUrl: `file://${mixedPath}`, dlName, createdAt: Date.now() });
        console.log(`[separate:${jobId}] Instrumental mixed locally — done`);
        return;
      }
    }

    const dlName = `${originalName}_${stem === "no_vocals" ? "instrumental" : "vocals"}.mp3`;
    await writeJob(jobId, { status: "done", stemUrl, dlName, createdAt: Date.now() });
    console.log(`[separate:${jobId}] Done — stem URL ready`);
  } catch (err: any) {
    console.error(`[separate:${jobId}] error:`, err.message);
    await writeJob(jobId, { status: "error", error: err.message || "Separation failed", createdAt: Date.now() });
  } finally {
    unlink(audioPath).catch(() => {});
    for (const f of tmpFiles) unlink(f).catch(() => {});
  }
}

const MAX_CONCURRENT = 3;

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

  await writeJob(jobId, { status: "pending", createdAt: Date.now() });

  try {
    const bytes = await file.arrayBuffer();
    await writeFile(audioPath, Buffer.from(bytes));
  } catch {
    await deleteJob(jobId);
    return Response.json({ error: "Failed to save file" }, { status: 500 });
  }

  // Fire and forget — runs in background, client polls for status
  runSeparation(jobId, audioPath, stem, originalName);

  return Response.json({ jobId });
}

// GET /api/separate?id=<jobId> — poll status or proxy download
export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get("id");
  if (!jobId) return Response.json({ error: "Missing id" }, { status: 400 });

  const job = await readJob(jobId);
  if (!job) return Response.json({ error: "Job not found" }, { status: 404 });

  if (job.status === "done" && job.stemUrl && job.dlName) {
    await deleteJob(jobId);
    const safeFilename = job.dlName.replace(/[^\x00-\x7F]/g, "").replace(/[^a-zA-Z0-9._\-]/g, "_") || "download.mp3";

    if (job.stemUrl.startsWith("file://")) {
      // Locally mixed instrumental — must proxy since it's on disk
      const localPath = job.stemUrl.slice(7);
      const audioBuffer = await readFile(localPath).catch(() => Buffer.alloc(0));
      unlink(localPath).catch(() => {});
      if (!audioBuffer.length) return Response.json({ error: "Result file missing" }, { status: 500 });
      return new Response(new Uint8Array(audioBuffer), {
        headers: {
          "Content-Type": "audio/mpeg",
          "Content-Disposition": `attachment; filename="${safeFilename}"`,
          "Content-Length": String(audioBuffer.length),
        },
      });
    }

    // Remote Replicate URL — redirect browser directly for instant download
    return Response.json({ downloadUrl: job.stemUrl, filename: safeFilename });
  }

  if (job.status === "error") {
    await deleteJob(jobId);
    return Response.json({ error: job.error || "Separation failed" }, { status: 500 });
  }

  return Response.json({ status: job.status, progress: job.progress ?? 0 });
}
