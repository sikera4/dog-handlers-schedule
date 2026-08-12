import { adminStatusSchema } from "@/lib/api-schemas";
import { getAdminSession } from "@/server/auth/admin-session";
import { getAdminRepository } from "@/server/data/repository";
import { isRepositoryError } from "@/server/data/types";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSession();
  if (!session) {
    return Response.json({ message: "Требуется вход" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = adminStatusSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ message: "Некорректный статус" }, { status: 400 });
  }

  const { id } = await context.params;
  try {
    await getAdminRepository(session.client).updateBookingStatus(
      id,
      parsed.data.status,
    );
    return Response.json({ ok: true });
  } catch (error) {
    const status = isRepositoryError(error) ? 409 : 500;
    return Response.json({ message: "Не удалось обновить запись" }, { status });
  }
}
