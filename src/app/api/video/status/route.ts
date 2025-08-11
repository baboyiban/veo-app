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

    // Optional progress fields if exposed by backend
    const meta = latest?.metadata || latest?.metadata?.value || {};
    const progress = meta.progress || meta.percent || meta.progress_percent || meta.progressPercent;
    const stage = meta.stage || meta.state || meta.status;

    let fileUri: string | undefined;
    // Support both camelCase and snake_case from backend
    const resp = latest?.response || latest?.response?.value || {};
    const gv = resp.generatedVideos || resp.generated_videos || resp.videos || resp.results;
    if (latest?.done && Array.isArray(gv) && gv.length > 0) {
      const item = gv[0];
      const v = item?.video || item?.video_result || item?.result || item;
      if (v) {
        // common direct fields
        fileUri = typeof v === "string" ? v : (v.uri || v.fileUri || v.file_uri || v.mediaUri || v.media_uri);
        // nested file objects
        if (!fileUri) {
          const f = v.file || v.output_file || v.result_file || v.media || v.content;
          if (f) {
            fileUri = f.uri || f.fileUri || f.file_uri || f.mediaUri || f.media_uri || f.name;
          }
        }
        // sometimes only id provided
        if (!fileUri) {
          const id = v.fileId || v.file_id || item.fileId || item.file_id;
          if (id) fileUri = id;
        }
      }
    }

    return Response.json({ done: !!latest?.done, fileUri, progress, stage, raw: latest });
  } catch (err: any) {
    console.error("/api/video/status error", err);
    return Response.json({ error: err?.message ?? "Unknown error" }, { status: 400 });
  }
}
