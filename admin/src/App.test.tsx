import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import App from "./App";
vi.hoisted(() => { vi.stubEnv("VITE_API_BASE_URL", "/api/v1"); });

function response(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(status < 400
    ? { success: true, data }
    : { success: false, message: "دسترسی مجاز نیست", code: "FORBIDDEN" }),
    { status, headers: { "Content-Type": "application/json" } });
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
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
  fireEvent.click(screen.getByRole("button", { name: "کد پیامکی" }));
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

it("defaults to password login, submits once and keeps a non-admin account out of the workspace", async () => {
  let finish!: (value: Response) => void;
  const fetchMock = vi.fn().mockImplementationOnce(() => new Promise<Response>((resolve) => { finish = resolve; }))
    .mockResolvedValueOnce(response({ id: 3, username: "kian", phone: "09120000000", role: "USER" }));
  vi.stubGlobal("fetch", fetchMock);
  render(<App />);
  fireEvent.change(screen.getByLabelText("نام کاربری"), { target: { value: " Kian " } });
  fireEvent.change(screen.getByLabelText("رمز عبور"), { target: { value: " raw password " } });
  const form = screen.getByLabelText("نام کاربری").closest("form")!;
  fireEvent.submit(form); fireEvent.submit(form);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0]![0]).toBe("/api/v1/auth/password/login");
  expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({ username: "kian", password: " raw password " });
  await act(async () => finish(response({ accessToken: "a", refreshToken: "r" })));
  expect(screen.getByRole("alert").textContent).toContain("اطلاعات و دسترسی حساب را بررسی کنید");
  expect(screen.queryByRole("heading", { name: "نمای کلی" })).toBeNull();
  expect(screen.getByRole("heading", { name: "ورود مدیر" })).toBeTruthy();
});

async function requestAdminCode() {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "کد پیامکی" }));
  fireEvent.change(screen.getByLabelText("شمارهٔ موبایل"), { target: { value: "۰۹۱۲۰۰۰۰۰۰۰" } });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "دریافت کد" })); });
}

it("resends to the normalized admin phone after the server cooldown and resets the code", async () => {
  vi.useFakeTimers();
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(response({ expiresIn: 120, cooldownSeconds: 4 }))
    .mockResolvedValueOnce(response({ expiresIn: 120, cooldownSeconds: 8 }));
  vi.stubGlobal("fetch", fetchMock);
  await requestAdminCode();
  expect((screen.getByRole("button", { name: /ارسال مجدد تا ۴ ثانیه/ }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: /ارسال مجدد تا/ }));
  expect(fetchMock).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByLabelText("کد تأیید"), { target: { value: "12345" } });
  act(() => { vi.advanceTimersByTime(4000); });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "ارسال مجدد کد" })); });
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock.mock.calls[1]![0]).toBe("/api/v1/auth/otp/request");
  expect(JSON.parse(fetchMock.mock.calls[1]![1].body)).toEqual({ phone: "09120000000" });
  expect(fetchMock.mock.calls[1]![1].credentials).toBe("omit");
  expect(fetchMock.mock.calls[1]![1].headers.Authorization).toBeUndefined();
  expect((screen.getByLabelText("کد تأیید") as HTMLInputElement).value).toBe("");
  expect(screen.getByRole("status").textContent).toContain("کد جدید ارسال شد");
  expect((screen.getByRole("button", { name: /ارسال مجدد تا ۸ ثانیه/ }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.queryByRole("heading", { name: "نمای کلی" })).toBeNull();
});

it("keeps the OTP form usable and permits retry when resend delivery fails", async () => {
  vi.useFakeTimers();
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(response({ expiresIn: 120, cooldownSeconds: 1 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ success: false, message: "ارسال پیامک انجام نشد", code: "SMS_FAILED" }),
      { status: 502, headers: { "Content-Type": "application/json" } }))
    .mockResolvedValueOnce(response({ expiresIn: 120, cooldownSeconds: 3 }));
  vi.stubGlobal("fetch", fetchMock);
  await requestAdminCode();
  act(() => { vi.advanceTimersByTime(1000); });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "ارسال مجدد کد" })); });
  expect(screen.getByRole("alert").textContent).toContain("ارسال پیامک انجام نشد");
  expect(screen.getByLabelText("کد تأیید")).toBeTruthy();
  expect((screen.getByRole("button", { name: "ارسال مجدد کد" }) as HTMLButtonElement).disabled).toBe(false);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "ارسال مجدد کد" })); });
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.getByRole("status").textContent).toContain("کد جدید ارسال شد");
});

it("locks resend, verification and phone editing while a resend is pending", async () => {
  let finishResend!: (value: Response) => void;
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(response({ expiresIn: 120, cooldownSeconds: 0 }))
    .mockImplementationOnce(() => new Promise<Response>((resolve) => { finishResend = resolve; }));
  vi.stubGlobal("fetch", fetchMock);
  await requestAdminCode();
  fireEvent.change(screen.getByLabelText("کد تأیید"), { target: { value: "12345" } });
  const resend = screen.getByRole("button", { name: "ارسال مجدد کد" });
  fireEvent.click(resend);
  fireEvent.click(resend);
  fireEvent.submit(screen.getByLabelText("کد تأیید").closest("form")!);
  fireEvent.click(screen.getByRole("button", { name: "تغییر شماره" }));
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect((screen.getByLabelText("کد تأیید") as HTMLInputElement).disabled).toBe(true);
  expect((screen.getByRole("button", { name: "تغییر شماره" }) as HTMLButtonElement).disabled).toBe(true);
  await act(async () => { finishResend(response({ expiresIn: 120, cooldownSeconds: 2 })); });
  expect((screen.getByLabelText("کد تأیید") as HTMLInputElement).disabled).toBe(false);
});

it("preserves the cooldown when returning to the same phone and uses a safe older-server fallback", async () => {
  vi.useFakeTimers();
  const fetchMock = vi.fn().mockResolvedValue(response({ expiresIn: 120 }));
  vi.stubGlobal("fetch", fetchMock);
  await requestAdminCode();
  expect((screen.getByRole("button", { name: /ارسال مجدد تا ۶۰ ثانیه/ }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "تغییر شماره" }));
  fireEvent.submit(screen.getByLabelText("شمارهٔ موبایل").closest("form")!);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect((screen.getByRole("button", { name: "دریافت کد" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText("شمارهٔ موبایل"), { target: { value: "09121111111" } });
  expect((screen.getByRole("button", { name: "دریافت کد" }) as HTMLButtonElement).disabled).toBe(false);
});

it("does not send duplicate initial requests or resend during OTP verification", async () => {
  let finishRequest!: (value: Response) => void;
  let finishVerify!: (value: Response) => void;
  const fetchMock = vi.fn()
    .mockImplementationOnce(() => new Promise<Response>((resolve) => { finishRequest = resolve; }))
    .mockImplementationOnce(() => new Promise<Response>((resolve) => { finishVerify = resolve; }));
  vi.stubGlobal("fetch", fetchMock);
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "کد پیامکی" }));
  fireEvent.change(screen.getByLabelText("شمارهٔ موبایل"), { target: { value: "09120000000" } });
  const form = screen.getByLabelText("شمارهٔ موبایل").closest("form")!;
  fireEvent.submit(form);
  fireEvent.submit(form);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await act(async () => { finishRequest(response({ expiresIn: 120, cooldownSeconds: 0 })); });
  fireEvent.change(screen.getByLabelText("کد تأیید"), { target: { value: "12345" } });
  fireEvent.submit(form);
  fireEvent.submit(form);
  fireEvent.click(screen.getByRole("button", { name: "ارسال مجدد کد" }));
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock.mock.calls[1]![0]).toBe("/api/v1/auth/otp/verify");
  await act(async () => { finishVerify(response(null, 401)); });
  expect(screen.getByRole("alert")).toBeTruthy();
  expect((screen.getByRole("button", { name: "ارسال مجدد کد" }) as HTMLButtonElement).disabled).toBe(false);
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
    totals: { users: 12, newUsers30d: 2, orders: { PAID: 2, PROCESSING: 3, SHIPPED: 4 }, revenue30d: 600_000,
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
    if (url.includes("/admin/reports/users")) return Promise.resolve(response({ totals: { users: 5, admins: 2, customers: 3 } }));
    if (url.includes("/admin/orders?")) return Promise.resolve(response({ data: [], meta: { page: 1, totalPages: 0, total: 0, limit: 20 } }));
    throw new Error(`Unexpected admin request: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function loginAdmin() {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "کد پیامکی" }));
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
  expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "محتوای صفحهٔ اصلی" }));
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

it("opens the authenticated landing editor and protects its actual edits on section departure", async () => {
  mobileViewport(false); const fetchMock = adminResponses(); vi.stubGlobal("scrollTo", vi.fn());
  await loginAdmin();
  fireEvent.click(screen.getByRole("button", { name: "محتوای صفحهٔ اصلی" }));
  await screen.findByRole("heading", { name: "محتوای صفحهٔ اصلی" });
  expect(window.location.hash).toBe("#landing");
  fireEvent.change(screen.getByLabelText("متن اعلان"), { target: { value: "اعلان پیش‌نویس" } });
  fireEvent.click(screen.getByRole("button", { name: "سفارش‌ها" }));
  const dialog = await screen.findByRole("dialog", { name: "کنار گذاشتن تغییرها" });
  fireEvent.click(within(dialog).getByRole("button", { name: "بازگشت" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(window.location.hash).toBe("#landing");
  expect((screen.getByLabelText("متن اعلان") as HTMLInputElement).value).toBe("اعلان پیش‌نویس");
  expect(fetchMock.mock.calls.some(([url]) => /\/landing|\/admin\/settings/.test(url))).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "سفارش‌ها" }));
  const discard = await screen.findByRole("dialog", { name: "کنار گذاشتن تغییرها" });
  fireEvent.click(within(discard).getByRole("button", { name: "کنار گذاشتن تغییرها" }));
  await screen.findByRole("heading", { name: "سفارش‌ها" });
  expect(window.location.hash).toBe("#orders");
});

it("labels operational rows as actions and separates current queues from selected-period customer registrations", async () => {
  mobileViewport(false);
  const fetchMock = adminResponses();
  await loginAdmin();
  const customerMetric = await screen.findByText("مشتریان جدید ۱۴ روز اخیر");
  await waitFor(() => expect(customerMetric.closest("article")?.textContent).toContain("۳"));
  expect(customerMetric.closest("article")?.textContent).toContain("بدون مدیران");
  const queue = screen.getByRole("region", { name: "پیگیری سفارش‌ها" });
  const prepare = within(queue).getByRole("link", { name: /آماده‌سازی سفارش/ });
  expect(prepare.getAttribute("href")).toBe("#orders?status=PAID");
  expect(prepare.textContent).toContain("۲");
  expect(within(queue).getByRole("link", { name: /ثبت رهگیری و ارسال/ }).getAttribute("href")).toBe("#orders?status=PROCESSING");
  expect(screen.getByRole("link", { name: /بررسی محصولات غیرفعال/ }).getAttribute("href")).toBe("#products?active=false");
  expect(screen.getByRole("link", { name: /بررسی کالاهای ناموجود/ }).getAttribute("href")).toBe("#reports?focus=low");
  expect(screen.getByText(/شامل سفارش‌های پرداخت‌نشده و لغوشده/)).toBeTruthy();
  const urls = fetchMock.mock.calls.map(([url]) => String(url));
  const sales = urls.find(url => url.includes("/admin/reports/sales?"))!.split("?")[1];
  const registrations = urls.find(url => url.includes("/admin/reports/users?"))!.split("?")[1];
  expect(registrations).toBe(sales);
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

it("focuses the current content through the skip link without changing its section hash", async () => {
  mobileViewport(false); adminResponses(); vi.stubGlobal("scrollTo", vi.fn());
  await loginAdmin();
  fireEvent.click(screen.getByRole("button", { name: "سفارش‌ها" }));
  await screen.findByRole("heading", { name: "سفارش‌ها" });
  fireEvent.click(screen.getByRole("link", { name: "رفتن به محتوای اصلی" }));
  expect(window.location.hash).toBe("#orders");
  expect(document.activeElement).toBe(document.getElementById("admin-content"));
});

it("focuses the new section after mobile navigation instead of returning to the menu trigger", async () => {
  mobileViewport(); adminResponses(); vi.stubGlobal("scrollTo", vi.fn());
  await loginAdmin();
  fireEvent.click(screen.getByRole("button", { name: "باز کردن فهرست" }));
  fireEvent.click(within(screen.getByRole("dialog", { name: "فهرست مدیریت" })).getByRole("button", { name: "سفارش‌ها" }));
  await screen.findByRole("heading", { name: "سفارش‌ها" });
  expect(document.activeElement).toBe(document.getElementById("admin-content"));
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("guards logout and browser unload while a draft exists, and leaves canceled logout signed in", async () => {
  mobileViewport(false); adminResponses(); await loginAdmin();
  const draft = document.createElement("form"); draft.dataset.dirty = "true";
  document.getElementById("admin-content")!.append(draft);
  const unload = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(unload); expect(unload.defaultPrevented).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "خروج" }));
  expect(screen.getByRole("dialog", { name: "کنار گذاشتن تغییرها" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "بازگشت" }));
  await act(async () => {});
  expect(screen.getByRole("heading", { name: "نمای کلی" })).toBeTruthy();
  expect(draft.dataset.dirty).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "خروج" }));
  fireEvent.click(screen.getByRole("button", { name: "کنار گذاشتن تغییرها" }));
  await screen.findByRole("heading", { name: "ورود مدیر" });
});

it("restores a canceled managed history traversal instead of overwriting the previous entry", async () => {
  mobileViewport(false); adminResponses(); vi.stubGlobal("scrollTo", vi.fn());
  await loginAdmin();
  fireEvent.click(screen.getByRole("button", { name: "سفارش‌ها" }));
  await screen.findByRole("heading", { name: "سفارش‌ها" });
  const draft = document.createElement("form"); draft.dataset.dirty = "true";
  document.getElementById("admin-content")!.append(draft);
  window.history.back();
  await screen.findByRole("dialog", { name: "کنار گذاشتن تغییرها" });
  fireEvent.click(screen.getByRole("button", { name: "بازگشت" }));
  await waitFor(() => expect(window.location.hash).toBe("#orders"));
  expect(screen.getByRole("heading", { name: "سفارش‌ها" })).toBeTruthy();
  draft.remove();
  window.history.back();
  await waitFor(() => expect(window.location.hash).toBe("#overview"));
  await screen.findByRole("heading", { name: "نمای کلی" });
});

it("refreshes the same dashboard endpoints through a labeled icon without changing the active route", async () => {
  mobileViewport(false); const requests = adminResponses(); await loginAdmin();
  const refresh = screen.getByRole("button", { name: "به‌روزرسانی نمای کلی" });
  expect(refresh.textContent).toBe("");
  expect(refresh.getAttribute("title")).toBe("به‌روزرسانی نمای کلی");
  expect(refresh.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  const hash = window.location.hash;
  fireEvent.click(refresh);
  await screen.findByRole("button", { name: "به‌روزرسانی نمای کلی" });
  await waitFor(() => {
    expect(requests.mock.calls.filter(([url]) => url.includes("/admin/dashboard"))).toHaveLength(2);
    expect(requests.mock.calls.filter(([url]) => url.includes("/admin/reports/sales"))).toHaveLength(2);
    expect(requests.mock.calls.filter(([url]) => url.includes("/admin/reports/users"))).toHaveLength(2);
  });
  expect(window.location.hash).toBe(hash);
});

it("keeps an unsaved workspace mounted while sorting, then retains the existing guarded navigation", async () => {
  mobileViewport(false); adminResponses(); vi.stubGlobal("scrollTo", vi.fn()); await loginAdmin();
  const main = document.getElementById("admin-content")!;
  const draft = document.createElement("form"); draft.dataset.dirty = "true"; main.append(draft);
  const hash = window.location.hash;
  fireEvent.click(screen.getByRole("button", { name: "تنظیم ترتیب" }));
  const grip = screen.getByRole("button", { name: "جابه‌جایی سفارش‌ها" });
  fireEvent.keyDown(grip, { key: " " }); fireEvent.keyDown(grip, { key: "Home" }); fireEvent.keyDown(grip, { key: "Enter" });
  expect(document.getElementById("admin-content")).toBe(main);
  expect(draft.isConnected).toBe(true); expect(draft.dataset.dirty).toBe("true");
  expect(window.location.hash).toBe(hash);
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "پایان تنظیم ترتیب" }));
  fireEvent.click(screen.getByRole("button", { name: "سفارش‌ها" }));
  await screen.findByRole("dialog", { name: "کنار گذاشتن تغییرها" });
  fireEvent.click(screen.getByRole("button", { name: "بازگشت" }));
  expect(window.location.hash).toBe(hash); expect(draft.isConnected).toBe(true);
});
