import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { DevelopmentRepository } from "@/server/data/development-repository";
import { RepositoryError } from "@/server/data/types";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function createRepository() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "dog-handler-test-"));
  temporaryDirectories.push(directory);
  return new DevelopmentRepository(path.join(directory, "data.json"));
}

describe("development booking repository", () => {
  it("atomically rejects the second booking for the last individual place", async () => {
    const repository = await createRepository();
    const slots = await repository.listAvailability({
      from: new Date().toISOString(),
      to: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
      sessionType: "individual",
    });
    const slot = slots[0];
    expect(slot).toBeDefined();

    const create = (dogName: string) =>
      repository.createBooking({
        slotId: slot.id,
        phone: "+79991234567",
        dogName,
      });
    const results = await Promise.allSettled([create("Рекс"), create("Лада")]);

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const rejection = results.find((result) => result.status === "rejected");
    expect(rejection).toMatchObject({
      reason: expect.objectContaining({ code: "SLOT_FULL" }),
    });
  });

  it("releases capacity after an administrator cancels a booking", async () => {
    const repository = await createRepository();
    const [slot] = await repository.listAvailability({
      from: new Date().toISOString(),
      to: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
      sessionType: "individual",
    });
    const first = await repository.createBooking({
      slotId: slot.id,
      phone: "+79991234567",
      dogName: "Рекс",
    });

    await repository.updateBookingStatus(first.id, "cancelled");
    const second = await repository.createBooking({
      slotId: slot.id,
      telegramUsername: "dog_owner",
      dogName: "Лада",
    });

    expect(second.status).toBe("pending");
  });

  it("rejects overlapping slots for the same handler", async () => {
    const repository = await createRepository();
    const [slot] = await repository.listAvailability({
      from: new Date().toISOString(),
      to: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
    });

    await expect(
      repository.createSlots({
        sessionType: "group",
        startsAt: slot.startsAt,
        durationMinutes: 60,
        capacity: 6,
        repeatWeeks: 1,
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<RepositoryError>>({ code: "CONFLICT" }),
    );
  });
});
