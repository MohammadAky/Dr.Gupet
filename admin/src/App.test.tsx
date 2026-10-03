import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "./App";

function response(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(status < 400
    ? { success: true, data }
    : { success: false, message: "دسترسی مجاز نیست", code: "FORBIDDEN" }),
    { status, headers: { "Content-Type": "application/json" } });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
});

it("never opens admin from a demo URL and leaves theme changes out of cookies", () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  window.history.replaceState(null, "", "/?demo=1");
  const cookiesBefore = document.cookie;
  render(<App />);
  expect(screen.getByRole("heading", { name: "ورود مدیر" })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "نمای کلی" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "فعال کردن حالت تاریک" }));
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(window.localStorage.getItem("drgupet.theme.v1")).toBe("dark");
  expect(document.cookie).toBe(cookiesBefore);
  expect(fetchMock).not.toHaveBeenCalled();
});

it("requires OTP and refuses a non-admin identity", async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(response({ expiresIn: 120 }))
    .mockResolvedValueOnce(response({ accessToken: "a", refreshToken: "r" }))
    .mockResolvedValueOnce(response({ id: 3, phone: "09120000000", role: "USER" }));
  vi.stubGlobal("fetch", fetchMock);
  render(<App />);
  fireEvent.change(screen.getByLabelText("شمارهٔ موبایل"), { target: { value: "۰۹۱۲۰۰۰۰۰۰۰" } });
  fireEvent.click(screen.getByRole("button", { name: "دریافت کد" }));
  expect(await screen.findByLabelText("کد تأیید")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("کد تأیید"), { target: { value: "۱۲۳۴۵" } });
  fireEvent.click(screen.getByRole("button", { name: "ورود به پنل" }));
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("دسترسی ندارد"));
  expect(screen.getByRole("heading", { name: "ورود مدیر" })).toBeTruthy();
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
    "/api/v1/auth/otp/request", "/api/v1/auth/otp/verify", "/api/v1/admin/me",
  ]);
  expect(fetchMock.mock.calls.every(([, init]) => init.credentials === "omit")).toBe(true);
  expect(document.cookie).toBe("");
});
