import { z } from "zod";
const schema = z.object({
  PORT: z.coerce.number().default(10000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  ALLOWED_ORIGINS: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  SUPABASE_URL: z.string().optional(), // unused: the backend connects with DATABASE_URL
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(), // not needed with a direct Postgres connection; omit it to shrink the secret surface
  SESSION_TOKEN_SECRET: z.string().min(32, "must be at least 32 characters"),
  ADMIN_API_KEY: z.string().min(24, "must be at least 24 characters").optional(),
  MAX_ROOM_SIZE: z.coerce.number().int().min(2).max(6).default(6),
  ROOM_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
});
export type Env = z.infer<typeof schema>;
/** Reports only variable names and reasons, never values. */
export function loadEnv(src: NodeJS.ProcessEnv = process.env): Env {
  const r = schema.safeParse(src);
  if (!r.success) throw new Error("Invalid configuration -> " + r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  return r.data;
}
