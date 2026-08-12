import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { env } from "@/lib/env";
import { createAuthenticatedSupabaseClient } from "@/server/supabase/server";

export const ADMIN_COOKIE_NAME = "dog-handler-admin";
const SESSION_TTL_SECONDS = 12 * 60 * 60;

export type AdminSession = {
  kind: "development" | "supabase";
  identity: string;
  client?: SupabaseClient;
};

export async function getAdminSession(): Promise<AdminSession | null> {
  if (env.DATA_BACKEND === "development") {
    const cookieStore = await cookies();
    const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
    let payload: { expiresAt?: number } | null = null;
    try {
      payload = token ? verifyDevelopmentToken(token) : null;
    } catch {
      payload = null;
    }
    return payload
      ? { kind: "development", identity: "Локальный администратор" }
      : null;
  }

  const client = await createAuthenticatedSupabaseClient();
  const { data, error } = await client.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return null;

  const { data: admin } = await client
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userId)
    .eq("active", true)
    .maybeSingle();

  return admin
    ? {
        kind: "supabase",
        identity: String(data.claims.email ?? userId),
        client,
      }
    : null;
}

export function createDevelopmentToken() {
  const secret = getDevelopmentSecret();
  const payload = Buffer.from(
    JSON.stringify({ expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000 }),
  ).toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

export function developmentPasswordMatches(password: string) {
  if (!env.DEV_ADMIN_PASSWORD) return false;
  const expected = Buffer.from(env.DEV_ADMIN_PASSWORD);
  const actual = Buffer.from(password);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function getAdminCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}

function verifyDevelopmentToken(token: string) {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = createHmac("sha256", getDevelopmentSecret())
    .update(payload)
    .digest("base64url");
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (
    expectedBuffer.length !== actualBuffer.length ||
    !timingSafeEqual(expectedBuffer, actualBuffer)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as {
      expiresAt?: number;
    };
    return parsed.expiresAt && parsed.expiresAt > Date.now() ? parsed : null;
  } catch {
    return null;
  }
}

function getDevelopmentSecret() {
  const secret = env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("Local admin authentication is not configured");
  return secret;
}
