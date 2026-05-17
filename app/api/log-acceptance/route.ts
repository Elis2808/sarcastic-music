import { NextRequest } from "next/server";
import { createHash } from "crypto";
import { appendFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { tool } = await req.json().catch(() => ({ tool: "downloader" }));

    // Hash IP so no personal data is stored
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("x-real-ip")
      || "unknown";
    const sessionHash = createHash("sha256").update(ip + Date.now().toString().slice(0, -4)).digest("hex").slice(0, 12);

    const entry = JSON.stringify({
      sessionHash,
      timestamp: new Date().toISOString(),
      tool: tool || "downloader",
      accepted: true,
    }) + "\n";

    // Store in /tmp so it works on serverless — or use a persistent log dir if self-hosted
    const logDir = join(process.cwd(), "logs");
    if (!existsSync(logDir)) await mkdir(logDir, { recursive: true });
    await appendFile(join(logDir, "acceptance.log"), entry);

    return Response.json({ ok: true });
  } catch {
    // Non-critical — don't block the user
    return Response.json({ ok: true });
  }
}
