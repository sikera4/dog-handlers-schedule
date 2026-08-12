import { createSlotsSchema } from "@/lib/api-schemas";
import { getAdminSession } from "@/server/auth/admin-session";
import { getAdminRepository } from "@/server/data/repository";
import { isRepositoryError } from "@/server/data/types";

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return Response.json({ message: "Требуется вход" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createSlotsSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { message: "Проверьте параметры расписания" },
      { status: 400 },
    );
  }

  try {
    const created = await getAdminRepository(session.client).createSlots(
      parsed.data,
    );
    return Response.json({ created }, { status: 201 });
  } catch (error) {
    if (isRepositoryError(error) && error.code === "CONFLICT") {
      return Response.json(
        { message: "Новое занятие пересекается с существующим" },
        { status: 409 },
      );
    }
    return Response.json(
      { message: "Не удалось создать занятия" },
      { status: 500 },
    );
  }
}
