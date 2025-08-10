import { NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return Response.json({ error: "Missing GEMINI_API_KEY" }, { status: 500 });

    const { searchParams } = new URL(req.url);
    const name = searchParams.get("name");
    if (!name) return Response.json({ error: "Missing operation name" }, { status: 400 });

    const ai = new GoogleGenAI({ apiKey, vertexai: false } as any);

    // Rehydrate operation and fetch latest status
    const latest = await ai.operations.getVideosOperation({ operation: { name } as any });

    // When done, surface first generated video URI
    let fileUri: string | undefined;
    if (latest.done && latest.response?.generatedVideos?.[0]?.video) {
      const v = latest.response.generatedVideos[0].video as any;
      fileUri = v?.uri || v; // prefer uri
    }

    return Response.json({ done: !!latest.done, fileUri, raw: latest });
  } catch (err: any) {
    console.error("/api/video/status error", err);
    return Response.json({ error: err?.message ?? "Unknown error" }, { status: 400 });
  }
}
