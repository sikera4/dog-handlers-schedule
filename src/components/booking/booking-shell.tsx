import Link from "next/link";
import { Clock3Icon, PawPrintIcon } from "lucide-react";

import { BookingFlow } from "@/components/booking/booking-flow";
import { Badge } from "@/components/ui/badge";
import { PRODUCT_NAME } from "@/config/product";

export function BookingShell({
  entryPoint,
}: {
  entryPoint: "web" | "telegram";
}) {
  const isTelegram = entryPoint === "telegram";

  return (
    <main className="relative isolate mx-auto flex min-h-dvh w-full max-w-6xl flex-col overflow-hidden px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
      <div
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
        aria-hidden="true"
      >
        <span className="motion-ambient absolute -top-24 -left-28 size-80 rounded-full bg-primary/10 blur-3xl" />
        <span className="motion-ambient motion-ambient-slow absolute top-1/3 -right-36 size-96 rounded-full bg-accent/55 blur-3xl" />
      </div>

      <header className="motion-slide-down relative z-10 flex items-center justify-between gap-4">
        <Link
          href={isTelegram ? "/telegram" : "/"}
          className="inline-flex items-center gap-2 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <PawPrintIcon className="size-5" aria-hidden="true" />
          </span>
          <span className="font-semibold tracking-tight">{PRODUCT_NAME}</span>
        </Link>
        <Badge variant="secondary">
          {isTelegram ? "Telegram Mini App" : "Веб-запись"}
        </Badge>
      </header>

      <section className="relative z-10 space-y-8 py-10 lg:py-14">
        <div className="mx-auto max-w-3xl space-y-4 text-center">
          <Badge variant="outline" className="motion-enter gap-1.5">
            <Clock3Icon className="size-3.5" aria-hidden="true" />
            Время показываем по Москве
          </Badge>
          <h1 className="motion-enter motion-enter-delay-1 text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl">
            Запись на занятие с кинологом
          </h1>
          <p className="motion-enter motion-enter-delay-2 text-base leading-7 text-muted-foreground sm:text-lg">
            Выберите свободное время и оставьте контакт. Аккаунт не нужен.
          </p>
        </div>

        <div className="motion-enter motion-enter-delay-3">
          <BookingFlow entryPoint={entryPoint} />
        </div>
      </section>
    </main>
  );
}
