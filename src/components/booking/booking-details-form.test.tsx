import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BookingDetailsForm } from "@/components/booking/booking-details-form";

afterEach(cleanup);

describe("BookingDetailsForm", () => {
  it("continues with only a phone number", async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();

    render(<BookingDetailsForm onContinue={onContinue} />);

    await user.type(screen.getByLabelText("Имя собаки *"), "Бублик");
    await user.type(screen.getByLabelText(/^Телефон/), "8 (999) 123-45-67");
    await user.click(screen.getByRole("button", { name: "Продолжить" }));

    expect(onContinue).toHaveBeenCalledWith(
      {
        dogName: "Бублик",
        phone: "+79991234567",
      },
      expect.anything(),
    );
  });

  it("continues with only a Telegram username", async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();

    render(<BookingDetailsForm onContinue={onContinue} />);

    await user.type(screen.getByLabelText("Имя собаки *"), "Бублик");
    await user.type(screen.getByLabelText(/^Telegram/), "@dog_owner");
    await user.click(screen.getByRole("button", { name: "Продолжить" }));

    expect(onContinue).toHaveBeenCalledWith(
      {
        dogName: "Бублик",
        telegramUsername: "dog_owner",
      },
      expect.anything(),
    );
  });

  it("shows one shared error when neither contact is provided", async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();

    render(<BookingDetailsForm onContinue={onContinue} />);

    await user.type(screen.getByLabelText("Имя собаки *"), "Бублик");
    await user.click(screen.getByRole("button", { name: "Продолжить" }));

    expect(onContinue).not.toHaveBeenCalled();
    expect(screen.getByRole("alert", { name: "" })).toHaveTextContent(
      "Укажите Telegram или телефон",
    );
  });
});
