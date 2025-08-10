import { GoogleGenAI } from "@google/genai";
import { env } from "./env";

export const genAI = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY, vertexai: false });
