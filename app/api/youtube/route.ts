import { NextRequest } from "next/server";
import { spawn, execFile } from "child_process";
import { promisify } from "util";
import { mkdtemp, unlink, rmdir } from "fs/promises";
import { createReadStream, existsSync, unlinkSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

export const runtime = "nodejs";
const execFileAsync = promisify(execFile);

const YTDLP = "/usr/local/bin/yt-dlp";
const FFMPEG = "/usr/bin/ffmpeg";
const YOUTUBE_COOKIES = process.env.YOUTUBE_COOKIES || "";

function getCookieFlags(): string[] {
  if (!YOUTUBE_COOKIES) return [];
  try {
    const cookiePath = join(tmpdir(), `yt-cookies-${Date.now()}.txt`);
    const decoded = Buffer.from(YOUTUBE_COOKIES, "base64").toString("utf-8");
    writeFileSync(cookiePath, decoded);
    return ["--cookies", cookiePath];
  } catch {
    return [];
  }
}

function getProxyList(): string[] {
  const proxies = [];
  if (process.env.PROXY_URL) proxies.push(process.env.PROXY_URL);
  for (let i = 1; i <= 5; i++) {
    const proxy = process.env[`PROXY_URL_${i}`];
    if (proxy) proxies.push(proxy);
  }
  return proxies;
}

const PROXY_LIST = getProxyList();

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

function getPlatform(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const platform = SUPPORTED_PLATFORMS.find(p => host.includes(p.host));
    return platform?.name || "Unknown";
  } catch {
    return "Unknown";
  }
}

const BASE_FLAGS = ["--no-playlist", "--no-cache-dir", "--socket-timeout", "5", "--retries", "0", "--js-runtimes", "deno"];
const FAST_FLAGS = ["--no-playlist", "--no-cache-dir", "--socket-timeout", "3", "--retries", "0"];
const FACEBOOK_FLAGS = ["--no-playlist", "--socket-timeout", "5", "--retries", "0", "--extractor-args", "facebook:video_format=direct"];

const USER_AGENTS = [
  "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36",
];

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function runYtDlpText(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(YTDLP, args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => { stdout += d.toString(); });
    proc.stderr.on("data", (d) => { stderr += d.toString(); });
    proc.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr || `yt-dlp exited with code ${code}`));
    });
    proc.on("error", (err) => reject(err));
  });
}

async function getVideoInfoWithFallback(url: string): Promise<{ title: string; author: string; lengthSeconds: string; thumbnail: string }> {
  const platform = getPlatform(url);
  const isYouTube = platform === "YouTube";
  const isFacebook = platform === "Facebook";
  const baseFlags = isYouTube ? BASE_FLAGS : isFacebook ? FACEBOOK_FLAGS : FAST_FLAGS;
  
  const strategies: { name: string; flags: string[] }[] = [];
  
  if (PROXY_LIST.length > 0 && isYouTube) {
    for (let i = 0; i < PROXY_LIST.length; i++) {
      const proxy = PROXY_LIST[i];
      const userAgent = getRandomUserAgent();
      const cookieFlags = getCookieFlags();
      strategies.push(
        { name: `proxy${i + 1}+android`, flags: [...baseFlags, "--proxy", proxy, ...cookieFlags, "--extractor-args", "youtube:player_client=android", "--user-agent", userAgent] },
        { name: `proxy${i + 1}+web`, flags: [...baseFlags, "--proxy", proxy, ...cookieFlags, "--extractor-args", "youtube:player_client=web_embedded", "--user-agent", userAgent] },
      );
    }
  }
  
  if (isYouTube) {
    const userAgent = getRandomUserAgent();
    const cookieFlags = getCookieFlags();
    strategies.push(
      { name: "no-proxy+android", flags: [...baseFlags, ...cookieFlags, "--extractor-args", "youtube:player_client=android", "--user-agent", userAgent] },
      { name: "no-proxy+web", flags: [...baseFlags, ...cookieFlags, "--extractor-args", "youtube:player_client=web_embedded", "--user-agent", userAgent] },
    );
  } else {
    strategies.push({ name: "no-proxy+standard", flags: [...baseFlags] });
  }

  const attempts = strategies.map(async (strategy) => {
    try {
      const args = [...strategy.flags, "--dump-single-json", url];
      const raw = await runYtDlpText(args);
      const data = JSON.parse(raw);
      return {
        title: data.title || "Unknown",
        author: data.uploader || data.channel || "Unknown",
        lengthSeconds: String(data.duration || 0),
        thumbnail: data.thumbnail || (data.thumbnails?.[0]?.url) || "",
      };
    } catch (err) {
      throw err;
    }
  });

  try {
    return await Promise.race(attempts);
  } catch {
    throw new Error("All info strategies failed. YouTube may be blocking this server.");
  }
}

async function downloadWithFallback(url: string, format: "mp3" | "mp4", tempPath: string): Promise<void> {
  const platform = getPlatform(url);
  const isYouTube = platform === "YouTube";
  const isFacebook = platform === "Facebook";
  const baseFlags = isYouTube ? BASE_FLAGS : isFacebook ? FACEBOOK_FLAGS : FAST_FLAGS;
  
  const strategies: { name: string; flags: string[] }[] = [];
  
  if (PROXY_LIST.length > 0 && isYouTube) {
    for (let i = 0; i < PROXY_LIST.length; i++) {
      const proxy = PROXY_LIST[i];
      const userAgent = getRandomUserAgent();
      const cookieFlags = getCookieFlags();
      strategies.push(
        { name: `proxy${i + 1}+android`, flags: [...baseFlags, "--proxy", proxy, ...cookieFlags, "--extractor-args", "youtube:player_client=android", "--user-agent", userAgent] },
        { name: `proxy${i + 1}+web`, flags: [...baseFlags, "--proxy", proxy, ...cookieFlags, "--extractor-args", "youtube:player_client=web_embedded", "--user-agent", userAgent] },
      );
    }
  }
  
  if (isYouTube) {
    const userAgent = getRandomUserAgent();
    const cookieFlags = getCookieFlags();
    strategies.push(
      { name: "no-proxy+android", flags: [...baseFlags, ...cookieFlags, "--extractor-args", "youtube:player_client=android", "--user-agent", userAgent] },
      { name: "no-proxy+web", flags: [...baseFlags, ...cookieFlags, "--extractor-args", "youtube:player_client=web_embedded", "--user-agent", userAgent] },
    );
  } else {
    strategies.push({ name: "no-proxy+standard", flags: [...baseFlags] });
  }

  let lastError = "";
  
  for (let i = 0; i < strategies.length; i++) {
    const strategy = strategies[i];
    
    if (i > 0) {
      const delay = Math.min(1000 + i * 500, 3000);
      await sleep(delay);
    }
    
    try {
      if (format === "mp3") {
        const videoTempPath = `${tempPath}.video`;
        try {
          await execFileAsync(YTDLP, [...strategy.flags, "-f", "best[ext=mp4]/best", "--no-part", "-o", videoTempPath, url], { encoding: "utf-8", timeout: 30000 });
        } catch (err: any) {
          const errStr = err.stderr || err.message || "";
          if (errStr.includes("Sign in to confirm") || errStr.includes("bot")) lastError = errStr;
          throw err;
        }
        
        await new Promise<void>((resolve, reject) => {
          const ffmpeg = spawn(FFMPEG, ["-i", videoTempPath, "-f", "mp3", "-ab", "192k", "-vn", "-y", tempPath]);
          let ffmpegError = "";
          ffmpeg.stderr.on("data", (d) => { ffmpegError += d.toString(); });
          ffmpeg.on("close", (code) => {
            try { unlinkSync(videoTempPath); } catch {}
            if (code === 0) resolve();
            else reject(new Error(`ffmpeg failed: ${ffmpegError}`));
          });
        });
        return;
      } else {
        try {
          await execFileAsync(YTDLP, [...strategy.flags, "-f", "best[ext=mp4]/best", "--no-part", "-o", tempPath, url], { encoding: "utf-8", timeout: 30000 });
        } catch (err: any) {
          const errStr = err.stderr || err.message || "";
          if (errStr.includes("Sign in to confirm") || errStr.includes("bot")) lastError = errStr;
          throw err;
        }
        return;
      }
    } catch (err: any) {
      // Continue to next strategy
    }
  }

  throw new Error(`All download strategies failed. ${lastError?.slice(0, 100) || ""}`);
}

const infoCache = new Map<string, { title: string; author: string; lengthSeconds: string; thumbnail: string; ts: number }>();
const INFO_CACHE_TTL = 5 * 60 * 1000;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  
  if (!url || !isValidUrl(url)) {
    return new Response("Invalid or unsupported URL", { status: 400 });
  }

  const cached = infoCache.get(url);
  if (cached && Date.now() - cached.ts < INFO_CACHE_TTL) {
    return Response.json(cached);
  }

  try {
    const info = await getVideoInfoWithFallback(url);
    infoCache.set(url, { ...info, ts: Date.now() });
    return Response.json(info);
  } catch (err: any) {
    return new Response(err.message || "Failed to fetch video info", { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let tempDir: string | null = null;
  
  try {
    const body = await request.json();
    const { url, format } = body;

    if (!url || !isValidUrl(url)) {
      return new Response("Invalid or unsupported URL", { status: 400 });
    }
    if (!format || (format !== "mp3" && format !== "mp4")) {
      return new Response("Invalid format", { status: 400 });
    }

    tempDir = await mkdtemp(join(tmpdir(), "yt-"));
    const tempPath = join(tempDir, `download.${format}`);

    await downloadWithFallback(url, format, tempPath);

    if (!existsSync(tempPath)) {
      throw new Error("Download failed - file not created");
    }

    const fileStream = createReadStream(tempPath);
    const platform = getPlatform(url);
    
    fileStream.on("close", () => {
      try {
        unlinkSync(tempPath);
        if (tempDir) rmdir(tempDir).catch(() => {});
      } catch {}
    });

    return new Response(fileStream as any, {
      headers: {
        "Content-Type": format === "mp3" ? "audio/mpeg" : "video/mp4",
        "Content-Disposition": `attachment; filename="${platform.toLowerCase()}-download.${format}"`,
      },
    });
  } catch (err: any) {
    if (tempDir) {
      try {
        rmdir(tempDir, { recursive: true }).catch(() => {});
      } catch {}
    }
    return new Response(err.message || "Download failed", { status: 500 });
  }
}
