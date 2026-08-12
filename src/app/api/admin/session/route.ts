import { z } from "zod";
import { cookies } from "next/headers";

import { env } from "@/lib/env";
import {
  ADMIN_COOKIE_NAME,
  createDevelopmentToken,
  developmentPasswordMatches,
  getAdminCookieOptions,
} from "@/server/auth/admin-session";
import { createAuthenticatedSupabaseClient } from "@/server/supabase/server";

const loginSchema = z.object({
  email: z.email().optional(),
  password: z.string().optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { message: "Проверьте данные входа" },
      { status: 400 },
    );
  }

  if (env.DATA_BACKEND === "development") {
    if (
      !parsed.data.password ||
      !developmentPasswordMatches(parsed.data.password)
    ) {
      return Response.json({ message: "Неверный пароль" }, { status: 401 });
    }

    const cookieStore = await cookies();
    cookieStore.set(
      ADMIN_COOKIE_NAME,
      createDevelopmentToken(),
      getAdminCookieOptions(),
    );
    return Response.json({ ok: true });
  }

  if (!parsed.data.email) {
    return Response.json({ message: "Укажите email" }, { status: 400 });
  }

  const client = await createAuthenticatedSupabaseClient();
  const origin = new URL(request.url).origin;
  const { error } = await client.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${origin}/auth/callback?next=/admin`,
    },
  });
  if (error) {
    return Response.json(
      { message: "Не удалось отправить ссылку" },
      { status: 400 },
    );
  }

  return Response.json({ ok: true, magicLinkSent: true });
}

export async function DELETE() {
  if (env.DATA_BACKEND === "development") {
    const cookieStore = await cookies();
    cookieStore.delete(ADMIN_COOKIE_NAME);
  } else {
    const client = await createAuthenticatedSupabaseClient();
    await client.auth.signOut();
  }

  return Response.json({ ok: true });
}
