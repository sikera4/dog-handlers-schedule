import { expect, test } from "@playwright/test";

test("opens the Russian booking entry point", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Запись на занятие с кинологом" }),
  ).toBeVisible();
  await expect(page.getByText("Время показываем по Москве")).toBeVisible();
});

test("opens the admin foundation", async ({ page }) => {
  await page.goto("/admin");

  await page.getByLabel("Пароль").fill("playwright-local-password");
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(
    page.getByRole("heading", { name: "Панель администратора" }),
  ).toBeVisible();
});

test("books the last individual place atomically", async ({
  request,
}, testInfo) => {
  const from = new Date();
  const to = new Date(from.getTime() + 45 * 24 * 60 * 60 * 1000);
  const availability = await request.get("/api/availability", {
    params: {
      from: from.toISOString(),
      to: to.toISOString(),
      sessionType: "individual",
    },
  });
  expect(availability.ok()).toBe(true);
  const body = (await availability.json()) as {
    slots: Array<{ id: string }>;
  };
  const slot = body.slots[testInfo.project.name === "chromium" ? 0 : 1];
  expect(slot).toBeDefined();

  const booking = {
    slotId: slot.id,
    telegramUsername: `e2e_${testInfo.project.name.replaceAll("-", "_")}`,
    phone: "",
    clientName: "Тест",
    dogName: "Рекс",
  };
  const created = await request.post("/api/bookings", { data: booking });
  expect(created.status()).toBe(201);

  const duplicate = await request.post("/api/bookings", { data: booking });
  expect(duplicate.status()).toBe(409);
  await expect(duplicate.json()).resolves.toMatchObject({ error: "SLOT_FULL" });
});
