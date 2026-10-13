// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PasswordInput } from "./PasswordInput";

afterEach(cleanup);
it("provides an icon-only visibility toggle with a Persian action name and preserves the entered password", () => {
  const change = vi.fn();
  render(<><label htmlFor="password">رمز عبور</label><PasswordInput id="password" value="sample password" onChange={change} autoComplete="current-password" /></>);
  const input = screen.getByLabelText("رمز عبور") as HTMLInputElement;
  const reveal = screen.getByRole("button", { name: "نمایش رمز" });
  expect(reveal.textContent).toBe("");
  expect(reveal.querySelector("svg[aria-hidden='true']")).toBeTruthy();
  expect(reveal.getAttribute("aria-controls")).toBe("password");
  expect(input.type).toBe("password");
  expect(input.autocomplete).toBe("current-password");
  fireEvent.click(reveal);
  expect(input.type).toBe("text");
  expect(input.value).toBe("sample password");
  expect(screen.getByRole("button", { name: "پنهان کردن رمز" }).getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "پنهان کردن رمز" }));
  expect(input.type).toBe("password");
  expect(change).not.toHaveBeenCalled();
});

it("keeps visibility locked while a credential request is pending", () => {
  render(<PasswordInput id="pending-password" value="sample password" onChange={vi.fn()} disabled />);
  const reveal = screen.getByRole("button", { name: "نمایش رمز" }) as HTMLButtonElement;
  expect(reveal.disabled).toBe(true);
  fireEvent.click(reveal);
  expect(document.getElementById("pending-password")?.getAttribute("type")).toBe("password");
});
