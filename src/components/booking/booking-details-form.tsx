"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRightIcon } from "lucide-react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  bookingDetailsSchema,
  CONTACT_REQUIRED_MESSAGE,
  type BookingDetails,
  type BookingDetailsInput,
} from "@/lib/booking-schema";

const EMPTY_VALUES: BookingDetailsInput = {
  telegramUsername: "",
  phone: "",
  clientName: "",
  dogName: "",
};

export function BookingDetailsForm({
  initialValues,
  onContinue,
}: {
  initialValues?: BookingDetails;
  onContinue: (details: BookingDetails) => void | Promise<void>;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<BookingDetailsInput, unknown, BookingDetails>({
    resolver: zodResolver(bookingDetailsSchema),
    defaultValues: initialValues
      ? {
          telegramUsername: initialValues.telegramUsername ?? "",
          phone: initialValues.phone ?? "",
          clientName: initialValues.clientName ?? "",
          dogName: initialValues.dogName,
        }
      : EMPTY_VALUES,
  });
  const telegramError = errors.telegramUsername?.message;
  const contactError =
    telegramError === CONTACT_REQUIRED_MESSAGE ? telegramError : undefined;
  const telegramFormatError = contactError ? undefined : telegramError;

  return (
    <form className="space-y-5" noValidate onSubmit={handleSubmit(onContinue)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="clientName"
          label="Ваше имя"
          error={errors.clientName?.message}
        >
          <Input
            id="clientName"
            autoComplete="name"
            placeholder="Анна"
            aria-invalid={Boolean(errors.clientName)}
            aria-describedby={
              errors.clientName ? "clientName-error" : undefined
            }
            {...register("clientName")}
          />
        </FormField>

        <FormField
          id="dogName"
          label="Имя собаки"
          required
          error={errors.dogName?.message}
        >
          <Input
            id="dogName"
            autoComplete="off"
            placeholder="Бублик"
            aria-invalid={Boolean(errors.dogName)}
            aria-describedby={errors.dogName ? "dogName-error" : undefined}
            {...register("dogName")}
          />
        </FormField>

        <fieldset
          className="space-y-3 sm:col-span-2"
          aria-describedby={contactError ? "contact-error" : "contact-hint"}
        >
          <div>
            <legend className="text-sm font-medium">
              Контакт для связи <span aria-hidden="true">*</span>
            </legend>
            <p id="contact-hint" className="mt-1 text-xs text-muted-foreground">
              Заполните Telegram, телефон или оба поля.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="telegramUsername"
              label="Telegram"
              optional
              error={telegramFormatError}
            >
              <Input
                id="telegramUsername"
                autoCapitalize="none"
                autoComplete="username"
                spellCheck={false}
                placeholder="@dog_owner"
                aria-invalid={Boolean(telegramFormatError || contactError)}
                aria-describedby={
                  telegramFormatError
                    ? "telegramUsername-error"
                    : contactError
                      ? "contact-error"
                      : "contact-hint"
                }
                {...register("telegramUsername")}
              />
            </FormField>

            <FormField
              id="phone"
              label="Телефон"
              optional
              error={errors.phone?.message}
            >
              <Input
                id="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+7 999 123-45-67"
                aria-invalid={Boolean(errors.phone || contactError)}
                aria-describedby={
                  errors.phone
                    ? "phone-error"
                    : contactError
                      ? "contact-error"
                      : "contact-hint"
                }
                {...register("phone")}
              />
            </FormField>
          </div>

          {contactError ? (
            <p
              id="contact-error"
              className="text-xs text-destructive"
              role="alert"
            >
              {contactError}
            </p>
          ) : null}
        </fieldset>
      </div>

      <p className="text-xs leading-5 text-muted-foreground">
        Отправляя заявку, вы соглашаетесь на обработку указанных контактных
        данных только для организации занятия. Данные не публикуются.
      </p>

      <Button className="h-11 w-full sm:w-auto" disabled={isSubmitting}>
        Продолжить
        <ArrowRightIcon data-icon="inline-end" />
      </Button>
    </form>
  );
}

function FormField({
  id,
  label,
  hint,
  error,
  required = false,
  optional = false,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
        {optional ? (
          <span className="text-xs font-normal text-muted-foreground">
            необязательно
          </span>
        ) : null}
      </Label>
      {children}
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
