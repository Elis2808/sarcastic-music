import { NextRequest } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";

export const runtime = "nodejs";

const execFileAsync = promisify(execFile);

const YTDLP = "/opt/homebrew/bin/yt-dlp";
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  // Protect the endpoint with a secret token
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { stdout: before } = await execFileAsync(YTDLP, ["--version"]);
    const { stdout: updateOut } = await execFileAsync(YTDLP, ["-U", "--no-color"]);
    const { stdout: after } = await execFileAsync(YTDLP, ["--version"]);

    return Response.json({
      success: true,
      versionBefore: before.trim(),
      versionAfter: after.trim(),
      updated: before.trim() !== after.trim(),
      log: updateOut.trim(),
    });
  } catch (error) {
    console.error("yt-dlp update failed:", error);
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}
