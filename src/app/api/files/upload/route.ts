import { NextRequest } from "next/server";

export const runtime = "nodejs"; // for large uploads

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return Response.json({ error: "Missing GEMINI_API_KEY" }, { status: 500 });

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "Expected 'file' form-data field" }, { status: 400 });
    }

    // Upload via Files API (raw upload). Use Buffer body to avoid duplex requirement.
    const ab = await file.arrayBuffer();
    const bufView = new Uint8Array(ab);
    const uploadRes = await fetch(
      `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "X-Goog-Upload-Protocol": "raw",
          "Content-Type": file.type || "application/octet-stream",
          "X-Goog-Upload-Header-Content-Length": String(bufView.byteLength),
          "Content-Length": String(bufView.byteLength),
        },
        body: bufView,
      }
    );

    if (!uploadRes.ok) {
      const text = await uploadRes.text();
      return Response.json({ error: `Upload failed: ${uploadRes.status} ${text}` }, { status: 500 });
    }

    const meta = await uploadRes.json();
    // meta.name like "files/abc123"
    return Response.json({ id: meta.name, uri: meta.uri || meta.name, meta });
  } catch (err: any) {
    console.error("/api/files/upload error", err);
    return Response.json({ error: err?.message ?? "Unknown error" }, { status: 400 });
  }
}
