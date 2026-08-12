import { describe, expect, it } from "vitest";

import {
  bookingDetailsSchema,
  bookingSubmissionSchema,
  normalizePhone,
  normalizeTelegramUsername,
} from "@/lib/booking-schema";

const SLOT_ID = "7ea0ac83-c553-499a-a5f6-8b24711619c7";

describe("booking details", () => {
  it("requires at least one contact method", () => {
    const result = bookingDetailsSchema.safeParse({
      telegramUsername: "",
      phone: "",
      clientName: "Анна",
      dogName: "Бублик",
    });

    expect(result.success).toBe(false);
  });

  it.each([
    {
      name: "phone only",
      input: { telegramUsername: "", phone: "8 (999) 123-45-67" },
      expected: { phone: "+79991234567" },
    },
    {
      name: "Telegram only",
      input: { telegramUsername: "@dog_owner", phone: "" },
      expected: { telegramUsername: "dog_owner" },
    },
    {
      name: "both contacts",
      input: {
        telegramUsername: "@dog_owner",
        phone: "8 (999) 123-45-67",
      },
      expected: {
        telegramUsername: "dog_owner",
        phone: "+79991234567",
      },
    },
  ])("accepts $name", ({ input, expected }) => {
    expect(
      bookingDetailsSchema.parse({
        ...input,
        clientName: "",
        dogName: "Бублик",
      }),
    ).toEqual({ ...expected, dogName: "Бублик" });
  });

  it("normalizes Russian phone numbers and Telegram usernames", () => {
    const result = bookingDetailsSchema.parse({
      telegramUsername: " @Dog_Owner ",
      phone: "8 (999) 123-45-67",
      clientName: " Анна ",
      dogName: " Бублик ",
    });

    expect(result).toEqual({
      telegramUsername: "dog_owner",
      phone: "+79991234567",
      clientName: "Анна",
      dogName: "Бублик",
    });
  });

  it("exposes normalization helpers for future server validation", () => {
    expect(normalizePhone("999 123-45-67")).toBe("+79991234567");
    expect(normalizeTelegramUsername("@@DOG_OWNER")).toBe("dog_owner");
  });
});

describe("booking submission", () => {
  it.each([
    {
      name: "phone only with omitted Telegram and client name",
      payload: {
        slotId: SLOT_ID,
        phone: "+79117370642",
        dogName: "Бублик",
      },
      expectedContacts: { phone: "+79117370642" },
    },
    {
      name: "Telegram only with omitted phone",
      payload: {
        slotId: SLOT_ID,
        telegramUsername: "@dog_owner",
        dogName: "Бублик",
      },
      expectedContacts: { telegramUsername: "dog_owner" },
    },
    {
      name: "both contacts",
      payload: {
        slotId: SLOT_ID,
        telegramUsername: "@dog_owner",
        phone: "8 (999) 123-45-67",
        clientName: " Анна ",
        dogName: "Бублик",
      },
      expectedContacts: {
        telegramUsername: "dog_owner",
        phone: "+79991234567",
        clientName: "Анна",
      },
    },
  ])("accepts $name", ({ payload, expectedContacts }) => {
    expect(bookingSubmissionSchema.parse(payload)).toEqual({
      slotId: SLOT_ID,
      ...expectedContacts,
      dogName: "Бублик",
    });
  });

  it("rejects a payload with neither contact", () => {
    const result = bookingSubmissionSchema.safeParse({
      slotId: SLOT_ID,
      dogName: "Бублик",
    });

    expect(result.success).toBe(false);
  });
});
