import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import App from "./App";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
});

it("shows a labeled local demo, makes no API request, and returns to real login on exit", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  window.history.replaceState(null, "", "/?demo=1");
  render(<App />);
  expect(
    await screen.findByText(/تمام اعداد و سفارش‌ها ساختگی‌اند/),
  ).toBeTruthy();
  expect(screen.getByRole("heading", { name: "نمای کلی" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "خروج" }));
  expect(
    await screen.findByRole("heading", { name: "ورود مدیر" }),
  ).toBeTruthy();
  expect(window.location.search).toBe("");
  expect(fetchMock).not.toHaveBeenCalled();
});

it("switches report period and theme in the local demo without cookies or network", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  window.history.replaceState(null, "", "/?demo=1");
  const cookiesBefore = document.cookie;
  render(<App />);
  expect(await screen.findByRole("heading", { name: "نمای کلی" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "۷ روز اخیر" }));
  expect(screen.getByText("فروش ۷ روز اخیر")).toBeTruthy();
  expect(screen.getByRole("button", { name: "۷ روز اخیر" }).getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "فعال کردن حالت تاریک" }));
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(window.localStorage.getItem("drgupet.theme.v1")).toBe("dark");
  expect(document.cookie).toBe(cookiesBefore);
  expect(fetchMock).not.toHaveBeenCalled();
});
