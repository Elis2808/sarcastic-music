import { NextRequest } from "next/server";
import { spawn } from "child_process";

export const runtime = "nodejs";

function spawnTest(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string; code: number; spawnError?: string }> {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let child: any;
    try {
      child = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"] });
    } catch (e: any) {
      return resolve({ stdout: "", stderr: "", code: -1, spawnError: e.message });
    }
    child.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
    child.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
    child.on("error", (e: Error) => resolve({ stdout, stderr, code: -1, spawnError: e.message }));
    child.on("close", (code: number) => resolve({ stdout, stderr, code: code ?? -1 }));
  });
}

export async function GET(request: NextRequest) {
  const diag: Record<string, any> = {
    timestamp: new Date().toISOString(),
    PATH: process.env.PATH,
    cwd: process.cwd(),
  };

  diag.ytdlp_version = await spawnTest("yt-dlp", ["--version"]);
  diag.which_ytdlp = await spawnTest("which", ["yt-dlp"]);
  diag.ls_usr_local_bin = await spawnTest("ls", ["/usr/local/bin"]);
  diag.ffmpeg_version = await spawnTest("ffmpeg", ["-version"]);
  diag.which_ffmpeg = await spawnTest("which", ["ffmpeg"]);
  diag.python_version = await spawnTest("python3", ["--version"]);

  return Response.json(diag, { status: 200 });
}

export async function POST(request: NextRequest) {
  let body: any = {};
  try { body = await request.json(); } catch {}

  const url = body.url || "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
  const diag: Record<string, any> = {
    timestamp: new Date().toISOString(),
    PATH: process.env.PATH,
    url,
  };

  diag.ytdlp_version = await spawnTest("yt-dlp", ["--version"]);

  if (diag.ytdlp_version.code === 0) {
    diag.ytdlp_info = await spawnTest("yt-dlp", [
      "--dump-single-json",
      "--no-playlist",
      "--no-cache-dir",
      "--socket-timeout", "15",
      "--retries", "0",
      url,
    ]);
  }

  return Response.json(diag, { status: 200 });
}
