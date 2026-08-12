import { bookingSubmissionSchema } from "@/lib/booking-schema";
import { getPublicRepository } from "@/server/data/repository";
import { isRepositoryError, type RepositoryError } from "@/server/data/types";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = bookingSubmissionSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      {
        error: "INVALID_BOOKING",
        message: "Проверьте данные записи",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  try {
    const confirmation = await getPublicRepository().createBooking(parsed.data);
    return Response.json({ booking: confirmation }, { status: 201 });
  } catch (error) {
    if (isRepositoryError(error)) {
      const messages: Partial<Record<RepositoryError["code"], string>> = {
        SLOT_NOT_FOUND: "Это время больше недоступно",
        SLOT_NOT_OPEN: "Запись на это время закрыта",
        SLOT_IN_PAST: "Это занятие уже началось",
        SLOT_FULL: "Последнее место уже занято",
      };
      return Response.json(
        {
          error: error.code,
          message: messages[error.code] ?? "Не удалось создать запись",
        },
        { status: error.code === "SLOT_NOT_FOUND" ? 404 : 409 },
      );
    }

    return Response.json(
      { error: "BOOKING_FAILED", message: "Не удалось создать запись" },
      { status: 500 },
    );
  }
}
