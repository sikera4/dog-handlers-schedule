import type { Metadata } from "next";

import { TelegramBooking } from "@/components/telegram/telegram-booking";

export const metadata: Metadata = {
  title: "Запись в Telegram",
};

export default function TelegramPage() {
  return <TelegramBooking />;
}
