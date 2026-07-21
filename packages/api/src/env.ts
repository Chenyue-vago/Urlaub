import { z } from "zod";

// Best-effort load of a local .env file (present in dev/test, absent/irrelevant
// in prod where real env vars are injected by the platform).
try {
  process.loadEnvFile();
} catch {
  // no .env file found — fine, rely on already-set process.env vars
}

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  CLERK_SECRET_KEY: z.string().optional(),
  CLERK_PUBLISHABLE_KEY: z.string().optional(),
  WEB_ORIGIN: z.string().default("http://localhost:5173"),
  PORT: z.coerce.number().int().positive().default(3000),
  // Comma-separated email domains allowed to sign in. Defaults to the company
  // domain; override locally (e.g. to add gmail.com for a personal demo account)
  // via packages/api/.env. See resolveUser in auth/context.ts.
  ALLOWED_EMAIL_DOMAINS: z.string().default("vago-solutions.ai"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration");
}

export const env = parsed.data;
export type Env = typeof env;
