import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  AdminBooking,
  AdminRepository,
  AdminSlot,
  AvailabilitySlot,
  BookingConfirmation,
  BookingRepository,
  BookingRequest,
  BookingStatus,
  CreateSlotsRequest,
  SessionType,
} from "@/server/data/types";
import { RepositoryError } from "@/server/data/types";

type AvailabilityRow = {
  slot_id: string;
  session_type: SessionType;
  starts_at: string;
  ends_at: string;
  remaining_capacity: number;
};

type ConfirmationRow = {
  booking_id: string;
  booking_status: BookingStatus;
  slot_session_type: SessionType;
  slot_starts_at: string;
  slot_ends_at: string;
};

export class SupabasePublicRepository implements BookingRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listAvailability(input: {
    from: string;
    to: string;
    sessionType?: SessionType;
  }): Promise<AvailabilitySlot[]> {
    const { data, error } = await this.client.rpc("get_public_availability", {
      p_from: input.from,
      p_to: input.to,
      p_session_type: input.sessionType ?? null,
    });
    if (error) throw mapSupabaseError(error.message);

    return ((data ?? []) as AvailabilityRow[]).map((row) => ({
      id: row.slot_id,
      sessionType: row.session_type,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      remainingCapacity: row.remaining_capacity,
    }));
  }

  async createBooking(input: BookingRequest): Promise<BookingConfirmation> {
    const { data, error } = await this.client.rpc("create_public_booking", {
      p_slot_id: input.slotId,
      p_telegram_username: input.telegramUsername ?? null,
      p_telegram_user_id: input.telegramUserId ?? null,
      p_phone: input.phone ?? null,
      p_client_name: input.clientName ?? null,
      p_dog_name: input.dogName,
    });
    if (error) throw mapSupabaseError(error.message);

    const row = (data as ConfirmationRow[] | null)?.[0];
    if (!row) throw new RepositoryError("UNKNOWN", "EMPTY_BOOKING_RESPONSE");

    return {
      id: row.booking_id,
      status: row.booking_status,
      sessionType: row.slot_session_type,
      startsAt: row.slot_starts_at,
      endsAt: row.slot_ends_at,
    };
  }
}

export class SupabaseAdminRepository implements AdminRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listBookings(): Promise<AdminBooking[]> {
    const { data, error } = await this.client
      .from("bookings")
      .select(
        "id, slot_id, telegram_username, phone, client_name, dog_name, status, admin_notes, created_at, session_slots!inner(session_type, starts_at, ends_at, location)",
      )
      .order("created_at", { ascending: false });
    if (error) throw mapSupabaseError(error.message);

    type Row = {
      id: string;
      slot_id: string;
      telegram_username: string | null;
      phone: string | null;
      client_name: string | null;
      dog_name: string;
      status: BookingStatus;
      admin_notes: string | null;
      created_at: string;
      session_slots: {
        session_type: SessionType;
        starts_at: string;
        ends_at: string;
        location: string | null;
      };
    };

    return ((data ?? []) as unknown as Row[]).map((row) => ({
      id: row.id,
      slotId: row.slot_id,
      sessionType: row.session_slots.session_type,
      startsAt: row.session_slots.starts_at,
      endsAt: row.session_slots.ends_at,
      location: row.session_slots.location ?? undefined,
      telegramUsername: row.telegram_username ?? undefined,
      phone: row.phone ?? undefined,
      clientName: row.client_name ?? undefined,
      dogName: row.dog_name,
      status: row.status,
      adminNotes: row.admin_notes ?? undefined,
      createdAt: row.created_at,
    }));
  }

  async listSlots(): Promise<AdminSlot[]> {
    const { data, error } = await this.client
      .from("session_slots")
      .select(
        "id, session_type, starts_at, ends_at, capacity, status, location, public_notes, bookings(count)",
      )
      .gte("ends_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(100);
    if (error) throw mapSupabaseError(error.message);

    type Row = {
      id: string;
      session_type: SessionType;
      starts_at: string;
      ends_at: string;
      capacity: number;
      status: AdminSlot["status"];
      location: string | null;
      public_notes: string | null;
      bookings: { count: number }[];
    };

    return ((data ?? []) as unknown as Row[]).map((row) => ({
      id: row.id,
      sessionType: row.session_type,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      capacity: row.capacity,
      status: row.status,
      location: row.location ?? undefined,
      publicNotes: row.public_notes ?? undefined,
      bookingCount: row.bookings[0]?.count ?? 0,
    }));
  }

  async updateBookingStatus(
    bookingId: string,
    status: BookingStatus,
  ): Promise<void> {
    const { error } = await this.client
      .from("bookings")
      .update({ status })
      .eq("id", bookingId);
    if (error) throw mapSupabaseError(error.message);
  }

  async createSlots(input: CreateSlotsRequest): Promise<number> {
    const { data: handler, error: handlerError } = await this.client
      .from("handlers")
      .select("id")
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    if (handlerError) throw mapSupabaseError(handlerError.message);
    if (!handler)
      throw new RepositoryError("NOT_CONFIGURED", "NO_ACTIVE_HANDLER");

    const initialStart = new Date(input.startsAt);
    const rows = Array.from({ length: input.repeatWeeks }, (_, week) => {
      const startsAt = new Date(initialStart);
      startsAt.setUTCDate(startsAt.getUTCDate() + week * 7);
      const endsAt = new Date(
        startsAt.getTime() + input.durationMinutes * 60_000,
      );

      return {
        handler_id: handler.id,
        session_type: input.sessionType,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        capacity: input.sessionType === "individual" ? 1 : input.capacity,
        location: input.location ?? null,
        public_notes: input.publicNotes ?? null,
      };
    });

    const { error } = await this.client.from("session_slots").insert(rows);
    if (error) throw mapSupabaseError(error.message);
    return rows.length;
  }

  async deleteSlot(slotId: string): Promise<void> {
    const { error } = await this.client.rpc("delete_session_slot", {
      p_slot_id: slotId,
    });
    if (error) throw mapSupabaseError(error.message);
  }
}

function mapSupabaseError(message: string) {
  const knownCodes = [
    "SLOT_NOT_FOUND",
    "SLOT_NOT_OPEN",
    "SLOT_IN_PAST",
    "SLOT_FULL",
    "SLOT_HAS_ACTIVE_BOOKINGS",
  ] as const;
  const code = knownCodes.find((candidate) => message.includes(candidate));
  if (code) return new RepositoryError(code, message);
  if (message.includes("session_slots_no_open_overlap")) {
    return new RepositoryError("CONFLICT", message);
  }
  return new RepositoryError("UNKNOWN", message);
}
