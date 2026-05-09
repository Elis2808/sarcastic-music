import { NextRequest } from "next/server";
import { spawn, execFile } from "child_process";
import { promisify } from "util";
import { Readable } from "stream";
import { mkdtemp, unlink, rmdir } from "fs/promises";
import { createReadStream } from "fs";
import { tmpdir } from "os";
import { join } from "path";

export const runtime = "nodejs";
const execFileAsync = promisify(execFile);

const YTDLP = process.env.YTDLP_PATH || "yt-dlp";
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";

const SUPPORTED_PLATFORMS = [
  { host: "youtube.com", name: "YouTube" },
  { host: "youtu.be", name: "YouTube" },
  { host: "tiktok.com", name: "TikTok" },
  { host: "instagram.com", name: "Instagram" },
  { host: "facebook.com", name: "Facebook" },
  { host: "fb.watch", name: "Facebook" },
  { host: "twitter.com", name: "Twitter" },
  { host: "x.com", name: "Twitter" },
  { host: "soundcloud.com", name: "SoundCloud" },
  { host: "vimeo.com", name: "Vimeo" },
  { host: "twitch.tv", name: "Twitch" },
];

function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    return SUPPORTED_PLATFORMS.some(p => host.includes(p.host));
  } catch {
    return false;
  }
}

function runYtDlpText(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(YTDLP, args);
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr || `yt-dlp exited with code ${code}`));
    });
  });
}

async function downloadToTemp(url: string, format: "mp3" | "mp4"): Promise<{ tempPath: string; safeTitle: string; cleanup: () => Promise<void> }> {
  const tempDir = await mkdtemp(join(tmpdir(), "yt-"));
  const info = await getVideoInfo(url);
  const safeTitle = info.title.replace(/[^\w\s-]/g, "").trim() || "download";
  const tempPath = join(tempDir, `download.${format}`);

  if (format === "mp3") {
    // Download audio and convert to mp3
    await execFileAsync(YTDLP, [
      ...FAST_FLAGS,
      "-f", "bestaudio",
      "--no-part",
      "-o", "-",
      url,
    ], { 
      maxBuffer: 50 * 1024 * 1024,
      timeout: 120000 
    }).then(({ stdout }) => {
      // Pipe to ffmpeg
      return new Promise<void>((resolve, reject) => {
        const ffmpeg = spawn(FFMPEG, [
          "-i", "pipe:0",
          "-f", "mp3",
          "-ab", "192k",
          "-vn",
          tempPath,
        ]);
        
        ffmpeg.stdin.write(stdout);
        ffmpeg.stdin.end();
        
        let errorOutput = "";
        ffmpeg.stderr.on("data", (d) => { errorOutput += d.toString(); });
        
        ffmpeg.on("close", (code) => {
          if (code === 0) resolve();
          else reject(new Error(`ffmpeg exited ${code}: ${errorOutput}`));
        });
      });
    });
  } else {
    // Download video
    await execFileAsync(YTDLP, [
      ...FAST_FLAGS,
      "-f", "best[ext=mp4]/best",
      "--no-part",
      "-o", tempPath,
      url,
    ], { timeout: 120000 });
  }

  const cleanup = async () => {
    try {
      await unlink(tempPath);
      await rmdir(tempDir);
    } catch {}
  };

  return { tempPath, safeTitle, cleanup };
}

type VideoInfo = { title: string; author: string; lengthSeconds: string; thumbnail: string };
const infoCache = new Map<string, { data: VideoInfo; ts: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

const FAST_FLAGS = [
  "--no-playlist",
  "--no-cache-dir",
  "--socket-timeout", "10",
  "--retries", "2",
];

async function getVideoInfo(url: string): Promise<VideoInfo> {
  const cached = infoCache.get(url);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.data;

  const raw = await runYtDlpText([
    ...FAST_FLAGS,
    "--print", "%(title)s\n%(uploader)s\n%(duration)s\n%(thumbnail)s",
    url,
  ]);
  const [title, author, lengthSeconds, thumbnail] = raw.split("\n");
  const data = { title, author, lengthSeconds, thumbnail };
  infoCache.set(url, { data, ts: Date.now() });
  return data;
}

// POST /api/youtube — fetch video info
export async function POST(request: NextRequest) {
  const { url } = await request.json();

  if (!url || !isValidUrl(url)) {
    return Response.json({ error: "Invalid URL. Supported: YouTube, TikTok, Instagram, Facebook, Twitter/X, SoundCloud, Vimeo, Twitch" }, { status: 400 });
  }

  try {
    const data = await getVideoInfo(url);
    return Response.json(data);
  } catch (error) {
    console.error("yt-dlp info error:", error);
    return Response.json({ error: "Could not fetch video info. Video may be unavailable or private." }, { status: 500 });
  }
}

// GET /api/youtube?url=...&format=mp3|mp4 — download to temp then stream
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  const format = (searchParams.get("format") || "mp3") as "mp3" | "mp4";

  if (!url || !isValidUrl(url)) {
    return Response.json({ error: "Invalid URL. Supported: YouTube, TikTok, Instagram, Facebook, Twitter/X, SoundCloud, Vimeo, Twitch" }, { status: 400 });
  }

  let cleanup: (() => Promise<void>) | undefined;

  try {
    console.log(`[YouTube] Starting download: ${url} (${format})`);
    const { tempPath, safeTitle, cleanup: doCleanup } = await downloadToTemp(url, format);
    cleanup = doCleanup;

    console.log(`[YouTube] Downloaded to ${tempPath}, streaming...`);

    const contentType = format === "mp3" ? "audio/mpeg" : "video/mp4";
    const fileStream = createReadStream(tempPath);

    return new Response(fileStream as unknown as ReadableStream, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${safeTitle}.${format}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[YouTube] Download error:", error);
    const message = error instanceof Error ? error.message : String(error);
    
    // Check for common errors
    if (message.includes("Command failed") || message.includes("exited")) {
      return Response.json({ 
        error: "Download failed. This video may be restricted, age-restricted, or unavailable.",
        details: message.slice(0, 200)
      }, { status: 500 });
    }
    
    return Response.json({ error: "Download failed. Please try again." }, { status: 500 });
  } finally {
    // Cleanup after a delay (allow download to start)
    if (cleanup) {
      setTimeout(() => cleanup!().catch(() => {}), 30000);
    }
  }
}
