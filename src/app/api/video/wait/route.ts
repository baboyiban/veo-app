import { NextRequest } from "next/server";

export const runtime = "nodejs";

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function extractFileUri(latest: any): string | undefined {
  const resp = latest?.response || latest?.response?.value || {};
  const gv = resp.generatedVideos || resp.generated_videos || resp.videos || resp.results;
  if (latest?.done && Array.isArray(gv) && gv.length > 0) {
    const item = gv[0];
    const v = item?.video || item?.video_result || item?.result || item;
    if (v) {
      let uri = typeof v === "string" ? v : (v.uri || v.fileUri || v.file_uri || v.mediaUri || v.media_uri);
      if (!uri) {
        const f = v.file || v.output_file || v.result_file || v.media || v.content;
        if (f) {
          uri = f.uri || f.fileUri || f.file_uri || f.mediaUri || f.media_uri || f.name;
        }
      }
      if (!uri) {
        const id = v.fileId || v.file_id || item.fileId || item.file_id;
        if (id) uri = id;
      }
      return uri;
    }
  }
  return undefined;
}

export async function GET(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return Response.json({ error: "Missing GEMINI_API_KEY" }, { status: 500 });

    const { searchParams } = new URL(req.url);
    const name = searchParams.get("name");
    if (!name) return Response.json({ error: "Missing operation name" }, { status: 400 });

    const timeoutMsParam = searchParams.get("timeoutMs");
    const timeoutMs = Math.max(10_000, Math.min(60 * 60 * 1000, Number(timeoutMsParam) || 10 * 60 * 1000));
    const deadlineMs = Date.now() + timeoutMs; // default up to 10 minutes
    let last: any = null;
    let pollCount = 0;
    while (Date.now() < deadlineMs) {
      pollCount++;
      console.log(`[wait] Poll ${pollCount} for operation ${name}`);

      const opRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/${encodeURI(name)}?key=${apiKey}`);
      if (!opRes.ok) {
        const text = await opRes.text();
        console.error(`[wait] Poll ${pollCount} failed: ${opRes.status} ${text}`);
        return Response.json({ error: `status fetch failed: ${opRes.status} ${text}` }, { status: 500 });
      }

      last = await opRes.json();
      const done = !!last?.done;
      const fileUri = extractFileUri(last);

      console.log(`[wait] Poll ${pollCount}: done=${done}, fileUri=${fileUri}`);
      console.log(`[wait] Raw response structure:`, JSON.stringify(last, null, 2).slice(0, 500));

      if (done && fileUri) {
        const url = `/api/video/download?fileUri=${encodeURIComponent(fileUri)}`;
        console.log(`[wait] Redirecting to: ${url}`);
        return Response.redirect(url, 302);
      }

      if (done && !fileUri) {
        console.warn(`[wait] Operation done but no fileUri found. Raw:`, JSON.stringify(last, null, 2));
        return Response.json({
          error: "Operation completed but no video file URI found",
          done: true,
          raw: last
        }, { status: 502 });
      }

      // backoff: poll every 10s
      await sleep(10_000);
    }
    return Response.json({ error: "Timed out waiting for video.", raw: last }, { status: 504 });
  } catch (err: any) {
    console.error("/api/video/wait error", err);
    return Response.json({ error: err?.message ?? "Unknown error" }, { status: 400 });
  }
}
