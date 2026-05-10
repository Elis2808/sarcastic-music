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

// ─── Spawn with timeout, returns child so caller can kill it ─────────────────
function spawnTracked(
  args: string[],
  timeoutMs: number
): { promise: Promise<{ stdout: string; stderr: string; code: number }>; kill: () => void } {
  let child: ReturnType<typeof spawn> | null = null;
  const promise = new Promise<{ stdout: string; stderr: string; code: number }>((resolve) => {
    child = spawn("yt-dlp", args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let done = false;

    const timer = setTimeout(() => {
      if (!done) { done = true; child?.kill("SIGKILL"); resolve({ stdout, stderr: stderr + "\n[TIMEOUT]", code: -1 }); }
    }, timeoutMs);

    child.stdout!.on("data", (d: Buffer) => { stdout += d.toString(); });
    child.stderr!.on("data", (d: Buffer) => { stderr += d.toString(); });
    child.on("error", (e: Error) => {
      if (!done) { done = true; clearTimeout(timer); resolve({ stdout: "", stderr: e.message, code: -1 }); }
    });
    child.on("close", (code: number | null) => {
      if (!done) { done = true; clearTimeout(timer); resolve({ stdout, stderr, code: code ?? -1 }); }
    });
  });
  return { promise, kill: () => child?.kill("SIGKILL") };
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
const CLIENTS = ["android", "ios", "mweb"];

const BASE_ARGS = ["--no-playlist", "--no-cache-dir", "--socket-timeout", "8", "--retries", "1"];

function getPoTokenArgs(): string[] {
  const po = process.env.YOUTUBE_PO_TOKEN;
  const vis = process.env.YOUTUBE_VISITOR_DATA;
  const args: string[] = [];
  if (vis) args.push("--extractor-args", `youtube:visitor_data=${vis}`);
  if (po && vis) args.push("--extractor-args", `youtube:po_token=web+${po}`);
  return args;
}

function isBotBlock(stderr: string): boolean {
  return stderr.includes("Sign in") || stderr.includes("bot") || stderr.includes("cookies are no longer valid");
}

// ─── GET: staggered parallel race — kill all losers when first winner found ───
async function runParallel(
  extraArgs: string[],
  timeoutMs = 25000
): Promise<{ stdout: string; stderr: string; code: number }> {
  const proxies = getProxies();
  const cookieFile = await getCookieFile();
  const cookieArgs = cookieFile ? ["--cookies", cookieFile] : [];
  const poArgs = getPoTokenArgs();
  const proxyList = [...proxies.map(p => ["--proxy", p] as string[]), [] as string[]];
  const attempts = proxyList.flatMap(proxyArgs =>
    CLIENTS.map(client => ({
      label: `${client}${proxyArgs.length ? "+proxy" : "+direct"}`,
      args: [...BASE_ARGS, "--extractor-args", `youtube:player_client=${client}`, ...poArgs, ...proxyArgs, ...cookieArgs, ...extraArgs],
    }))
  );

  return new Promise((resolve) => {
    let settled = false;
    let completed = 0;
    const trackers: Array<{ kill: () => void }> = [];
    const timers: ReturnType<typeof setTimeout>[] = [];

    const killAll = () => trackers.forEach(t => t.kill());

    attempts.forEach((attempt, i) => {
      // Stagger launches 80ms apart — avoids hammering OS/network at once
      const t = setTimeout(() => {
        if (settled) return;
        console.log(`[YouTube] racing ${attempt.label}...`);
        const tracked = spawnTracked(attempt.args, timeoutMs);
        trackers.push(tracked);

        tracked.promise.then((result: { stdout: string; stderr: string; code: number }) => {
          completed++;
          console.log(`[YouTube] ${attempt.label} exit: ${result.code}`);
          if (result.stderr) console.log(`[YouTube] ${attempt.label} stderr:`, result.stderr.slice(0, 150));

          if (!settled && result.code === 0) {
            settled = true;
            timers.forEach(clearTimeout);
            killAll();
            resolve(result);
          } else if (!settled && completed === attempts.length) {
            resolve({ stdout: "", stderr: "all strategies exhausted", code: 1 });
          }
        });
      }, i * 80);
      timers.push(t);
    });
  });
}

// ─── POST: sequential with bot-block fast-skip (each needs unique output file) 
async function runSequential(
  extraArgs: string[],
  outPath: string,
  timeoutMs = 120000
): Promise<{ stderr: string; code: number }> {
  const proxies = getProxies();
  const cookieFile = await getCookieFile();
  const cookieArgs = cookieFile ? ["--cookies", cookieFile] : [];

  const poArgs = getPoTokenArgs();
  const proxyList = [...proxies.map(p => ["--proxy", p] as string[]), [] as string[]];

  for (const proxyArgs of proxyList) {
    for (const client of CLIENTS) {
      const label = `${client}${proxyArgs.length ? "+proxy" : "+direct"}`;
      const args = [...BASE_ARGS, "--extractor-args", `youtube:player_client=${client}`, ...poArgs, ...proxyArgs, ...cookieArgs, ...extraArgs, "-o", outPath];

      console.log(`[YouTube] download ${label}...`);
      const result = await spawnToFileWithTimeout(args, timeoutMs);
      console.log(`[YouTube] ${label} exit: ${result.code}`);
      if (result.stderr) console.log(`[YouTube] ${label} stderr:`, result.stderr.slice(0, 300));

      if (result.code === 0) return result;
      if (isBotBlock(result.stderr)) break; // skip remaining clients, try next proxy
    }
  }

  return { stderr: "all strategies exhausted", code: 1 };
}

// ─── GET /api/youtube?url=... — fetch video info ──────────────────────────────
export async function GET(request: NextRequest) {
  const url = new URL(request.url).searchParams.get("url");
  if (!url || !isValidUrl(url)) {
    return Response.json({ error: "Invalid or unsupported URL" }, { status: 400 });
  }

  console.log("[YouTube] GET info:", url);

  const { stdout, stderr, code } = await runParallel(["--dump-single-json", url]);

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

    const { stderr, code } = await runSequential(dlArgs, outPath, 120000);

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
