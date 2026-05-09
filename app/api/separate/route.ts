import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file");
  const stem = formData.get("stem") ?? "no_vocals";

  if (!file || !(file instanceof Blob)) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }

  try {
    const pythonForm = new FormData();
    pythonForm.append("file", file);
    pythonForm.append("stem", stem as string);

    const res = await fetch(`${process.env.PYTHON_API_URL || "http://127.0.0.1:5001"}/separate`, {
      method: "POST",
      body: pythonForm,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Processing failed" }));
      return Response.json(data, { status: res.status });
    }

    const audioBuffer = await res.arrayBuffer();
    const disposition = res.headers.get("content-disposition") ?? "";
    return new Response(audioBuffer, {
      headers: {
        "Content-Type": "audio/wav",
        "Content-Disposition": disposition || `attachment; filename="output.wav"`,
      },
    });
  } catch {
    return Response.json(
      { error: "Analysis server is not running. Start it with: python3 scripts/key-server.py" },
      { status: 503 }
    );
  }
}
