import type { Metadata } from "next";

import { AdminLogin } from "@/components/admin/admin-login";
import { AdminShell } from "@/components/admin/admin-shell";
import { env } from "@/lib/env";
import { getAdminSession } from "@/server/auth/admin-session";
import { getAdminRepository } from "@/server/data/repository";

export const metadata: Metadata = {
  title: "Панель администратора",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ authError?: string }>;
}) {
  const [session, query] = await Promise.all([getAdminSession(), searchParams]);
  if (!session) {
    return (
      <AdminLogin
        mode={env.DATA_BACKEND}
        configured={
          env.DATA_BACKEND === "supabase" ||
          Boolean(env.DEV_ADMIN_PASSWORD && env.ADMIN_SESSION_SECRET)
        }
        authError={query.authError === "1"}
      />
    );
  }

  const repository = getAdminRepository(session.client);
  const [bookings, slots] = await Promise.all([
    repository.listBookings(),
    repository.listSlots(),
  ]);
  return (
    <AdminShell bookings={bookings} slots={slots} identity={session.identity} />
  );
}
