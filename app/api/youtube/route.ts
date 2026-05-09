import { NextRequest } from "next/server";
import { spawn } from "child_process";
import { Readable } from "stream";

export const runtime = "nodejs";

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

function nodeStreamToWeb(nodeStream: Readable): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      nodeStream.on("data", (chunk) => controller.enqueue(new Uint8Array(chunk)));
      nodeStream.on("end", () => controller.close());
      nodeStream.on("error", (err) => controller.error(err));
    },
    cancel() {
      nodeStream.destroy();
    },
  });
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

// GET /api/youtube?url=...&format=mp3|mp4 — direct stream, no temp file
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  const format = searchParams.get("format") || "mp3";

  if (!url || !isValidUrl(url)) {
    return Response.json({ error: "Invalid URL. Supported: YouTube, TikTok, Instagram, Facebook, Twitter/X, SoundCloud, Vimeo, Twitch" }, { status: 400 });
  }

  try {
    // Use cached info if available — no extra yt-dlp call needed
    const info = await getVideoInfo(url);
    const safeTitle = info.title.replace(/[^\w\s-]/g, "").trim() || "download";

    let outputStream: Readable;

    if (format === "mp3") {
      // yt-dlp pipes raw audio → ffmpeg encodes to mp3 on the fly → streamed to browser
      const ytdlp = spawn(YTDLP, [
        ...FAST_FLAGS,
        "-f", "bestaudio",
        "--no-part",
        "-o", "-",
        url,
      ]);
      const ffmpeg = spawn(FFMPEG, [
        "-i", "pipe:0",
        "-f", "mp3",
        "-ab", "320k",
        "-vn",
        "pipe:1",
      ]);
      ytdlp.stdout.pipe(ffmpeg.stdin);
      ytdlp.stderr.on("data", () => {});
      ffmpeg.stderr.on("data", () => {});
      outputStream = ffmpeg.stdout;
    } else {
      // Stream best mp4 directly — no re-encoding needed
      const ytdlp = spawn(YTDLP, [
        ...FAST_FLAGS,
        "-f", "best[ext=mp4]/best",
        "--no-part",
        "-o", "-",
        url,
      ]);
      ytdlp.stderr.on("data", () => {});
      outputStream = ytdlp.stdout;
    }

    const contentType = format === "mp3" ? "audio/mpeg" : "video/mp4";
    return new Response(nodeStreamToWeb(outputStream), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${safeTitle}.${format}"`,
        "Transfer-Encoding": "chunked",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("yt-dlp stream error:", error);
    return Response.json({ error: "Download failed. Video may be restricted or unavailable." }, { status: 500 });
  }
}
