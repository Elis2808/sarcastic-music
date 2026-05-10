import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (err) {
    return Response.json({ error: "Invalid form data" }, { status: 400 });
  }
  
  const file = formData.get("file");
  if (!file || !(file instanceof Blob)) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }

  try {
    const pythonForm = new FormData();
    pythonForm.append("file", file);

    const res = await fetch(`${process.env.PYTHON_API_URL || "http://127.0.0.1:5001"}/detect-bpm`, {
      method: "POST",
      body: pythonForm,
    });

    const data = await res.json();
    if (!res.ok) return Response.json(data, { status: res.status });
    return Response.json(data);
  } catch {
    return Response.json(
      { error: "Analysis server is not running. Start it with: python3 scripts/key-server.py" },
      { status: 503 }
    );
  }
}
