import { NextRequest } from "next/server";
import { spawn } from "child_process";
import { tmpdir } from "os";
import { join } from "path";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { existsSync, readdirSync } from "fs";

export const runtime = "nodejs";

// ─── Concurrency limiter ──────────────────────────────────────────────────────
let activeJobs = 0;
const MAX_JOBS = 2;

// ─── Proxy scorer: best-performing proxy tried first, bot-blocked ones skipped
const proxyScores = new Map<string, number>();
const botBlockedUntil = new Map<string, number>();
const BOT_BLOCK_TTL = 5 * 60 * 1000;

function isBlocked(key: string): boolean {
  const until = botBlockedUntil.get(key);
  if (!until) return false;
  if (Date.now() > until) { botBlockedUntil.delete(key); return false; }
  return true;
}
function markBlocked(key: string) {
  botBlockedUntil.set(key, Date.now() + BOT_BLOCK_TTL);
  proxyScores.set(key, (proxyScores.get(key) ?? 0) - 2);
}
function markSuccess(key: string) {
  proxyScores.set(key, (proxyScores.get(key) ?? 0) + 1);
}

// ─── Supported hosts ──────────────────────────────────────────────────────────
const SUPPORTED_HOSTS = ["youtube.com","youtu.be","tiktok.com","instagram.com","facebook.com","fb.watch","twitter.com","x.com","soundcloud.com","vimeo.com","twitch.tv"];

function isValidUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return SUPPORTED_HOSTS.some(h => host.includes(h));
  } catch { return false; }
}

function isYouTube(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host === "youtube.com" || host === "youtu.be";
  } catch { return false; }
}

function isVimeo(url: string): boolean {
  try { return new URL(url).hostname.replace(/^www\./, "") === "vimeo.com"; }
  catch { return false; }
}

// ─── Proxies: sorted by score, best first ────────────────────────────────────
function getProxyList(): string[][] {
  const proxies = [
    process.env.PROXY_URL,
    process.env.PROXY_URL2,
    process.env.PROXY_URL3,
    process.env.PROXY_URL4,
    process.env.PROXY_URL5,
  ].filter(Boolean) as string[];

  return [...proxies.map(p => ["--proxy", p]), []]  // [] = direct (no proxy)
    .filter(pa => !isBlocked(pa[1] ?? "direct"))
    .sort((a, b) => (proxyScores.get(b[1] ?? "direct") ?? 0) - (proxyScores.get(a[1] ?? "direct") ?? 0));
}

// ─── Cookie file: written once, cached in memory ──────────────────────────────
let cookieFilePath: string | null | undefined = undefined;
async function getCookieArgs(): Promise<string[]> {
  if (cookieFilePath === undefined) {
    const b64 = process.env.YOUTUBE_COOKIES;
    if (!b64) { cookieFilePath = null; }
    else {
      try {
        cookieFilePath = join(tmpdir(), "yt-cookies.txt");
        await writeFile(cookieFilePath, Buffer.from(b64, "base64").toString("utf-8"));
      } catch { cookieFilePath = null; }
    }
  }
  return cookieFilePath ? ["--cookies", cookieFilePath] : [];
}

// ─── Player clients with matching User-Agents ─────────────────────────────────
const CLIENTS = [
  { name: "android", ua: "com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip" },
  { name: "ios",     ua: "com.google.ios.youtube/19.09.3 (iPhone16,2; U; CPU iOS 17_4 like Mac OS X)" },
  { name: "mweb",    ua: "Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36" },
];

const BASE_ARGS = ["--no-playlist", "--no-cache-dir", "--socket-timeout", "8", "--retries", "0"];

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

// ─── Unified spawn with timeout ───────────────────────────────────────────────
function spawnYtDlp(
  args: string[],
  timeoutMs: number
): Promise<{ stdout: string; stderr: string; code: number }> {
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

// ─── Core: try proxies in score order, skip bot-blocked, move on fast ─────────
async function runYtDlp(
  extraArgs: string[],
  timeoutMs: number,
  url: string
): Promise<{ stdout: string; stderr: string; code: number }> {
  const proxyList = getProxyList();
  const cookieArgs = await getCookieArgs();
  const ytUrl = isYouTube(url);

  // Non-YouTube: single pass, no client rotation needed
  if (!ytUrl) {
    const impersonateArgs = isVimeo(url) ? ["--impersonate", "chrome"] : [];
    for (const proxyArgs of proxyList) {
      const proxyKey = proxyArgs[1] ?? "direct";
      const args = [...BASE_ARGS, ...impersonateArgs, ...proxyArgs, ...extraArgs];
      console.log(`[yt-dlp] trying ${proxyKey}...`);
      const result = await spawnYtDlp(args, timeoutMs);
      console.log(`[yt-dlp] ${proxyKey} exit: ${result.code}`);
      if (result.stderr) console.log(`[yt-dlp] ${proxyKey} stderr:`, result.stderr.slice(0, 200));
      if (result.code === 0) { markSuccess(proxyKey); return result; }
    }
    return { stdout: "", stderr: "all strategies exhausted", code: 1 };
  }

  // YouTube: rotate clients + UA + PO token
  const poArgs = getPoTokenArgs();
  for (const proxyArgs of proxyList) {
    const proxyKey = proxyArgs[1] ?? "direct";
    for (const { name, ua } of CLIENTS) {
      const label = `${name}+${proxyKey}`;
      const args = [...BASE_ARGS, "--extractor-args", `youtube:player_client=${name}`, "--user-agent", ua, ...poArgs, ...proxyArgs, ...cookieArgs, ...extraArgs];

      console.log(`[YouTube] trying ${label}...`);
      const result = await spawnYtDlp(args, timeoutMs);
      console.log(`[YouTube] ${label} exit: ${result.code}`);
      if (result.stderr) console.log(`[YouTube] ${label} stderr:`, result.stderr.slice(0, 200));

      if (result.code === 0) { markSuccess(proxyKey); return result; }
      if (isBotBlock(result.stderr)) { markBlocked(proxyKey); break; }
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

  const { stdout, stderr, code } = await runYtDlp(["--dump-single-json", url], 20000, url);

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

    const { stderr, code } = await runYtDlp([...dlArgs, "-o", outPath], 120000, url);

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
