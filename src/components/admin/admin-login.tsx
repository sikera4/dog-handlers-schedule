"use client";

import { useState } from "react";
import { KeyRoundIcon, MailIcon, PawPrintIcon } from "lucide-react";

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

export function AdminLogin({
  mode,
  configured,
  authError,
}: {
  mode: "development" | "supabase";
  configured: boolean;
  authError?: boolean;
}) {
  const [value, setValue] = useState("");
  const [message, setMessage] = useState(
    authError ? "Ссылка недействительна или у пользователя нет доступа." : "",
  );
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "development" ? { password: value } : { email: value },
        ),
      });
      const body = (await response.json()) as {
        message?: string;
        magicLinkSent?: boolean;
      };
      if (!response.ok) throw new Error(body.message ?? "Не удалось войти");

      if (body.magicLinkSent) {
        setSent(true);
      } else {
        window.location.reload();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось войти");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-muted/35 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground">
            <PawPrintIcon className="size-5" />
          </div>
          <CardTitle className="text-xl">{PRODUCT_NAME} · Админ</CardTitle>
          <CardDescription>
            {mode === "development"
              ? "Локальный вход для разработки"
              : "Получите защищённую ссылку на разрешённый email"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!configured ? (
            <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
              Локальный вход не настроен. Скопируйте `.env.example` в
              `.env.local` и задайте `DEV_ADMIN_PASSWORD` и
              `ADMIN_SESSION_SECRET`.
            </div>
          ) : sent ? (
            <div className="rounded-lg bg-accent p-4 text-sm text-accent-foreground">
              Ссылка отправлена. Откройте письмо в этом браузере.
            </div>
          ) : (
            <form className="space-y-4" onSubmit={submit}>
              <div className="space-y-2">
                <Label htmlFor="credential">
                  {mode === "development" ? "Пароль" : "Email"}
                </Label>
                <Input
                  id="credential"
                  type={mode === "development" ? "password" : "email"}
                  autoComplete={
                    mode === "development" ? "current-password" : "email"
                  }
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  required
                />
              </div>
              {message ? (
                <p className="text-sm text-destructive" role="alert">
                  {message}
                </p>
              ) : null}
              <Button className="h-11 w-full" disabled={pending}>
                {mode === "development" ? (
                  <KeyRoundIcon data-icon="inline-start" />
                ) : (
                  <MailIcon data-icon="inline-start" />
                )}
                {pending
                  ? "Подождите…"
                  : mode === "development"
                    ? "Войти"
                    : "Отправить ссылку"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
