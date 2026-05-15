import { NextRequest } from "next/server";
import { spawn } from "child_process";
import { tmpdir } from "os";
import { join } from "path";
import { mkdtemp, readFile, rm } from "fs/promises";

export const runtime = "nodejs";

// ─── Concurrency limiter ──────────────────────────────────────────────────────
let activeJobs = 0;
const MAX_JOBS = 2;

// ─── Supported hosts ──────────────────────────────────────────────────────────
const SUPPORTED_HOSTS = [
  "youtube.com", "youtu.be", "tiktok.com", "instagram.com",
  "facebook.com", "fb.watch", "twitter.com", "x.com",
  "soundcloud.com", "vimeo.com", "twitch.tv", "dailymotion.com",
  "reddit.com", "spotify.com", "open.spotify.com", "apple.com",
  "music.apple.com", "bandcamp.com", "mixcloud.com"
];

function isValidUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return SUPPORTED_HOSTS.some(h => host.includes(h));
  } catch { return false; }
}

function getPlatform(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host.includes("youtube") || host === "youtu.be") return "youtube";
    if (host.includes("soundcloud")) return "soundcloud";
    if (host.includes("tiktok")) return "tiktok";
    if (host.includes("instagram")) return "instagram";
    if (host.includes("facebook") || host === "fb.watch") return "facebook";
    if (host.includes("twitter") || host === "x.com") return "twitter";
    if (host.includes("vimeo")) return "vimeo";
    if (host.includes("twitch")) return "twitch";
    if (host.includes("spotify")) return "spotify";
    if (host.includes("apple")) return "apple";
    if (host.includes("bandcamp")) return "bandcamp";
    return "unknown";
  } catch { return "unknown"; }
}

const BASE_ARGS = ["--no-playlist", "--no-cache-dir", "--socket-timeout", "8", "--retries", "2"];

// ─── Unified spawn with timeout ───────────────────────────────────────────────
function spawnYtDlp(
  args: string[],
  timeoutMs: number
): Promise<{ stdout: string; stderr: string; code: number; audioPath?: string }> {
  return new Promise((resolve) => {
    const child = spawn("yt-dlp", args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let done = false;

    const timer = setTimeout(() => {
      if (!done) { done = true; child.kill("SIGKILL"); resolve({ stdout, stderr: stderr + "\n[TIMEOUT]", code: -1 }); }
    }, timeoutMs);

    child.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
    child.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
    child.on("error", (e: Error) => {
      if (!done) { done = true; clearTimeout(timer); resolve({ stdout: "", stderr: e.message, code: -1 }); }
    });
    child.on("close", (code: number | null) => {
      if (!done) { done = true; clearTimeout(timer); resolve({ stdout, stderr, code: code ?? -1 }); }
    });
  });
}

// ─── POST /api/fetch-audio — download audio and return file ────────────────────
export async function POST(request: NextRequest) {
  let body: { url?: string };
  try { body = await request.json(); }
  catch { return new Response("Invalid JSON body", { status: 400 }); }

  const { url } = body;
  if (!url || !isValidUrl(url)) {
    return new Response("Invalid or unsupported URL. Supported: YouTube, SoundCloud, TikTok, Instagram, Facebook, Twitter, Vimeo, Twitch, Spotify, Apple Music, Bandcamp", { status: 400 });
  }

  if (activeJobs >= MAX_JOBS) {
    return new Response("Server busy, please try again in a moment", { status: 429 });
  }

  let tmpDir: string | null = null;
  activeJobs++;
  console.log(`[fetch-audio] POST: ${getPlatform(url)} (active jobs: ${activeJobs})`);

  try {
    tmpDir = await mkdtemp(join(tmpdir(), "audio-"));
  } catch (err: any) {
    activeJobs--;
    console.error("[fetch-audio] mkdtemp failed:", err.message);
    return new Response("Server error: could not create temp dir", { status: 500 });
  }

  const outPath = join(tmpDir, "audio.%(ext)s");
  const finalPath = join(tmpDir, "audio.mp3");

  try {
    // Download best audio and convert to mp3
    const dlArgs = [
      "-f", "bestaudio/best",
      "--no-part",
      "-x", "--audio-format", "mp3",
      "--audio-quality", "2",
      "--output", outPath,
      ...BASE_ARGS,
      url
    ];

    console.log("[fetch-audio] downloading...");
    const result = await spawnYtDlp(dlArgs, 60000);
    console.log("[fetch-audio] exit:", result.code);

    if (result.code !== 0) {
      throw new Error(result.stderr || "Download failed");
    }

    // Check file exists
    const fs = await import("fs");
    if (!fs.existsSync(finalPath)) {
      // Try to find the downloaded file
      const files = fs.readdirSync(tmpDir);
      const audioFile = files.find(f => f.startsWith("audio."));
      if (!audioFile) {
        throw new Error("Downloaded file not found");
      }
    }

    // Read the file
    const audioBuffer = await readFile(finalPath);
    const platform = getPlatform(url);

    // Clean up temp dir
    rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    activeJobs--;

    return new Response(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": `attachment; filename="${platform}-audio.mp3"`,
        "X-Platform": platform,
      },
    });

  } catch (err: any) {
    activeJobs--;
    console.error("[fetch-audio] error:", err.message);
    if (tmpDir) rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    return new Response(`Failed to fetch audio: ${err.message}`, { status: 500 });
  }
}
