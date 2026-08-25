import { expect, test } from "@playwright/test";

test("opens the Russian booking entry point", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Запись на занятие с кинологом" }),
  ).toBeVisible();
  await expect(page.getByText("Время показываем по Москве")).toBeVisible();
});

test("respects the reduced-motion preference", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  await expect(page.locator(".motion-ambient").first()).toBeHidden();

  const animationDuration = await page
    .getByRole("heading", { name: "Запись на занятие с кинологом" })
    .evaluate((element) => getComputedStyle(element).animationDuration);

  expect(Number.parseFloat(animationDuration)).toBeLessThanOrEqual(0.001);
});

test("opens the admin and deletes an unbooked slot", async ({
  page,
}, testInfo) => {
  await page.goto("/admin");

  await page.getByLabel("Пароль").fill("playwright-local-password");
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(
    page.getByRole("heading", { name: "Панель администратора" }),
  ).toBeVisible();

  const deleteButtons = page.locator(
    'button[aria-label^="Удалить слот"]:not(:disabled)',
  );
  const deleteButton = deleteButtons.nth(
    testInfo.project.name === "chromium" ? 0 : 1,
  );
  const accessibleName = await deleteButton.getAttribute("aria-label");
  expect(accessibleName).toBeTruthy();

  page.once("dialog", (dialog) => dialog.accept());
  await deleteButton.click();

  await expect(page.getByText("Слот удалён")).toBeVisible();
  await expect(page.getByRole("button", { name: accessibleName! })).toHaveCount(
    0,
  );
});

test("deletes a slot after its only booking is cancelled", async ({
  page,
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
  const slot = body.slots[testInfo.project.name === "chromium" ? 4 : 5];
  expect(slot).toBeDefined();

  const dogName = `Отмена E2E ${testInfo.project.name}`;
  const created = await request.post("/api/bookings", {
    data: {
      slotId: slot.id,
      telegramUsername: `cancel_${testInfo.project.name.replaceAll("-", "_")}`,
      phone: "",
      clientName: "Тест",
      dogName,
    },
  });
  expect(created.status()).toBe(201);

  await page.goto("/admin");
  await page.getByLabel("Пароль").fill("playwright-local-password");
  await page.getByRole("button", { name: "Войти" }).click();

  const deleteButton = page.getByTestId(`delete-slot-${slot.id}`);
  await expect(deleteButton).toBeDisabled();

  const bookingRow = page.locator("article").filter({ hasText: dogName });
  await bookingRow.getByRole("button", { name: "Отменить" }).click();
  await expect(page.getByText("Статус обновлён")).toBeVisible();
  await expect(deleteButton).toBeEnabled();

  let confirmationMessage = "";
  page.once("dialog", async (dialog) => {
    confirmationMessage = dialog.message();
    await dialog.accept();
  });
  await deleteButton.click();
  expect(confirmationMessage).toContain("Отменённые записи (1)");

  await expect(page.getByText("Слот удалён")).toBeVisible();
  await expect(deleteButton).toHaveCount(0);
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
