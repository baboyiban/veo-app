import { z } from "zod";

const envSchema = z.object({
  GEMINI_API_KEY: z.string().min(1, "Set GEMINI_API_KEY in .env.local"),
});

type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse({
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  });
  if (!parsed.success) {
    const issues = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join("\n");
    throw new Error(`Invalid env configuration:\n${issues}`);
  }
  return parsed.data;
}

export const env = loadEnv();
