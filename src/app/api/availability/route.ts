import { availabilityQuerySchema } from "@/lib/api-schemas";
import { getPublicRepository } from "@/server/data/repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = availabilityQuerySchema.safeParse({
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
    sessionType: url.searchParams.get("sessionType") ?? undefined,
  });

  if (!parsed.success) {
    return Response.json(
      { error: "INVALID_QUERY", message: "Некорректный диапазон расписания" },
      { status: 400 },
    );
  }

  try {
    const slots = await getPublicRepository().listAvailability(parsed.data);
    return Response.json(
      { slots },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      {
        error: "AVAILABILITY_UNAVAILABLE",
        message: "Не удалось загрузить расписание",
      },
      { status: 503 },
    );
  }
}
