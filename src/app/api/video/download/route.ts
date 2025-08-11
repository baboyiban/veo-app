import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return Response.json({ error: "Missing GEMINI_API_KEY" }, { status: 500 });

    const { searchParams } = new URL(req.url);
    const fileUri = searchParams.get("fileUri");
    if (!fileUri) return Response.json({ error: "Missing fileUri" }, { status: 400 });

    // If an absolute URL is provided, redirect directly (some backends return signed URLs)
    if (/^https?:\/\//i.test(fileUri)) {
      return Response.redirect(fileUri, 302);
    }

    // Normalize to files/{id}
    const name = fileUri.startsWith("files/") ? fileUri : `files/${fileUri}`;

    // 1) Stream bytes from :download endpoint (most reliable and avoids cross-origin issues)
    const dlRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/${name}:download?key=${apiKey}`);
    if (dlRes.ok) {
      const ct = dlRes.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        // some backends return JSON containing a signed uri
        const j = await dlRes.json();
        const uri = j.uri || j.downloadUri || j.fileUri || j.mediaUri;
        if (uri) return Response.redirect(uri, 302);
      }
      if (dlRes.body) {
        return new Response(dlRes.body, {
          headers: {
            "Content-Type": ct || "video/mp4",
            "Content-Disposition": "attachment; filename=veo3_video.mp4",
            "Cache-Control": "no-store",
          },
        });
      }
    }

    // 2) Fallback: check metadata for a downloadable URI and redirect to it
    const metaRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/${name}?key=${apiKey}`);
    if (metaRes.ok) {
      const meta = await metaRes.json();
      const uri: string | undefined = meta.uri || meta.downloadUri || meta.fileUri || meta.mediaUri;
      if (uri && typeof uri === "string") {
        return Response.redirect(uri, 302);
      }
    }

    const msg = dlRes.ok ? "Empty body from download endpoint" : `Status ${dlRes.status}`;
    return Response.json({ error: `Download failed: ${msg}` }, { status: 502 });
  } catch (err: any) {
    console.error("/api/video/download error", err);
    return Response.json({ error: err?.message ?? "Unknown error" }, { status: 400 });
  }
}
