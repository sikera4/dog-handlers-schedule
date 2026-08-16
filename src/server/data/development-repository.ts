import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  AdminBooking,
  AdminRepository,
  AvailabilitySlot,
  BookingConfirmation,
  BookingRepository,
  BookingRequest,
  BookingStatus,
  CreateSlotsRequest,
  SessionType,
  SlotStatus,
} from "@/server/data/types";
import { RepositoryError } from "@/server/data/types";

type DevelopmentHandler = {
  id: string;
  name: string;
  active: boolean;
};

type DevelopmentSlot = {
  id: string;
  handlerId: string;
  sessionType: SessionType;
  startsAt: string;
  endsAt: string;
  capacity: number;
  status: SlotStatus;
  location?: string;
  publicNotes?: string;
};

type DevelopmentBooking = {
  id: string;
  slotId: string;
  telegramUsername?: string;
  telegramUserId?: number;
  phone?: string;
  clientName?: string;
  dogName: string;
  status: BookingStatus;
  adminNotes?: string;
  createdAt: string;
};

type DevelopmentEvent = {
  id: string;
  bookingId: string;
  eventType: "created" | "status_changed";
  fromStatus?: BookingStatus;
  toStatus: BookingStatus;
  createdAt: string;
};

export type DevelopmentData = {
  handlers: DevelopmentHandler[];
  slots: DevelopmentSlot[];
  bookings: DevelopmentBooking[];
  events: DevelopmentEvent[];
};

export class DevelopmentRepository
  implements BookingRepository, AdminRepository
{
  private mutationQueue: Promise<unknown> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  async listAvailability(input: {
    from: string;
    to: string;
    sessionType?: SessionType;
  }): Promise<AvailabilitySlot[]> {
    const data = await this.readData();
    const from = Date.parse(input.from);
    const to = Date.parse(input.to);

    return data.slots
      .filter((slot) => {
        const startsAt = Date.parse(slot.startsAt);
        const activeBookings = data.bookings.filter(
          (booking) =>
            booking.slotId === slot.id && booking.status !== "cancelled",
        ).length;

        return (
          slot.status === "open" &&
          startsAt >= Math.max(from, Date.now()) &&
          startsAt < to &&
          (!input.sessionType || slot.sessionType === input.sessionType) &&
          activeBookings < slot.capacity
        );
      })
      .sort((left, right) => left.startsAt.localeCompare(right.startsAt))
      .map((slot) => ({
        id: slot.id,
        sessionType: slot.sessionType,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        remainingCapacity:
          slot.capacity -
          data.bookings.filter(
            (booking) =>
              booking.slotId === slot.id && booking.status !== "cancelled",
          ).length,
      }));
  }

  async createBooking(input: BookingRequest): Promise<BookingConfirmation> {
    return this.withMutation(async () => {
      const data = await this.readData();
      const slot = data.slots.find(
        (candidate) => candidate.id === input.slotId,
      );

      if (!slot) throw new RepositoryError("SLOT_NOT_FOUND");
      if (slot.status !== "open") throw new RepositoryError("SLOT_NOT_OPEN");
      if (Date.parse(slot.startsAt) <= Date.now()) {
        throw new RepositoryError("SLOT_IN_PAST");
      }

      const activeBookings = data.bookings.filter(
        (booking) =>
          booking.slotId === slot.id && booking.status !== "cancelled",
      ).length;
      if (activeBookings >= slot.capacity) {
        throw new RepositoryError("SLOT_FULL");
      }

      const booking: DevelopmentBooking = {
        id: randomUUID(),
        slotId: slot.id,
        telegramUsername: input.telegramUsername,
        telegramUserId: input.telegramUserId,
        phone: input.phone,
        clientName: input.clientName,
        dogName: input.dogName,
        status: "pending",
        createdAt: new Date().toISOString(),
      };
      data.bookings.push(booking);
      data.events.push({
        id: randomUUID(),
        bookingId: booking.id,
        eventType: "created",
        toStatus: "pending",
        createdAt: booking.createdAt,
      });
      await this.writeData(data);

      return {
        id: booking.id,
        status: booking.status,
        sessionType: slot.sessionType,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
      };
    });
  }

  async listBookings(): Promise<AdminBooking[]> {
    const data = await this.readData();

    return data.bookings
      .flatMap<AdminBooking>((booking) => {
        const slot = data.slots.find(
          (candidate) => candidate.id === booking.slotId,
        );
        if (!slot) return [];

        return [
          {
            id: booking.id,
            slotId: slot.id,
            sessionType: slot.sessionType,
            startsAt: slot.startsAt,
            endsAt: slot.endsAt,
            location: slot.location,
            telegramUsername: booking.telegramUsername,
            phone: booking.phone,
            clientName: booking.clientName,
            dogName: booking.dogName,
            status: booking.status,
            adminNotes: booking.adminNotes,
            createdAt: booking.createdAt,
          },
        ];
      })
      .sort((left, right) => left.startsAt.localeCompare(right.startsAt));
  }

  async updateBookingStatus(
    bookingId: string,
    status: BookingStatus,
  ): Promise<void> {
    await this.withMutation(async () => {
      const data = await this.readData();
      const booking = data.bookings.find(
        (candidate) => candidate.id === bookingId,
      );
      if (!booking)
        throw new RepositoryError("SLOT_NOT_FOUND", "BOOKING_NOT_FOUND");

      const previousStatus = booking.status;
      booking.status = status;
      data.events.push({
        id: randomUUID(),
        bookingId,
        eventType: "status_changed",
        fromStatus: previousStatus,
        toStatus: status,
        createdAt: new Date().toISOString(),
      });
      await this.writeData(data);
    });
  }

  async createSlots(input: CreateSlotsRequest): Promise<number> {
    return this.withMutation(async () => {
      const data = await this.readData();
      const handler = data.handlers.find((candidate) => candidate.active);
      if (!handler)
        throw new RepositoryError("NOT_CONFIGURED", "NO_ACTIVE_HANDLER");

      const initialStart = new Date(input.startsAt);
      const createdSlots: DevelopmentSlot[] = [];

      for (let week = 0; week < input.repeatWeeks; week += 1) {
        const startsAt = new Date(initialStart);
        startsAt.setUTCDate(startsAt.getUTCDate() + week * 7);
        const endsAt = new Date(
          startsAt.getTime() + input.durationMinutes * 60_000,
        );

        const overlaps = data.slots.some(
          (slot) =>
            slot.handlerId === handler.id &&
            slot.status === "open" &&
            Date.parse(slot.startsAt) < endsAt.getTime() &&
            Date.parse(slot.endsAt) > startsAt.getTime(),
        );
        if (overlaps) throw new RepositoryError("CONFLICT", "SLOT_OVERLAP");

        createdSlots.push({
          id: randomUUID(),
          handlerId: handler.id,
          sessionType: input.sessionType,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          capacity: input.sessionType === "individual" ? 1 : input.capacity,
          status: "open",
          location: input.location,
          publicNotes: input.publicNotes,
        });
      }

      data.slots.push(...createdSlots);
      await this.writeData(data);
      return createdSlots.length;
    });
  }

  private async withMutation<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.mutationQueue.then(operation, operation);
    this.mutationQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private async readData(): Promise<DevelopmentData> {
    try {
      const source = await readFile(this.filePath, "utf8");
      const data = JSON.parse(source) as DevelopmentData;
      if (!data.slots.some((slot) => Date.parse(slot.startsAt) > Date.now())) {
        const refreshed = createSeedData();
        refreshed.bookings = data.bookings;
        refreshed.events = data.events;
        await this.writeData(refreshed);
        return refreshed;
      }
      return data;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const data = createSeedData();
      await this.writeData(data);
      return data;
    }
  }

  private async writeData(data: DevelopmentData) {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(data, null, 2), "utf8");
    await rename(temporaryPath, this.filePath);
  }
}

function createSeedData(): DevelopmentData {
  const handlerId = "00000000-0000-4000-8000-000000000001";
  const slots: DevelopmentSlot[] = [];
  const moscowNow = new Date(Date.now() + 3 * 60 * 60 * 1000);

  for (let offset = 1; offset <= 35; offset += 1) {
    const day = new Date(moscowNow);
    day.setUTCDate(day.getUTCDate() + offset);
    const isoWeekday = day.getUTCDay() === 0 ? 7 : day.getUTCDay();
    if (![2, 4, 6].includes(isoWeekday)) continue;

    for (const hour of [10, 12, 18]) {
      const startsAt = new Date(
        Date.UTC(
          day.getUTCFullYear(),
          day.getUTCMonth(),
          day.getUTCDate(),
          hour - 3,
        ),
      );
      const sessionType: SessionType = hour === 12 ? "group" : "individual";
      slots.push({
        id: randomUUID(),
        handlerId,
        sessionType,
        startsAt: startsAt.toISOString(),
        endsAt: new Date(startsAt.getTime() + 60 * 60 * 1000).toISOString(),
        capacity: sessionType === "group" ? 6 : 1,
        status: "open",
        location: "Площадка у парка",
      });
    }
  }

  return {
    handlers: [{ id: handlerId, name: "Анна, кинолог", active: true }],
    slots,
    bookings: [],
    events: [],
  };
}
