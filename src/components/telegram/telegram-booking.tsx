import { BookingShell } from "@/components/booking/booking-shell";

export function TelegramBooking() {
  return (
    <div className="telegram-theme">
      <BookingShell entryPoint="telegram" />
    </div>
  );
}
