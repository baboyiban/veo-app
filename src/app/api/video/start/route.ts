import { NextRequest } from "next/server";
import { z } from "zod";
import { GoogleGenAI } from '@google/genai';

export const runtime = "nodejs";

const bodySchema = z.object({
  prompt: z.string().min(1),
  negativePrompt: z.string().optional(),
  aspectRatio: z.enum(["16:9"]).default("16:9"),
  personGeneration: z.enum(["allow_all", "allow_adult", "dont_allow"]).optional(),
  imageFileId: z.string().optional(),
  imageFileUri: z.string().optional(),
  fast: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = bodySchema.parse(body);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "Missing GEMINI_API_KEY" }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey, vertexai: false } as any);

    const model = input.fast ? "veo-3.0-fast-generate-preview" : "veo-3.0-generate-preview";

    const request: any = {
      model,
      prompt: input.prompt,
    };

    if (input.negativePrompt) {
      request.config = { ...(request.config || {}), negativePrompt: input.negativePrompt };
    }

    // durationSeconds is not supported by Veo 3 preview.
    // generateAudio is not supported; Veo 3 audio is always on

    if (input.personGeneration) {
      request.personGeneration = input.personGeneration;
    }

    if (input.imageFileUri || input.imageFileId) {
      const fileUri = input.imageFileUri ?? (input.imageFileId!.startsWith("files/") ? input.imageFileId : `files/${input.imageFileId}`);
      // Attach reference to existing uploaded image as starting frame
      request.image = { fileUri };
    }

    // Long running operation
    const operation = await ai.models.generateVideos(request as any);

    return Response.json({ name: operation.name, done: operation.done ?? false });
  } catch (err: any) {
    console.error("/api/video/start error", err);
    return Response.json({ error: err?.message ?? "Unknown error" }, { status: 400 });
  }
}
