import { z } from "zod";

export const CONTACT_REQUIRED_MESSAGE = "Укажите Telegram или телефон";

export function normalizeTelegramUsername(value: string) {
  return value.trim().replace(/^@+/, "").toLowerCase();
}

export function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");

  if (digits.length === 10) return `+7${digits}`;
  if (digits.length === 11 && digits.startsWith("8")) {
    return `+7${digits.slice(1)}`;
  }

  return digits.length > 0 ? `+${digits}` : "";
}

const optionalTelegram = z
  .string()
  .optional()
  .transform((value) =>
    !value || value.trim().length === 0
      ? undefined
      : normalizeTelegramUsername(value),
  )
  .pipe(
    z
      .string()
      .regex(/^[a-z][a-z0-9_]{4,31}$/, "Укажите корректный username без ссылки")
      .optional(),
  );

const optionalPhone = z
  .string()
  .optional()
  .transform((value) =>
    !value || value.trim().length === 0 ? undefined : normalizePhone(value),
  )
  .pipe(
    z
      .string()
      .regex(/^\+[1-9]\d{9,14}$/, "Укажите телефон в международном формате")
      .optional(),
  );

const bookingDetailsFields = {
  telegramUsername: optionalTelegram,
  phone: optionalPhone,
  clientName: z
    .string()
    .optional()
    .transform((value) => {
      const trimmed = value?.trim() ?? "";
      return trimmed.length === 0 ? undefined : trimmed;
    })
    .pipe(z.string().max(100, "Не больше 100 символов").optional()),
  dogName: z
    .string()
    .trim()
    .min(1, "Укажите имя собаки")
    .max(100, "Не больше 100 символов"),
};

function requireContact(
  data: { telegramUsername?: string; phone?: string },
  context: z.core.$RefinementCtx,
) {
  if (!data.telegramUsername && !data.phone) {
    context.addIssue({
      code: "custom",
      message: CONTACT_REQUIRED_MESSAGE,
      path: ["telegramUsername"],
    });
  }
}

export const bookingDetailsSchema = z
  .object(bookingDetailsFields)
  .superRefine(requireContact);

export const bookingSubmissionSchema = z
  .object({
    slotId: z.uuid("Выберите время занятия"),
    ...bookingDetailsFields,
  })
  .superRefine(requireContact);

export type BookingDetailsInput = z.input<typeof bookingDetailsSchema>;
export type BookingDetails = z.output<typeof bookingDetailsSchema>;
export type BookingSubmissionInput = z.input<typeof bookingSubmissionSchema>;
