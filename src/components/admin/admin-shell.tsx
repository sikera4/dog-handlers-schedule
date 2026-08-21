"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarPlusIcon,
  ExternalLinkIcon,
  LogOutIcon,
  MessageCircleIcon,
  PawPrintIcon,
  PhoneIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PRODUCT_NAME } from "@/config/product";
import { createGoogleCalendarUrl } from "@/lib/google-calendar";
import type {
  AdminBooking,
  AdminSlot,
  BookingStatus,
  SessionType,
  SlotStatus,
} from "@/server/data/types";

const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: "Новая",
  confirmed: "Подтверждена",
  cancelled: "Отменена",
  completed: "Завершена",
  no_show: "Не пришли",
};

const SLOT_STATUS_LABELS: Record<SlotStatus, string> = {
  open: "Открыт",
  closed: "Закрыт",
  cancelled: "Отменён",
};

export function AdminShell({
  bookings,
  slots,
  identity,
}: {
  bookings: AdminBooking[];
  slots: AdminSlot[];
  identity: string;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<BookingStatus | "all">("all");
  const [pendingId, setPendingId] = useState<string>();
  const [pendingSlotId, setPendingSlotId] = useState<string>();
  const visibleBookings = useMemo(
    () =>
      bookings.filter(
        (booking) => filter === "all" || booking.status === filter,
      ),
    [bookings, filter],
  );

  async function updateStatus(bookingId: string, status: BookingStatus) {
    setPendingId(bookingId);
    try {
      const response = await fetch(`/api/admin/bookings/${bookingId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const body = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(body.message);
      toast.success("Статус обновлён");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Не удалось обновить",
      );
    } finally {
      setPendingId(undefined);
    }
  }

  async function logout() {
    await fetch("/api/admin/session", { method: "DELETE" });
    window.location.reload();
  }

  async function deleteSlot(slot: AdminSlot) {
    const confirmed = window.confirm(
      `Удалить слот ${formatAdminSlotDate(slot.startsAt, slot.endsAt)}?\n\nЭто действие нельзя отменить.`,
    );
    if (!confirmed) return;

    setPendingSlotId(slot.id);
    try {
      const response = await fetch(`/api/admin/slots/${slot.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const body = (await response.json()) as { message?: string };
        throw new Error(body.message);
      }
      toast.success("Слот удалён");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Не удалось удалить слот",
      );
    } finally {
      setPendingSlotId(undefined);
    }
  }

  return (
    <main className="min-h-dvh bg-muted/35">
      <header className="border-b bg-background">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/admin" className="flex items-center gap-2 font-semibold">
            <PawPrintIcon className="size-5 text-primary" aria-hidden="true" />
            <span className="hidden sm:inline">{PRODUCT_NAME}</span>
            <Badge variant="secondary">Админ</Badge>
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground md:inline">
              {identity}
            </span>
            <Button asChild variant="outline" size="sm">
              <Link href="/">
                Форма записи
                <ExternalLinkIcon data-icon="inline-end" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Выйти"
              onClick={logout}
            >
              <LogOutIcon />
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-medium text-primary">
              Рабочее расписание
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Панель администратора
            </h1>
          </div>
          <label className="flex items-center gap-2 text-sm">
            Статус
            <select
              className="h-9 rounded-lg border bg-background px-3"
              value={filter}
              onChange={(event) =>
                setFilter(event.target.value as BookingStatus | "all")
              }
            >
              <option value="all">Все</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Ближайшие записи</CardTitle>
                <CardDescription>
                  {visibleBookings.length} {countLabel(visibleBookings.length)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {visibleBookings.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                    Записей с таким статусом пока нет.
                  </div>
                ) : (
                  visibleBookings.map((booking) => (
                    <BookingRow
                      key={booking.id}
                      booking={booking}
                      pending={pendingId === booking.id}
                      onStatusChange={updateStatus}
                    />
                  ))
                )}
              </CardContent>
            </Card>

            <SlotListCard
              slots={slots}
              pendingSlotId={pendingSlotId}
              onDelete={deleteSlot}
            />
          </div>

          <CreateSlotCard onCreated={() => router.refresh()} />
        </div>
      </section>
    </main>
  );
}

function SlotListCard({
  slots,
  pendingSlotId,
  onDelete,
}: {
  slots: AdminSlot[];
  pendingSlotId?: string;
  onDelete: (slot: AdminSlot) => Promise<void>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Созданные слоты</CardTitle>
        <CardDescription>
          Ближайшие слоты расписания. Слот с историей записей удалить нельзя.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {slots.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Будущих слотов пока нет.
          </div>
        ) : (
          slots.map((slot) => {
            const hasBookings = slot.bookingCount > 0;
            const pending = pendingSlotId === slot.id;

            return (
              <article
                key={slot.id}
                className="flex flex-col justify-between gap-4 rounded-xl border bg-background p-4 sm:flex-row sm:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">
                      {formatAdminSlotDate(slot.startsAt, slot.endsAt)}
                    </p>
                    <Badge variant="secondary">
                      {SLOT_STATUS_LABELS[slot.status]}
                    </Badge>
                    {hasBookings ? (
                      <Badge variant="outline">
                        Записей: {slot.bookingCount}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {slot.sessionType === "individual"
                      ? "Индивидуальное"
                      : `Групповое · мест: ${slot.capacity}`}
                    {slot.location ? ` · ${slot.location}` : ""}
                  </p>
                  {hasBookings ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Для этого слота уже есть история записей, поэтому удалить
                      его нельзя.
                    </p>
                  ) : null}
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={pending || hasBookings}
                  aria-label={`Удалить слот ${formatAdminSlotDate(slot.startsAt, slot.endsAt)}`}
                  onClick={() => onDelete(slot)}
                >
                  <Trash2Icon data-icon="inline-start" />
                  {pending ? "Удаляем…" : "Удалить"}
                </Button>
              </article>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

function BookingRow({
  booking,
  pending,
  onStatusChange,
}: {
  booking: AdminBooking;
  pending: boolean;
  onStatusChange: (id: string, status: BookingStatus) => Promise<void>;
}) {
  return (
    <article className="rounded-xl border bg-background p-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{booking.dogName}</p>
            {booking.clientName ? (
              <span className="text-sm text-muted-foreground">
                · {booking.clientName}
              </span>
            ) : null}
            <StatusBadge status={booking.status} />
          </div>
          <p className="mt-1 text-sm">
            {formatAdminDate(booking.startsAt)} ·{" "}
            {booking.sessionType === "individual"
              ? "индивидуальное"
              : "групповое"}
          </p>
        </div>
        <div className="flex gap-2">
          {booking.telegramUsername ? (
            <Button
              asChild
              variant="outline"
              size="icon"
              aria-label="Написать в Telegram"
            >
              <a
                href={`https://t.me/${booking.telegramUsername}`}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircleIcon />
              </a>
            </Button>
          ) : null}
          {booking.phone ? (
            <Button
              asChild
              variant="outline"
              size="icon"
              aria-label="Позвонить"
            >
              <a href={`tel:${booking.phone}`}>
                <PhoneIcon />
              </a>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {booking.status !== "confirmed" ? (
          <Button
            size="sm"
            disabled={pending}
            onClick={() => onStatusChange(booking.id, "confirmed")}
          >
            Подтвердить
          </Button>
        ) : null}
        {booking.status === "confirmed" ? (
          <>
            <Button asChild size="sm" variant="outline">
              <a
                href={createGoogleCalendarUrl(booking)}
                target="_blank"
                rel="noreferrer"
              >
                <CalendarPlusIcon data-icon="inline-start" />В Google Календарь
              </a>
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() => onStatusChange(booking.id, "completed")}
            >
              Завершить
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => onStatusChange(booking.id, "no_show")}
            >
              Не пришли
            </Button>
          </>
        ) : null}
        {booking.status !== "cancelled" ? (
          <Button
            size="sm"
            variant="destructive"
            disabled={pending}
            onClick={() => onStatusChange(booking.id, "cancelled")}
          >
            Отменить
          </Button>
        ) : null}
      </div>
    </article>
  );
}

function CreateSlotCard({ onCreated }: { onCreated: () => void }) {
  const [pending, setPending] = useState(false);
  const [sessionType, setSessionType] = useState<SessionType>("individual");
  const [startsAt, setStartsAt] = useState("");
  const [duration, setDuration] = useState(60);
  const [capacity, setCapacity] = useState(6);
  const [repeatWeeks, setRepeatWeeks] = useState(1);
  const [location, setLocation] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const isoStart = moscowInputToIso(startsAt);
    if (!isoStart) {
      toast.error("Укажите корректные дату и время");
      return;
    }

    setPending(true);
    try {
      const response = await fetch("/api/admin/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionType,
          startsAt: isoStart,
          durationMinutes: duration,
          capacity: sessionType === "individual" ? 1 : capacity,
          repeatWeeks,
          location: location || undefined,
        }),
      });
      const body = (await response.json()) as {
        created?: number;
        message?: string;
      };
      if (!response.ok) throw new Error(body.message);
      toast.success(`Создано занятий: ${body.created}`);
      setStartsAt("");
      onCreated();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Не удалось создать",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="h-fit xl:sticky xl:top-6">
      <CardHeader>
        <CalendarPlusIcon className="size-5 text-primary" />
        <CardTitle>Добавить занятия</CardTitle>
        <CardDescription>
          Дата и время вводятся по Москве. Можно повторить слот раз в неделю.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={submit}>
          <AdminField id="sessionType" label="Формат">
            <select
              id="sessionType"
              className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
              value={sessionType}
              onChange={(event) =>
                setSessionType(event.target.value as SessionType)
              }
            >
              <option value="individual">Индивидуальное</option>
              <option value="group">Групповое</option>
            </select>
          </AdminField>
          <AdminField id="startsAt" label="Начало">
            <Input
              id="startsAt"
              type="datetime-local"
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
              required
            />
          </AdminField>
          <div className="grid grid-cols-2 gap-3">
            <AdminField id="duration" label="Минут">
              <Input
                id="duration"
                type="number"
                min={30}
                max={480}
                value={duration}
                onChange={(event) => setDuration(Number(event.target.value))}
              />
            </AdminField>
            <AdminField id="repeatWeeks" label="Недель">
              <Input
                id="repeatWeeks"
                type="number"
                min={1}
                max={12}
                value={repeatWeeks}
                onChange={(event) => setRepeatWeeks(Number(event.target.value))}
              />
            </AdminField>
          </div>
          {sessionType === "group" ? (
            <AdminField id="capacity" label="Вместимость">
              <Input
                id="capacity"
                type="number"
                min={1}
                max={100}
                value={capacity}
                onChange={(event) => setCapacity(Number(event.target.value))}
              />
            </AdminField>
          ) : null}
          <AdminField id="location" label="Место">
            <Input
              id="location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Площадка у парка"
            />
          </AdminField>
          <Button className="h-11 w-full" disabled={pending}>
            {pending ? "Создаём…" : "Создать"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function AdminField({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: BookingStatus }) {
  const variant =
    status === "cancelled"
      ? "destructive"
      : status === "confirmed"
        ? "default"
        : "secondary";
  return <Badge variant={variant}>{STATUS_LABELS[status]}</Badge>;
}

function formatAdminDate(isoDate: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoDate));
}

function formatAdminSlotDate(startsAt: string, endsAt: string) {
  const endTime = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(endsAt));

  return `${formatAdminDate(startsAt)}–${endTime}`;
}

function moscowInputToIso(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  return new Date(
    Date.UTC(year, month - 1, day, hour - 3, minute),
  ).toISOString();
}

function countLabel(value: number) {
  return value === 1
    ? "запись"
    : value >= 2 && value <= 4
      ? "записи"
      : "записей";
}
