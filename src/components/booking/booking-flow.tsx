"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeftIcon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  Clock3Icon,
  PawPrintIcon,
  RefreshCwIcon,
  UserRoundIcon,
  UsersIcon,
} from "lucide-react";
import { ru } from "date-fns/locale";
import { toast } from "sonner";

import { BookingDetailsForm } from "@/components/booking/booking-details-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DEFAULT_GROUP_CAPACITY, DEFAULT_TIME_ZONE } from "@/config/product";
import type { BookingDetails } from "@/lib/booking-schema";
import type {
  AvailabilitySlot,
  BookingConfirmation,
  SessionType,
} from "@/server/data/types";

const steps = ["Формат", "Дата", "Время", "Данные", "Проверка"];

export function BookingFlow({
  entryPoint,
}: {
  entryPoint: "web" | "telegram";
}) {
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>();
  const [sessionType, setSessionType] = useState<SessionType>();
  const [dayKey, setDayKey] = useState<string>();
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot>();
  const [details, setDetails] = useState<BookingDetails>();
  const [confirmation, setConfirmation] = useState<BookingConfirmation>();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>();

  const loadAvailability = useCallback(async () => {
    setLoading(true);
    setLoadError(undefined);
    const from = new Date();
    const to = new Date(from.getTime() + 45 * 24 * 60 * 60 * 1000);
    const query = new URLSearchParams({
      from: from.toISOString(),
      to: to.toISOString(),
    });

    try {
      const response = await fetch(`/api/availability?${query}`, {
        cache: "no-store",
      });
      const body = (await response.json()) as {
        slots?: AvailabilitySlot[];
        message?: string;
      };
      if (!response.ok) throw new Error(body.message);
      setSlots(body.slots ?? []);
    } catch {
      setLoadError("Не удалось загрузить расписание. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadAvailability();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadAvailability]);

  const typeSlots = useMemo(
    () => slots.filter((slot) => slot.sessionType === sessionType),
    [sessionType, slots],
  );
  const availableDays = useMemo(
    () => new Set(typeSlots.map((slot) => moscowDayKey(slot.startsAt))),
    [typeSlots],
  );
  const daySlots = useMemo(
    () => typeSlots.filter((slot) => moscowDayKey(slot.startsAt) === dayKey),
    [dayKey, typeSlots],
  );

  const currentStep = confirmation
    ? 5
    : details
      ? 4
      : selectedSlot
        ? 3
        : dayKey
          ? 2
          : sessionType
            ? 1
            : 0;

  function chooseType(type: SessionType) {
    setSessionType(type);
    setDayKey(undefined);
    setSelectedSlot(undefined);
    setDetails(undefined);
    setSubmitError(undefined);
  }

  async function submitBooking() {
    if (!selectedSlot || !details) return;
    setSubmitting(true);
    setSubmitError(undefined);

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotId: selectedSlot.id, ...details }),
      });
      const body = (await response.json()) as {
        booking?: BookingConfirmation;
        message?: string;
      };
      if (!response.ok || !body.booking) {
        throw new Error(body.message ?? "Не удалось создать запись");
      }

      setConfirmation(body.booking);
      toast.success("Заявка отправлена");
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Не удалось создать запись",
      );
      await loadAvailability();
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmation) {
    return (
      <Card className="motion-success-card relative mx-auto w-full max-w-2xl overflow-hidden shadow-lg">
        <CardHeader className="relative z-10 text-center">
          <div className="relative mx-auto mb-2 h-16 w-28" aria-hidden="true">
            <span className="motion-success-paw absolute top-7 left-1 text-primary/50">
              <PawPrintIcon className="size-5" />
            </span>
            <div className="motion-success-mark absolute top-0 left-1/2 grid size-14 -translate-x-1/2 place-items-center rounded-full bg-accent text-accent-foreground shadow-sm shadow-primary/15">
              <CheckCircle2Icon className="size-7" />
            </div>
            <span className="motion-success-paw motion-success-paw-end absolute top-5 right-1 text-primary/45">
              <PawPrintIcon className="size-4" />
            </span>
          </div>
          <CardTitle className="motion-enter motion-enter-delay-1 text-2xl">
            Заявка отправлена
          </CardTitle>
          <CardDescription className="motion-enter motion-enter-delay-2">
            Кинолог проверит расписание и свяжется с вами для подтверждения.
          </CardDescription>
        </CardHeader>
        <CardContent className="relative z-10 space-y-5">
          <dl className="motion-stagger grid gap-3 rounded-xl bg-muted/60 p-4 text-sm sm:grid-cols-2">
            <SummaryItem
              label="Формат"
              value={sessionTypeLabel(confirmation.sessionType)}
            />
            <SummaryItem
              label="Дата и время"
              value={formatSlot(confirmation)}
            />
            <SummaryItem label="Статус" value="Ожидает подтверждения" />
            <SummaryItem
              label="Номер заявки"
              value={confirmation.id.slice(0, 8)}
            />
          </dl>
          <Button
            asChild
            variant="outline"
            className="motion-enter motion-enter-delay-3 h-11 w-full"
          >
            <a href={entryPoint === "telegram" ? "/telegram" : "/"}>
              Создать ещё одну запись
            </a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <Card className="min-w-0 shadow-lg shadow-foreground/5">
        <CardHeader>
          <CardTitle>
            {steps[Math.min(currentStep, steps.length - 1)]}
          </CardTitle>
          <CardDescription>
            {currentStep === 0 && "Выберите подходящий формат занятия."}
            {currentStep === 1 && "Доступны только дни с открытыми местами."}
            {currentStep === 2 && "Время указано по Москве."}
            {currentStep === 3 && "Оставьте Telegram или телефон для связи."}
            {currentStep === 4 && "Проверьте данные перед отправкой."}
          </CardDescription>
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="Прогресс записи"
            aria-valuemin={1}
            aria-valuemax={steps.length}
            aria-valuenow={Math.min(currentStep + 1, steps.length)}
          >
            <span
              className="block h-full origin-left rounded-full bg-primary transition-transform duration-500 ease-out"
              style={{
                transform: `scaleX(${Math.min(currentStep + 1, steps.length) / steps.length})`,
              }}
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="motion-step-in">
              <LoadingState />
            </div>
          ) : null}
          {loadError ? (
            <div className="motion-step-in">
              <ErrorState message={loadError} onRetry={loadAvailability} />
            </div>
          ) : null}

          {!loading && !loadError && currentStep === 0 ? (
            <div className="motion-step-in motion-stagger grid gap-3 sm:grid-cols-2">
              <SessionButton
                icon={UserRoundIcon}
                title="Индивидуальное"
                note="Персональное занятие"
                places="1 место"
                onClick={() => chooseType("individual")}
              />
              <SessionButton
                icon={UsersIcon}
                title="Групповое"
                note="Занятие в небольшой группе"
                places={`до ${DEFAULT_GROUP_CAPACITY} мест`}
                onClick={() => chooseType("group")}
              />
            </div>
          ) : null}

          {!loading && !loadError && currentStep === 1 && sessionType ? (
            <div className="motion-step-in space-y-5">
              {typeSlots.length > 0 ? (
                <div className="flex justify-center overflow-x-auto">
                  <Calendar
                    mode="single"
                    locale={ru}
                    selected={dayKey ? calendarDateFromKey(dayKey) : undefined}
                    defaultMonth={calendarDateFromKey(
                      moscowDayKey(typeSlots[0].startsAt),
                    )}
                    disabled={(date) =>
                      !availableDays.has(calendarDayKey(date))
                    }
                    onSelect={(date) =>
                      setDayKey(date ? calendarDayKey(date) : undefined)
                    }
                  />
                </div>
              ) : (
                <ErrorState
                  message="Для этого формата пока нет свободных занятий."
                  onRetry={loadAvailability}
                />
              )}
              <BackButton
                onClick={() => setSessionType(undefined)}
                label="К формату"
              />
            </div>
          ) : null}

          {currentStep === 2 && dayKey ? (
            <div className="motion-step-in space-y-5">
              <p className="font-medium capitalize">{formatDayKey(dayKey)}</p>
              <div className="motion-stagger grid grid-cols-2 gap-3 sm:grid-cols-3">
                {daySlots.map((slot) => (
                  <Button
                    key={slot.id}
                    variant="outline"
                    className="h-auto min-h-14 flex-col gap-1 py-2 hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-sm active:scale-[0.98]"
                    onClick={() => setSelectedSlot(slot)}
                  >
                    <span>{formatTime(slot.startsAt)}</span>
                    {slot.sessionType === "group" ? (
                      <span className="text-xs font-normal text-muted-foreground">
                        {placesLabel(slot.remainingCapacity)}
                      </span>
                    ) : null}
                  </Button>
                ))}
              </div>
              <BackButton
                onClick={() => setDayKey(undefined)}
                label="К календарю"
              />
            </div>
          ) : null}

          {currentStep === 3 && selectedSlot ? (
            <div className="motion-step-in space-y-5">
              <BookingDetailsForm
                initialValues={details}
                onContinue={setDetails}
              />
              <BackButton
                onClick={() => setSelectedSlot(undefined)}
                label="К выбору времени"
              />
            </div>
          ) : null}

          {currentStep === 4 && selectedSlot && details ? (
            <div className="motion-step-in space-y-5">
              <dl className="motion-stagger grid gap-3 rounded-xl bg-muted/60 p-4 text-sm sm:grid-cols-2">
                <SummaryItem
                  label="Формат"
                  value={sessionTypeLabel(selectedSlot.sessionType)}
                />
                <SummaryItem
                  label="Дата и время"
                  value={formatSlot(selectedSlot)}
                />
                <SummaryItem label="Собака" value={details.dogName} />
                <SummaryItem
                  label="Контакт"
                  value={
                    details.telegramUsername
                      ? `@${details.telegramUsername}`
                      : (details.phone ?? "—")
                  }
                />
              </dl>
              {submitError ? (
                <p
                  className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
                  role="alert"
                >
                  {submitError}
                </p>
              ) : null}
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  className="h-11 sm:flex-1"
                  disabled={submitting}
                  onClick={submitBooking}
                >
                  {submitting ? "Отправляем…" : "Отправить заявку"}
                </Button>
                <Button
                  className="h-11"
                  variant="outline"
                  disabled={submitting}
                  onClick={() => setDetails(undefined)}
                >
                  Изменить данные
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <aside className="space-y-4">
        <ol className="space-y-2" aria-label="Этапы записи">
          {steps.map((step, index) => (
            <li
              key={step}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-[color,background-color,transform] duration-300 ${
                index === currentStep
                  ? "translate-x-1 bg-accent font-medium text-accent-foreground"
                  : index < currentStep
                    ? "text-foreground"
                    : "text-muted-foreground"
              }`}
            >
              <span
                className={`grid size-6 place-items-center rounded-full border text-xs transition-[color,background-color,border-color,transform] duration-300 ${
                  index <= currentStep
                    ? "scale-105 border-primary bg-primary text-primary-foreground"
                    : ""
                }`}
              >
                {index < currentStep ? (
                  <CheckCircle2Icon className="size-3.5" aria-hidden="true" />
                ) : (
                  index + 1
                )}
              </span>
              {step}
            </li>
          ))}
        </ol>
        <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
          <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
            <Clock3Icon className="size-4 text-primary" />
            Europe/Moscow
          </div>
          Новые заявки ожидают ручного подтверждения администратора.
        </div>
      </aside>
    </div>
  );
}

function SessionButton({
  icon: Icon,
  title,
  note,
  places,
  onClick,
}: {
  icon: typeof UserRoundIcon;
  title: string;
  note: string;
  places: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="group flex min-h-40 flex-col items-start rounded-xl border bg-background p-5 text-left transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-1 hover:border-primary hover:shadow-lg hover:shadow-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:translate-y-0 active:scale-[0.985]"
      onClick={onClick}
    >
      <span className="mb-5 grid size-11 place-items-center rounded-xl bg-secondary text-secondary-foreground transition-colors duration-300 group-hover:bg-accent">
        <Icon
          className="size-5 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3"
          aria-hidden="true"
        />
      </span>
      <span className="font-semibold">{title}</span>
      <span className="mt-1 text-sm text-muted-foreground">{note}</span>
      <span className="mt-auto pt-3">
        <Badge variant="secondary">{places}</Badge>
      </span>
    </button>
  );
}

function LoadingState() {
  return (
    <div className="grid min-h-48 place-items-center text-sm text-muted-foreground">
      <RefreshCwIcon className="mb-3 size-5 animate-spin" aria-hidden="true" />
      Загружаем расписание…
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="grid min-h-48 place-items-center rounded-xl border border-dashed p-6 text-center">
      <CalendarDaysIcon className="mb-3 size-7 text-muted-foreground" />
      <p className="mb-4 text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" onClick={onRetry}>
        Обновить
      </Button>
    </div>
  );
}

function BackButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <Button type="button" variant="ghost" onClick={onClick}>
      <ArrowLeftIcon data-icon="inline-start" />
      {label}
    </Button>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}

function moscowDayKey(isoDate: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DEFAULT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(isoDate));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function calendarDayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function calendarDateFromKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function formatDayKey(key: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(calendarDateFromKey(key));
}

function formatTime(isoDate: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: DEFAULT_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoDate));
}

function formatSlot(slot: { startsAt: string; endsAt: string }) {
  const date = new Intl.DateTimeFormat("ru-RU", {
    timeZone: DEFAULT_TIME_ZONE,
    day: "numeric",
    month: "long",
    weekday: "short",
  }).format(new Date(slot.startsAt));
  return `${date}, ${formatTime(slot.startsAt)}–${formatTime(slot.endsAt)}`;
}

function sessionTypeLabel(type: SessionType) {
  return type === "individual" ? "Индивидуальное" : "Групповое";
}

function placesLabel(value: number) {
  const mod10 = value % 10;
  const mod100 = value % 100;
  const noun =
    mod10 === 1 && mod100 !== 11
      ? "место"
      : [2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)
        ? "места"
        : "мест";
  return `${value} ${noun}`;
}
