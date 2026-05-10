import { NextRequest } from "next/server";
import { spawn } from "child_process";
import { tmpdir } from "os";
import { join } from "path";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { existsSync, readdirSync } from "fs";

export const runtime = "nodejs";

// ─── Concurrency limiter (max 2 simultaneous yt-dlp jobs) ───────────────────
let activeJobs = 0;
const MAX_JOBS = 2;

// ─── Supported hosts ─────────────────────────────────────────────────────────
const SUPPORTED_HOSTS = ["youtube.com","youtu.be","tiktok.com","instagram.com","facebook.com","fb.watch","twitter.com","x.com","soundcloud.com","vimeo.com","twitch.tv"];

function isValidUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return SUPPORTED_HOSTS.some(h => host.includes(h));
  } catch { return false; }
}

// ─── Proxies: load all 5 slots, shuffle for rotation ─────────────────────────
function getProxies(): string[] {
  const raw = [
    process.env.PROXY_URL,
    process.env.PROXY_URL2,
    process.env.PROXY_URL3,
    process.env.PROXY_URL4,
    process.env.PROXY_URL5,
  ].filter(Boolean) as string[];
  // Fisher-Yates shuffle so we don't hammer the same proxy every time
  for (let i = raw.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [raw[i], raw[j]] = [raw[j], raw[i]];
  }
  return raw;
}

// ─── Cookies: optional fallback only ─────────────────────────────────────────
async function getCookieFile(): Promise<string | null> {
  const b64 = process.env.YOUTUBE_COOKIES;
  if (!b64) return null;
  try {
    const path = join(tmpdir(), "yt-cookies.txt");
    await writeFile(path, Buffer.from(b64, "base64").toString("utf-8"));
    return path;
  } catch { return null; }
}

// ─── Spawn with timeout ───────────────────────────────────────────────────────
function spawnWithTimeout(
  args: string[],
  timeoutMs: number
): Promise<{ stdout: string; stderr: string; code: number }> {
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

// ─── Spawn to file with timeout ───────────────────────────────────────────────
function spawnToFileWithTimeout(
  args: string[],
  timeoutMs: number
): Promise<{ stderr: string; code: number }> {
  return new Promise((resolve) => {
    const child = spawn("yt-dlp", args, { stdio: ["pipe", "pipe", "pipe"] });
    let stderr = "";
    let done = false;

    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        child.kill("SIGKILL");
        resolve({ stderr: stderr + "\n[TIMEOUT]", code: -1 });
      }
    }, timeoutMs);

    child.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
    child.on("error", (e: Error) => {
      if (!done) { done = true; clearTimeout(timer); resolve({ stderr: e.message, code: -1 }); }
    });
    child.on("close", (code: number | null) => {
      if (!done) { done = true; clearTimeout(timer); resolve({ stderr, code: code ?? -1 }); }
    });
  });
}

// ─── Player clients to try per proxy ─────────────────────────────────────────
const CLIENTS = ["android", "ios", "tv_embedded", "mweb"];

const BASE_ARGS = ["--no-playlist", "--no-cache-dir", "--socket-timeout", "15", "--retries", "1"];

function isBotBlock(stderr: string): boolean {
  return stderr.includes("Sign in") || stderr.includes("bot") || stderr.includes("cookies are no longer valid");
}

// ─── Core: try every proxy × every client, rotate randomly ───────────────────
async function runWithFallback(
  extraArgs: string[],
  outPath?: string,
  timeoutMs = 45000
): Promise<{ stdout: string; stderr: string; code: number }> {
  const proxies = getProxies();
  const cookieFile = await getCookieFile();
  const cookieArgs = cookieFile ? ["--cookies", cookieFile] : [];

  // Always try direct (no proxy) as last resort
  const proxyList = [...proxies.map(p => ["--proxy", p] as string[]), [] as string[]];

  for (const proxyArgs of proxyList) {
    for (const client of CLIENTS) {
      const label = `${client}${proxyArgs.length ? "+proxy" : "+direct"}`;
      const clientArgs = ["--extractor-args", `youtube:player_client=${client}`];
      const fullArgs = [...BASE_ARGS, ...clientArgs, ...proxyArgs, ...cookieArgs, ...extraArgs];

      console.log(`[YouTube] trying ${label}...`);
      let result: { stdout: string; stderr: string; code: number };

      if (outPath) {
        const r = await spawnToFileWithTimeout([...fullArgs, "-o", outPath], timeoutMs);
        result = { stdout: "", stderr: r.stderr, code: r.code };
      } else {
        result = await spawnWithTimeout(fullArgs, timeoutMs);
      }

      console.log(`[YouTube] ${label} exit: ${result.code}`);
      if (result.stderr) console.log(`[YouTube] ${label} stderr:`, result.stderr.slice(0, 400));

      if (result.code === 0) return result;

      // Bot block → abandon this proxy, try next proxy immediately
      if (isBotBlock(result.stderr)) {
        console.log(`[YouTube] bot block on ${label}, switching proxy...`);
        break;
      }
    }
  }

  return { stdout: "", stderr: "all strategies exhausted", code: 1 };
}

// ─── GET /api/youtube?url=... — fetch video info ──────────────────────────────
export async function GET(request: NextRequest) {
  const url = new URL(request.url).searchParams.get("url");
  if (!url || !isValidUrl(url)) {
    return Response.json({ error: "Invalid or unsupported URL" }, { status: 400 });
  }

  console.log("[YouTube] GET info:", url);

  const { stdout, stderr, code } = await runWithFallback(["--dump-single-json", url]);

  if (code !== 0) {
    return Response.json({ error: `yt-dlp failed: ${stderr.slice(0, 300)}` }, { status: 500 });
  }

  try {
    const data = JSON.parse(stdout);
    return Response.json({
      title: data.title || "Unknown",
      author: data.uploader || data.channel || "Unknown",
      lengthSeconds: String(data.duration || 0),
      thumbnail: data.thumbnail || "",
    });
  } catch {
    return Response.json({ error: "Failed to parse yt-dlp output" }, { status: 500 });
  }
}

// ─── POST /api/youtube — download as mp3/mp4 ─────────────────────────────────
export async function POST(request: NextRequest) {
  let body: { url?: string; format?: string };
  try { body = await request.json(); }
  catch { return new Response("Invalid JSON body", { status: 400 }); }

  const { url, format } = body;
  if (!url || !isValidUrl(url)) return new Response("Invalid URL", { status: 400 });
  if (!format || (format !== "mp3" && format !== "mp4")) return new Response("Invalid format", { status: 400 });

  if (activeJobs >= MAX_JOBS) {
    return new Response("Server busy, please try again in a moment", { status: 429 });
  }

  activeJobs++;
  console.log(`[YouTube] POST download: ${url} [${format}] (active jobs: ${activeJobs})`);

  const tmpDir = await mkdtemp(join(tmpdir(), "yt-"));
  const outPath = join(tmpDir, `download.%(ext)s`);
  const finalPath = join(tmpDir, `download.${format}`);

  try {
    const formatArg = format === "mp3" ? "bestaudio/best" : "best[ext=mp4]/best";
    const dlArgs = [
      "-f", formatArg,
      "--no-part",
      ...(format === "mp3" ? ["--extract-audio", "--audio-format", "mp3"] : []),
      url,
    ];

    const { stderr, code } = await runWithFallback(dlArgs, outPath, 120000);

    // Find the output file (yt-dlp may change the extension)
    let resolvedPath = finalPath;
    if (!existsSync(resolvedPath)) {
      const found = readdirSync(tmpDir).find(f => f.startsWith("download."));
      if (found) resolvedPath = join(tmpDir, found);
    }

    if (code !== 0 || !existsSync(resolvedPath)) {
      return new Response(`Download failed: ${stderr.slice(0, 300)}`, { status: 500 });
    }

    const fileBuffer = await readFile(resolvedPath);

    return new Response(fileBuffer, {
      headers: {
        "Content-Type": format === "mp3" ? "audio/mpeg" : "video/mp4",
        "Content-Disposition": `attachment; filename="download.${format}"`,
      },
    });
  } catch (err: any) {
    console.error("[YouTube] error:", err.message);
    return new Response(err.message || "Download failed", { status: 500 });
  } finally {
    activeJobs--;
    rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
