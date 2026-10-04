import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

function mobileViewport(initial = true) {
  let matches = initial;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const media = {
    media: "(max-width: 850px)",
    get matches() { return matches; },
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => { listeners.add(listener); },
    removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => { listeners.delete(listener); },
  } as unknown as MediaQueryList;
  vi.stubGlobal("matchMedia", vi.fn(() => media));
  return {
    set(next: boolean) {
      matches = next;
      act(() => { for (const listener of listeners) listener({ matches: next } as MediaQueryListEvent); });
    },
  };
}

function adminResponses() {
  const dashboard = {
    totals: { users: 12, newUsers30d: 2, orders: {}, revenue30d: 600_000,
      paidOrders30d: 3, revenueToday: 50_000, pendingPaymentOrders: 1,
      lowStockVariants: 0, outOfStockVariants: 0, inactiveProducts: 0, failedPayments24h: 0 },
    charts: { sales14d: [], signups14d: [] }, recentOrders: [], topProducts: [],
  };
  const sales = { totals: { orders: 3, paidOrders: 2, revenue: 300_000 }, byDay: [
    { date: "2026-10-02", orders: 1, revenue: 120_000 },
    { date: "2026-10-03", orders: 2, revenue: 180_000 },
  ] };
  const fetchMock = vi.fn((url: string, _init?: RequestInit) => {
    void _init;
    if (url.endsWith("/auth/otp/request")) return Promise.resolve(response({ expiresIn: 120 }));
    if (url.endsWith("/auth/otp/verify")) return Promise.resolve(response({ accessToken: "a", refreshToken: "r" }));
    if (url.endsWith("/admin/me")) return Promise.resolve(response({ id: 1, role: "ADMIN", firstName: "مدیر" }));
    if (url.includes("/admin/dashboard")) return Promise.resolve(response(dashboard));
    if (url.includes("/admin/reports/sales")) return Promise.resolve(response(sales));
    throw new Error(`Unexpected admin request: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function loginAdmin() {
  render(<App />);
  fireEvent.change(screen.getByLabelText("شمارهٔ موبایل"), { target: { value: "۰۹۱۲۰۰۰۰۰۰۰" } });
  fireEvent.click(screen.getByRole("button", { name: "دریافت کد" }));
  await screen.findByLabelText("کد تأیید");
  fireEvent.change(screen.getByLabelText("کد تأیید"), { target: { value: "۱۲۳۴۵" } });
  fireEvent.click(screen.getByRole("button", { name: "ورود به پنل" }));
  await screen.findByRole("heading", { name: "نمای کلی" });
}

it("traps mobile drawer focus, hides the workspace, and restores the menu trigger on close", async () => {
  mobileViewport();
  adminResponses();
  await loginAdmin();
  const trigger = screen.getByRole("button", { name: "باز کردن فهرست" });
  const sidebar = document.getElementById("admin-navigation")!;
  const workspace = document.querySelector(".main-shell")!;
  expect(sidebar.hasAttribute("inert")).toBe(true);

  fireEvent.click(trigger);
  const dialog = screen.getByRole("dialog", { name: "فهرست مدیریت" });
  const close = within(dialog).getByRole("button", { name: "بستن فهرست" });
  expect(document.activeElement).toBe(close);
  expect(workspace.hasAttribute("inert")).toBe(true);
  expect(sidebar.hasAttribute("inert")).toBe(false);
  fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
  expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "تنظیمات" }));
  fireEvent.keyDown(document, { key: "Tab" });
  expect(document.activeElement).toBe(close);

  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(trigger);
  expect(workspace.hasAttribute("inert")).toBe(false);
  expect(sidebar.hasAttribute("inert")).toBe(true);

  fireEvent.click(trigger);
  fireEvent.click(document.querySelector(".sidebar-scrim")!);
  expect(document.activeElement).toBe(trigger);
  fireEvent.click(trigger);
  vi.stubGlobal("scrollTo", vi.fn());
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "نمای کلی" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(trigger);
});

it("removes mobile modal state on desktop resize and keeps the desktop sidebar navigable", async () => {
  const viewport = mobileViewport();
  adminResponses();
  await loginAdmin();
  const trigger = screen.getByRole("button", { name: "باز کردن فهرست" });
  fireEvent.click(trigger);
  expect(screen.getByRole("dialog")).toBeTruthy();
  viewport.set(false);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.querySelector(".sidebar-scrim")).toBeNull();
  expect(document.querySelector(".main-shell")?.hasAttribute("inert")).toBe(false);
  expect(document.getElementById("admin-navigation")?.hasAttribute("inert")).toBe(false);
  expect(screen.getByRole("navigation", { name: "بخش‌های مدیریت" })).toBeTruthy();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "نمای کلی" }));
  viewport.set(true);
  expect(document.getElementById("admin-navigation")?.hasAttribute("inert")).toBe(true);
  expect(document.activeElement).toBe(trigger);
});

it("provides daily revenue and order counts as an accessible table while keeping the chart visual", async () => {
  mobileViewport(false);
  const fetchMock = adminResponses();
  await loginAdmin();
  const table = await screen.findByRole("table", { name: "فروش روزانه ۱۴ روز اخیر" });
  const rows = within(table).getAllByRole("row");
  expect(rows).toHaveLength(3);
  expect(within(table).getByRole("columnheader", { name: "مبلغ فروش" })).toBeTruthy();
  expect(within(table).getByRole("columnheader", { name: "تعداد سفارش" })).toBeTruthy();
  expect(table.textContent).toContain("۱۲۰٬۰۰۰ تومان");
  expect(table.textContent).toContain("۱۸۰٬۰۰۰ تومان");
  expect(within(rows[1]!).getAllByRole("cell")[1]?.textContent).toBe("۱");
  expect(within(rows[2]!).getAllByRole("cell")[1]?.textContent).toBe("۲");
  expect(document.querySelector(".chart[aria-hidden='true']")).toBeTruthy();
  expect(fetchMock.mock.calls.every(([, init]) => init?.credentials === "omit")).toBe(true);
});
