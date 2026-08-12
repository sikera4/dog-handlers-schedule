import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { createAuthenticatedSupabaseClient } from "@/server/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = url.searchParams.get("next");
  const safeNext =
    next?.startsWith("/") && !next.startsWith("//") ? next : "/admin";

  if (env.DATA_BACKEND !== "supabase") {
    return NextResponse.redirect(new URL("/admin", url.origin));
  }

  const code = url.searchParams.get("code");
  if (code) {
    const client = await createAuthenticatedSupabaseClient();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(safeNext, url.origin));
  }

  return NextResponse.redirect(new URL("/admin?authError=1", url.origin));
}
