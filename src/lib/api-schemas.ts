import { z } from "zod";

import { BOOKING_STATUSES, SESSION_TYPES } from "@/server/data/types";

export const availabilityQuerySchema = z
  .object({
    from: z.iso.datetime({ offset: true }),
    to: z.iso.datetime({ offset: true }),
    sessionType: z.enum(SESSION_TYPES).optional(),
  })
  .refine((value) => Date.parse(value.to) > Date.parse(value.from), {
    message: "Некорректный диапазон дат",
  });

export const adminStatusSchema = z.object({
  status: z.enum(BOOKING_STATUSES),
});

export const createSlotsSchema = z
  .object({
    sessionType: z.enum(SESSION_TYPES),
    startsAt: z.iso.datetime({ offset: true }),
    durationMinutes: z.number().int().min(30).max(480),
    capacity: z.number().int().min(1).max(100),
    repeatWeeks: z.number().int().min(1).max(12),
    location: z.string().trim().max(300).optional(),
    publicNotes: z.string().trim().max(500).optional(),
  })
  .refine((value) => Date.parse(value.startsAt) > Date.now(), {
    message: "Занятие должно начинаться в будущем",
    path: ["startsAt"],
  });
