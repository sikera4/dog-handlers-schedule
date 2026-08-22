export const SESSION_TYPES = ["individual", "group"] as const;
export type SessionType = (typeof SESSION_TYPES)[number];

export const BOOKING_STATUSES = [
  "pending",
  "confirmed",
  "cancelled",
  "completed",
  "no_show",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export type SlotStatus = "open" | "closed" | "cancelled";

export type AvailabilitySlot = {
  id: string;
  sessionType: SessionType;
  startsAt: string;
  endsAt: string;
  remainingCapacity: number;
};

export type BookingRequest = {
  slotId: string;
  telegramUsername?: string;
  telegramUserId?: number;
  phone?: string;
  clientName?: string;
  dogName: string;
};

export type BookingConfirmation = {
  id: string;
  status: BookingStatus;
  sessionType: SessionType;
  startsAt: string;
  endsAt: string;
};

export type AdminBooking = {
  id: string;
  slotId: string;
  sessionType: SessionType;
  startsAt: string;
  endsAt: string;
  location?: string;
  telegramUsername?: string;
  phone?: string;
  clientName?: string;
  dogName: string;
  status: BookingStatus;
  adminNotes?: string;
  createdAt: string;
};

export type AdminSlot = {
  id: string;
  sessionType: SessionType;
  startsAt: string;
  endsAt: string;
  capacity: number;
  status: SlotStatus;
  location?: string;
  publicNotes?: string;
  bookingCount: number;
};

export type CreateSlotsRequest = {
  sessionType: SessionType;
  startsAt: string;
  durationMinutes: number;
  capacity: number;
  repeatWeeks: number;
  location?: string;
  publicNotes?: string;
};

export type BookingRepository = {
  listAvailability(input: {
    from: string;
    to: string;
    sessionType?: SessionType;
  }): Promise<AvailabilitySlot[]>;
  createBooking(input: BookingRequest): Promise<BookingConfirmation>;
};

export type AdminRepository = {
  listBookings(): Promise<AdminBooking[]>;
  listSlots(): Promise<AdminSlot[]>;
  updateBookingStatus(bookingId: string, status: BookingStatus): Promise<void>;
  createSlots(input: CreateSlotsRequest): Promise<number>;
  deleteSlot(slotId: string): Promise<void>;
};

export class RepositoryError extends Error {
  constructor(
    public readonly code:
      | "SLOT_NOT_FOUND"
      | "SLOT_NOT_OPEN"
      | "SLOT_IN_PAST"
      | "SLOT_FULL"
      | "SLOT_HAS_BOOKINGS"
      | "CONFLICT"
      | "NOT_CONFIGURED"
      | "UNKNOWN",
    message: string = code,
  ) {
    super(message);
    this.name = "RepositoryError";
  }
}

export function isRepositoryError(error: unknown): error is RepositoryError {
  return (
    error instanceof Error &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  );
}
