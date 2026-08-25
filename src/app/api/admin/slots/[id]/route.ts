import { z } from "zod";

import { getAdminSession } from "@/server/auth/admin-session";
import { getAdminRepository } from "@/server/data/repository";
import { isRepositoryError } from "@/server/data/types";

const slotIdSchema = z.string().uuid();

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSession();
  if (!session) {
    return Response.json({ message: "Требуется вход" }, { status: 401 });
  }

  const { id } = await params;
  const parsedId = slotIdSchema.safeParse(id);
  if (!parsedId.success) {
    return Response.json(
      { message: "Некорректный идентификатор" },
      { status: 400 },
    );
  }

  try {
    await getAdminRepository(session.client).deleteSlot(parsedId.data);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (isRepositoryError(error)) {
      if (error.code === "SLOT_NOT_FOUND") {
        return Response.json({ message: "Слот не найден" }, { status: 404 });
      }
      if (error.code === "SLOT_HAS_ACTIVE_BOOKINGS") {
        return Response.json(
          { message: "Нельзя удалить слот, пока есть активные записи" },
          { status: 409 },
        );
      }
    }

    return Response.json(
      { message: "Не удалось удалить слот" },
      { status: 500 },
    );
  }
}
