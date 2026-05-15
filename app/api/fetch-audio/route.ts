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
  "reddit.com", "redd.it", "soundcloud.com", "bandcamp.com",
  "mixcloud.com", "dailymotion.com", "imgur.com", "vimeo.com", "twitch.tv"
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
    if (host === "reddit.com" || host === "redd.it") return "reddit";
    if (host.includes("bandcamp")) return "bandcamp";
    if (host.includes("mixcloud")) return "mixcloud";
    if (host.includes("dailymotion")) return "dailymotion";
    if (host.includes("imgur")) return "imgur";
    return "unknown";
  } catch { return "unknown"; }
}

const BASE_ARGS = ["--no-playlist", "--no-cache-dir", "--socket-timeout", "8", "--retries", "2"];

// ─── Proxy configuration (same as /api/youtube) ────────────────────────────────
const PROXIES = [
  { host: "185.236.92.225", port: 5278, user: "xqruyjao", pass: "4yel99ysr22z", client: "android" },
  { host: "185.236.92.62", port: 5997, user: "xqruyjao", pass: "4yel99ysr22z", client: "android" },
  { host: "91.124.50.19", port: 5732, user: "xqruyjao", pass: "4yel99ysr22z", client: "ios" },
  { host: "91.124.50.92", port: 6114, user: "xqruyjao", pass: "4yel99ysr22z", client: "web" },
  { host: "185.236.93.217", port: 6967, user: "xqruyjao", pass: "4yel99ysr22z", client: "android" },
  { host: "185.236.93.234", port: 5125, user: "xqruyjao", pass: "4yel99ysr22z", client: "web" },
  { host: "185.236.93.105", port: 5759, user: "xqruyjao", pass: "4yel99ysr22z", client: "ios" },
];

const proxyScores = new Map<string, number>();
PROXIES.forEach(p => proxyScores.set(`${p.host}:${p.port}`, 0));

function markBlocked(proxy: typeof PROXIES[0]) {
  const key = `${proxy.host}:${proxy.port}`;
  const current = proxyScores.get(key) ?? 0;
  proxyScores.set(key, current - 1);
}

function getProxyList() {
  return [...PROXIES].sort((a, b) => {
    const scoreA = proxyScores.get(`${a.host}:${a.port}`) ?? 0;
    const scoreB = proxyScores.get(`${b.host}:${b.port}`) ?? 0;
    return scoreB - scoreA;
  });
}

async function runYtDlp(args: string[], timeoutMs: number): Promise<{ stdout: string; stderr: string; code: number }> {
  const isYouTube = args.some(a => /youtube|youtu\.be/.test(a.toLowerCase()));
  
  if (!isYouTube) {
    // Non-YouTube: try direct first
    const direct = await tryOnce(args, timeoutMs);
    if (direct.code === 0) return direct;
    // Then try with proxies
  }
  
  // Try with proxies (rotating clients)
  const proxyList = getProxyList();
  let lastError = "All proxies failed";
  
  for (const proxy of proxyList) {
    const proxyUrl = `http://${proxy.user}:${proxy.pass}@${proxy.host}:${proxy.port}`;
    const clientArgs = [
      ...args,
      "--extractor-args", `youtube:player_client=${proxy.client}`,
      "--proxy", proxyUrl,
    ];
    
    console.log(`[fetch-audio] trying ${proxy.client}+${proxyUrl}...`);
    const result = await tryOnce(clientArgs, timeoutMs);
    
    if (result.code === 0) {
      console.log(`[fetch-audio] ${proxy.client}+${proxyUrl} exit: 0`);
      return result;
    }
    
    console.log(`[fetch-audio] ${proxy.client}+${proxyUrl} exit: ${result.code}`);
    if (result.stderr?.includes("429") || result.stderr?.includes("bot") || result.stderr?.includes("sign in")) {
      markBlocked(proxy);
    }
    lastError = result.stderr || `Exit code ${result.code}`;
  }
  
  return { stdout: "", stderr: lastError, code: 1 };
}

async function tryOnce(args: string[], timeoutMs: number): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const child = spawn("yt-dlp", args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let done = false;

    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        child.kill("SIGKILL");
        resolve({ stdout, stderr: stderr + "\n[TIMEOUT]", code: -1 });
      }
    }, timeoutMs);

    child.stdout?.on("data", (d: Buffer) => { stdout += d.toString(); });
    child.stderr?.on("data", (d: Buffer) => { stderr += d.toString(); });
    child.on("error", (e: Error) => {
      if (!done) {
        done = true;
        clearTimeout(timer);
        resolve({ stdout: "", stderr: e.message, code: -1 });
      }
    });
    child.on("close", (code: number | null) => {
      if (!done) {
        done = true;
        clearTimeout(timer);
        resolve({ stdout, stderr, code: code ?? -1 });
      }
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
    return new Response("Invalid or unsupported URL. Supported: YouTube, SoundCloud, TikTok, Instagram, Facebook, Twitter, Vimeo, Twitch, Bandcamp", { status: 400 });
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
    // Download best audio and convert to mp3 with proxy support
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
    const result = await runYtDlp(dlArgs, 90000); // 90s timeout for proxy retries
    console.log("[fetch-audio] exit:", result.code);

    if (result.code !== 0) {
      throw new Error(result.stderr || "Download failed");
    }

    // Check file exists
    const fs = await import("fs");
    if (!fs.existsSync(finalPath)) {
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
