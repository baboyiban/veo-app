import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return Response.json({ error: "Missing GEMINI_API_KEY" }, { status: 500 });

    const { searchParams } = new URL(req.url);
    const fileUri = searchParams.get("fileUri");
    if (!fileUri) return Response.json({ error: "Missing fileUri" }, { status: 400 });

    // Try to resolve a public download URL then redirect; if not available, stream bytes
    const name = fileUri.startsWith("files/") ? fileUri : `files/${fileUri}`;
    // 1) Try metadata to see if it contains a downloadable URI
    const metaRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/${name}?key=${apiKey}`);
    if (metaRes.ok) {
      const meta = await metaRes.json();
      const uri = meta.uri || meta.downloadUri || meta.fileUri || meta.mediaUri;
      if (uri && typeof uri === "string") {
        return Response.redirect(uri, 302);
      }
    }

    // 2) Fallback: attempt direct media download endpoint and stream
    const dlRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/${name}:download?key=${apiKey}`);
    if (!dlRes.ok) {
      const text = await dlRes.text();
      return Response.json({ error: `Download failed: ${dlRes.status} ${text}` }, { status: 500 });
    }
    return new Response(dlRes.body, {
      headers: {
        "Content-Type": dlRes.headers.get("content-type") || "video/mp4",
        "Content-Disposition": "attachment; filename=veo3_video.mp4",
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    console.error("/api/video/download error", err);
    return Response.json({ error: err?.message ?? "Unknown error" }, { status: 400 });
  }
}
