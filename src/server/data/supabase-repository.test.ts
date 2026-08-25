import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { SupabaseAdminRepository } from "@/server/data/supabase-repository";
import { RepositoryError } from "@/server/data/types";

const slotId = "00000000-0000-4000-8000-000000000123";

function createClient(query: object, rpc = vi.fn()) {
  return {
    from: vi.fn().mockReturnValue(query),
    rpc,
  } as unknown as SupabaseClient;
}

describe("Supabase admin repository", () => {
  it("maps the nested booking count for upcoming slots", async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            id: slotId,
            session_type: "group",
            starts_at: "2026-09-01T15:00:00.000Z",
            ends_at: "2026-09-01T16:00:00.000Z",
            capacity: 6,
            status: "open",
            location: "Площадка",
            public_notes: null,
            bookings: [{ count: 2 }],
          },
        ],
        error: null,
      }),
    };
    const repository = new SupabaseAdminRepository(createClient(query));

    await expect(repository.listSlots()).resolves.toEqual([
      {
        id: slotId,
        sessionType: "group",
        startsAt: "2026-09-01T15:00:00.000Z",
        endsAt: "2026-09-01T16:00:00.000Z",
        capacity: 6,
        status: "open",
        location: "Площадка",
        publicNotes: undefined,
        bookingCount: 2,
      },
    ]);
  });

  it("deletes a slot through the atomic database function", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const repository = new SupabaseAdminRepository(createClient({}, rpc));

    await expect(repository.deleteSlot(slotId)).resolves.toBeUndefined();
    expect(rpc).toHaveBeenCalledWith("delete_session_slot", {
      p_slot_id: slotId,
    });
  });

  it("maps the active-booking database error", async () => {
    const rpc = vi.fn().mockResolvedValue({
      error: {
        code: "P0001",
        message: "SLOT_HAS_ACTIVE_BOOKINGS",
      },
    });
    const repository = new SupabaseAdminRepository(createClient({}, rpc));

    await expect(repository.deleteSlot(slotId)).rejects.toEqual(
      expect.objectContaining<Partial<RepositoryError>>({
        code: "SLOT_HAS_ACTIVE_BOOKINGS",
      }),
    );
  });
});
