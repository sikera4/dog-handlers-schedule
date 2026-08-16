import { PRODUCT_NAME } from "@/config/product";
import type { AdminBooking } from "@/server/data/types";

type CalendarBooking = Pick<
  AdminBooking,
  "clientName" | "dogName" | "endsAt" | "location" | "sessionType" | "startsAt"
>;

export function createGoogleCalendarUrl(booking: CalendarBooking) {
  const details = [
    booking.sessionType === "individual"
      ? "Индивидуальное занятие"
      : "Групповое занятие",
    `Собака: ${booking.dogName}`,
    booking.clientName ? `Клиент: ${booking.clientName}` : undefined,
  ].filter((line): line is string => Boolean(line));

  const parameters = new URLSearchParams({
    action: "TEMPLATE",
    text: `${PRODUCT_NAME} — ${booking.dogName}`,
    dates: `${formatGoogleDate(booking.startsAt)}/${formatGoogleDate(booking.endsAt)}`,
    details: details.join("\n"),
  });

  if (booking.location) parameters.set("location", booking.location);

  return `https://calendar.google.com/calendar/render?${parameters.toString()}`;
}

function formatGoogleDate(value: string) {
  return new Date(value)
    .toISOString()
    .replaceAll("-", "")
    .replaceAll(":", "")
    .replace(/\.\d{3}Z$/, "Z");
}
