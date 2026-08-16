import { describe, expect, it } from "vitest";

import { createGoogleCalendarUrl } from "@/lib/google-calendar";

describe("Google Calendar link", () => {
  it("creates a prefilled event with UTC dates and booking context", () => {
    const url = new URL(
      createGoogleCalendarUrl({
        sessionType: "individual",
        startsAt: "2026-08-20T15:00:00.000Z",
        endsAt: "2026-08-20T16:00:00.000Z",
        dogName: "Бублик",
        clientName: "Анна",
        location: "Площадка у парка",
      }),
    );

    expect(url.origin).toBe("https://calendar.google.com");
    expect(url.pathname).toBe("/calendar/render");
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("text")).toBe("Диалог с собакой — Бублик");
    expect(url.searchParams.get("dates")).toBe(
      "20260820T150000Z/20260820T160000Z",
    );
    expect(url.searchParams.get("details")).toBe(
      "Индивидуальное занятие\nСобака: Бублик\nКлиент: Анна",
    );
    expect(url.searchParams.get("location")).toBe("Площадка у парка");
  });

  it("omits optional client and location details", () => {
    const url = new URL(
      createGoogleCalendarUrl({
        sessionType: "group",
        startsAt: "2026-08-20T15:00:00Z",
        endsAt: "2026-08-20T16:00:00Z",
        dogName: "Рекс",
      }),
    );

    expect(url.searchParams.get("details")).toBe(
      "Групповое занятие\nСобака: Рекс",
    );
    expect(url.searchParams.has("location")).toBe(false);
  });
});
