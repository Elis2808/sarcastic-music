import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof Blob)) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }

  try {
    const pythonForm = new FormData();
    pythonForm.append("file", file);

    const res = await fetch("http://127.0.0.1:5001/detect-key", {
      method: "POST",
      body: pythonForm,
    });

    const data = await res.json();
    if (!res.ok) return Response.json(data, { status: res.status });
    return Response.json(data);
  } catch {
    return Response.json(
      { error: "Key detection server is not running. Start it with: python3 scripts/key-server.py" },
      { status: 503 }
    );
  }
}
