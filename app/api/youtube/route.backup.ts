import { NextRequest } from "next/server";
import { spawn } from "child_process";
import { tmpdir } from "os";
import { join } from "path";
import { mkdtemp, unlink, rm } from "fs/promises";
import { createWriteStream, existsSync } from "fs";

export const runtime = "nodejs";

function spawnPromise(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => { stdout += d.toString(); });
    child.stderr.on("data", (d) => { stderr += d.toString(); });
    child.on("error", (e) => {
      console.error("[YouTube] spawn error:", e.message);
      resolve({ stdout: "", stderr: e.message, code: -1 });
    });
    child.on("close", (code) => resolve({ stdout, stderr, code: code ?? -1 }));
  });
}

function spawnToFile(cmd: string, args: string[], outPath: string): Promise<{ stderr: string; code: number }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"] });
    const fileStream = createWriteStream(outPath);
    let stderr = "";
    child.stdout.pipe(fileStream);
    child.stderr.on("data", (d) => { stderr += d.toString(); });
    child.on("error", (e) => {
      console.error("[YouTube] spawn error:", e.message);
      resolve({ stderr: e.message, code: -1 });
    });
    child.on("close", (code) => resolve({ stderr, code: code ?? -1 }));
  });
}

const SUPPORTED_HOSTS = ["youtube.com","youtu.be","tiktok.com","instagram.com","facebook.com","fb.watch","twitter.com","x.com","soundcloud.com","vimeo.com","twitch.tv"];

function isValidUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return SUPPORTED_HOSTS.some(h => host.includes(h));
  } catch { return false; }
}

function getProxies(): string[] {
  const proxies: string[] = [];
  if (process.env.PROXY_URL) proxies.push(process.env.PROXY_URL);
  for (let i = 1; i <= 5; i++) {
    const p = process.env[`PROXY_URL_${i}`];
    if (p) proxies.push(p);
  }
  return proxies;
}

function getCookieArgs(): string[] {
  const cookies = process.env.YOUTUBE_COOKIES;
  if (!cookies) return [];
  try {
    const { writeFileSync } = require("fs");
    const path = join(tmpdir(), "yt-cookies.txt");
    writeFileSync(path, Buffer.from(cookies, "base64").toString("utf-8"));
    return ["--cookies", path];
  } catch { return []; }
}

const BASE_ARGS = ["--no-playlist", "--no-cache-dir", "--socket-timeout", "15", "--retries", "1"];

async function runWithFallback(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  const proxies = getProxies();
  const cookieArgs = getCookieArgs();

  for (let i = 0; i <= proxies.length; i++) {
    const proxyArgs = i < proxies.length ? ["--proxy", proxies[i]] : [];
    const label = i < proxies.length ? `proxy${i + 1}` : "direct";
    const fullArgs = [...BASE_ARGS, ...proxyArgs, ...cookieArgs, ...args];
    console.log(`[YouTube] trying ${label}...`);
    const result = await spawnPromise("yt-dlp", fullArgs);
    console.log(`[YouTube] ${label} exit code: ${result.code}`);
    if (result.code === 0) return result;
    if (result.stderr) console.log(`[YouTube] ${label} stderr:`, result.stderr.slice(0, 300));
  }
  return { stdout: "", stderr: "all strategies failed", code: 1 };
}

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

export async function POST(request: NextRequest) {
  let body: { url?: string; format?: string };
  try { body = await request.json(); }
  catch { return new Response("Invalid JSON body", { status: 400 }); }

  const { url, format } = body;
  if (!url || !isValidUrl(url)) return new Response("Invalid URL", { status: 400 });
  if (!format || (format !== "mp3" && format !== "mp4")) return new Response("Invalid format", { status: 400 });

  console.log("[YouTube] POST download:", url, format);

  const tmpDir = await mkdtemp(join(tmpdir(), "yt-"));
  const outPath = join(tmpDir, `download.${format}`);

  try {
    const proxies = getProxies();
    const cookieArgs = getCookieArgs();

    let success = false;
    let lastErr = "";

    for (let i = 0; i <= proxies.length; i++) {
      const proxyArgs = i < proxies.length ? ["--proxy", proxies[i]] : [];
      const label = i < proxies.length ? `proxy${i + 1}` : "direct";
      const dlArgs = [
        ...BASE_ARGS, ...proxyArgs, ...cookieArgs,
        "-f", format === "mp3" ? "bestaudio/best" : "best[ext=mp4]/best",
        "--no-part", "-o", outPath,
        url,
      ];

      console.log(`[YouTube] download with ${label}...`);
      const { stderr, code } = await spawnToFile("yt-dlp", dlArgs, outPath);
      console.log(`[YouTube] ${label} code: ${code}`);
      if (stderr) console.log(`[YouTube] ${label} stderr:`, stderr.slice(0, 300));

      if (code === 0 && existsSync(outPath)) {
        success = true;
        break;
      }
      lastErr = stderr;
    }

    if (!success) {
      return new Response(`Download failed: ${lastErr.slice(0, 300)}`, { status: 500 });
    }

    const { readFile } = await import("fs/promises");
    const fileBuffer = await readFile(outPath);

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
    unlink(outPath).catch(() => {});
    rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
