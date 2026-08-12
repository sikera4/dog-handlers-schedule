import "server-only";

import { z } from "zod";

import { DEFAULT_TIME_ZONE } from "@/config/product";

const optionalText = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().optional(),
);

const serverEnvSchema = z
  .object({
    APP_TIME_ZONE: z.literal(DEFAULT_TIME_ZONE).default(DEFAULT_TIME_ZONE),
    DATA_BACKEND: z.enum(["development", "supabase"]).default("development"),
    DEV_DATA_FILE: z.string().min(1).default(".data/dev-db.json"),
    DEV_ADMIN_PASSWORD: optionalText,
    ADMIN_SESSION_SECRET: optionalText,
    NEXT_PUBLIC_SUPABASE_URL: optionalText.pipe(z.url().optional()),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalText,
  })
  .superRefine((value, context) => {
    if (value.DATA_BACKEND === "supabase") {
      if (!value.NEXT_PUBLIC_SUPABASE_URL) {
        context.addIssue({
          code: "custom",
          message: "Required when DATA_BACKEND=supabase",
          path: ["NEXT_PUBLIC_SUPABASE_URL"],
        });
      }
      if (!value.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        context.addIssue({
          code: "custom",
          message: "Required when DATA_BACKEND=supabase",
          path: ["NEXT_PUBLIC_SUPABASE_ANON_KEY"],
        });
      }
    }

    if (value.ADMIN_SESSION_SECRET && value.ADMIN_SESSION_SECRET.length < 32) {
      context.addIssue({
        code: "custom",
        message: "Must contain at least 32 characters",
        path: ["ADMIN_SESSION_SECRET"],
      });
    }
  });

export const env = serverEnvSchema.parse({
  APP_TIME_ZONE: process.env.APP_TIME_ZONE,
  DATA_BACKEND: process.env.DATA_BACKEND,
  DEV_DATA_FILE: process.env.DEV_DATA_FILE,
  DEV_ADMIN_PASSWORD: process.env.DEV_ADMIN_PASSWORD,
  ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});

export function getSupabaseConfig() {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("Supabase environment is not configured");
  }

  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}
