import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return Response.json({ error: "Missing GEMINI_API_KEY" }, { status: 500 });

    const { searchParams } = new URL(req.url);
    const name = searchParams.get("name");
    if (!name) return Response.json({ error: "Missing operation name" }, { status: 400 });

    // Poll operation status via REST to avoid SDK's internal instance requirements
    // The operation name is returned by models.generateVideos; call v1beta/{name}
    const opRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/${encodeURI(name)}?key=${apiKey}`);
    if (!opRes.ok) {
      const text = await opRes.text();
      return Response.json({ error: `status fetch failed: ${opRes.status} ${text}` }, { status: 500 });
    }
    const latest = await opRes.json();

    let fileUri: string | undefined;
    const gv = latest?.response?.generatedVideos;
    if (latest?.done && Array.isArray(gv) && gv.length > 0) {
      const video = gv[0]?.video;
      if (video) fileUri = typeof video === "string" ? video : video.uri;
    }

    return Response.json({ done: !!latest?.done, fileUri, raw: latest });
  } catch (err: any) {
    console.error("/api/video/status error", err);
    return Response.json({ error: err?.message ?? "Unknown error" }, { status: 400 });
  }
}
