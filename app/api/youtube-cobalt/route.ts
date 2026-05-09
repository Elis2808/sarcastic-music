import { NextRequest } from "next/server";

const COBALT_API = "https://api.cobalt.tools/api/json";

export async function POST(request: NextRequest) {
  const { url, downloadMode = "auto" } = await request.json();

  if (!url) {
    return Response.json({ error: "No URL provided" }, { status: 400 });
  }

  try {
    // Call Cobalt API (free, no auth needed for reasonable usage)
    const response = await fetch(COBALT_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        url,
        downloadMode, // auto, audio, or mute
        quality: "720",
        codec: "h264",
      }),
    });

    const data = await response.json();

    if (data.status === "error") {
      return Response.json({ error: data.text || "Download failed" }, { status: 500 });
    }

    if (data.status === "stream" && data.url) {
      // Return the direct download URL
      return Response.json({
        success: true,
        downloadUrl: data.url,
        filename: data.filename || "download",
      });
    }

    return Response.json({ error: "Unexpected response from download service" }, { status: 500 });
  } catch (error) {
    console.error("Cobalt API error:", error);
    return Response.json({ error: "Download service unavailable" }, { status: 503 });
  }
}
