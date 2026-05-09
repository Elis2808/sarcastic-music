import { NextRequest } from "next/server";

// Try multiple YouTube download APIs as fallbacks
const API_ENDPOINTS = [
  "https://api.cobalt.tools/api/download", // v8 API
  "https://co.wuk.sh/api/json", // Alternative Cobalt instance
];

export async function POST(request: NextRequest) {
  const { url, downloadMode = "auto" } = await request.json();

  if (!url) {
    return Response.json({ error: "No URL provided" }, { status: 400 });
  }

  // Try each API endpoint
  for (const apiUrl of API_ENDPOINTS) {
    try {
      console.log(`[YouTube] Trying API: ${apiUrl}`);
      
      const response = await fetch(apiUrl, {
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

      if (!response.ok) {
        console.log(`[YouTube] API ${apiUrl} returned ${response.status}`);
        continue;
      }

      const data = await response.json();

      if (data.status === "error") {
        console.log(`[YouTube] API ${apiUrl} error: ${data.text}`);
        continue;
      }

      if (data.status === "stream" && data.url) {
        console.log(`[YouTube] Success with ${apiUrl}`);
        return Response.json({
          success: true,
          downloadUrl: data.url,
          filename: data.filename || "download",
        });
      }

      if (data.url) {
        console.log(`[YouTube] Success with ${apiUrl}`);
        return Response.json({
          success: true,
          downloadUrl: data.url,
          filename: data.filename || "download",
        });
      }
    } catch (error) {
      console.error(`[YouTube] API ${apiUrl} failed:`, error);
      continue;
    }
  }

  // All APIs failed
  return Response.json({ 
    error: "All download services unavailable. YouTube may be blocking automated downloads. Try using y2mate.is or similar service directly." 
  }, { status: 503 });
}
