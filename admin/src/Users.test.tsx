// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Users } from "./Users";
const { request, logout } = vi.hoisted(() => ({ request: vi.fn(), logout: vi.fn() }));
vi.mock("./auth", () => ({ useAuth: () => ({ request, logout, identity: { id: 1 } }) }));
const user = { id: 5, phone: "09120000000", username: "existing", firstName: "کاربر", lastName: null, role: "USER", status: "ACTIVE", deletedAt: null, createdAt: "2026-10-01T00:00:00Z", isPhoneVerified: true, _count: { orders: 0, pets: 0, addresses: 0 }, pets: [], addresses: [], orders: [] };
function mockRequests() {
  request.mockImplementation((path: string, options?: { method?: string }) => {
    if (options?.method === "POST") return Promise.resolve(user);
    if (path.startsWith("/admin/users?")) return Promise.resolve({ data: [user], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } });
    if (path === "/admin/users/5") return Promise.resolve(user);
    throw new Error(`Unexpected request: ${path}`);
  });
}
afterEach(() => { cleanup(); vi.resetAllMocks(); localStorage.clear(); sessionStorage.clear(); });
it("creates an administrator with a mandatory normalized phone and matching password, without browser credential storage", async () => {
  mockRequests(); render(<Users />);
  fireEvent.click(screen.getByRole("button", { name: "افزودن کاربر" }));
  const form = screen.getByRole("region", { name: "افزودن کاربر" });
  fireEvent.change(within(form).getByLabelText("نام کاربری"), { target: { value: "New.Admin" } });
  fireEvent.change(within(form).getByLabelText("شماره موبایل"), { target: { value: "۰۹۱۲۱۱۱۱۱۱۱" } });
  fireEvent.change(within(form).getByLabelText("رمز عبور"), { target: { value: "new admin password" } });
  fireEvent.change(within(form).getByLabelText("تکرار رمز عبور"), { target: { value: "mismatch" } });
  fireEvent.change(within(form).getByLabelText("نقش"), { target: { value: "ADMIN" } });
  fireEvent.click(within(form).getByRole("button", { name: "ثبت کاربر" }));
  expect(request.mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
  fireEvent.change(within(form).getByLabelText("تکرار رمز عبور"), { target: { value: "new admin password" } });
  await act(async () => { fireEvent.submit(form.querySelector("form")!); fireEvent.submit(form.querySelector("form")!); });
  expect(request).toHaveBeenCalledWith("/admin/users/password-account", expect.objectContaining({ method: "POST", body: { phone: "09121111111", username: "new.admin", password: "new admin password", role: "ADMIN", firstName: undefined, lastName: undefined } }));
  expect(request.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(1);
  expect(localStorage.length).toBe(0); expect(sessionStorage.length).toBe(0);
});
it("assigns credentials to the selected account without changing its phone or role", async () => {
  mockRequests(); render(<Users />);
  fireEvent.click(await screen.findByRole("button", { name: "بررسی" }));
  const panel = await screen.findByRole("region", { name: "اطلاعات ورود کاربر" });
  fireEvent.change(within(panel).getByLabelText("رمز عبور جدید"), { target: { value: "replacement password" } });
  fireEvent.change(within(panel).getByLabelText("تکرار رمز عبور جدید"), { target: { value: "replacement password" } });
  fireEvent.click(within(panel).getByRole("button", { name: "ذخیرهٔ اطلاعات ورود" }));
  await waitFor(() => expect(request).toHaveBeenCalledWith("/admin/users/5/password-account", { method: "POST", body: { username: "existing", password: "replacement password" } }));
  await waitFor(() => expect((within(panel).getByLabelText("رمز عبور جدید") as HTMLInputElement).value).toBe(""));
  expect(logout).not.toHaveBeenCalled();
});
it("reveals the user record once and restores its opener when closed", async () => {
  const originalScroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");
  const scroll = vi.fn();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: scroll });
  try {
    mockRequests(); render(<Users />);
    const opener = await screen.findByRole("button", { name: "بررسی" });
    fireEvent.click(opener);
    const panel = screen.getByRole("region", { name: "پروندهٔ کاربر" });
    expect(document.activeElement).toBe(panel);
    expect(scroll).toHaveBeenCalledTimes(1);
    expect(scroll).toHaveBeenCalledWith({ block: "start", behavior: "auto" });
    await within(panel).findByRole("region", { name: "اطلاعات ورود کاربر" });
    const name = within(panel).getByLabelText("نام");
    name.focus();
    fireEvent.change(name, { target: { value: "نام تازه" } });
    expect(document.activeElement).toBe(name);
    expect(scroll).toHaveBeenCalledTimes(1);
    fireEvent.click(within(panel).getByRole("button", { name: "بستن پرونده" }));
    await waitFor(() => expect(document.activeElement).toBe(opener));
    expect(screen.queryByRole("region", { name: "پروندهٔ کاربر" })).toBeNull();
  } finally {
    if (originalScroll) Object.defineProperty(HTMLElement.prototype, "scrollIntoView", originalScroll);
    else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
  }
});
it("focuses the account creation form on explicit open without creating an account", async () => {
  mockRequests(); render(<Users />);
  const opener = screen.getByRole("button", { name: "افزودن کاربر" });
  fireEvent.click(opener);
  expect(document.activeElement).toBe(screen.getByRole("form", { name: "ساخت حساب کاربر" }));
  fireEvent.click(screen.getByRole("button", { name: "بستن فرم" }));
  await waitFor(() => expect(document.activeElement).toBe(opener));
  expect(request.mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
});

function mutationRequests(initial = user) {
  let current: Omit<typeof user, "deletedAt"> & { deletedAt: string | null } = { ...initial };
  request.mockImplementation((path: string, options?: { method?: string; body?: { status?: "ACTIVE" | "BLOCKED" } }) => {
    if (options?.method === "PATCH") { current = { ...current, status: options.body?.status ?? current.status }; return Promise.resolve(current); }
    if (options?.method === "DELETE") { current = { ...current, deletedAt: "2026-10-14T00:00:00Z", status: "BLOCKED" }; return Promise.resolve({ deleted: true }); }
    if (path.startsWith("/admin/users?")) return Promise.resolve({ data: [current], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } });
    if (path === `/admin/users/${initial.id}`) return Promise.resolve(current);
    throw new Error(`Unexpected request: ${path}`);
  });
}
async function openRecord() {
  fireEvent.click(await screen.findByRole("button", { name: "بررسی" }));
  return screen.findByRole("button", { name: "حذف حساب" });
}
function confirmMutation() { fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "تأیید تغییر حساب" })); }
it.each(["USER", "ADMIN"])("places %s suspension/deletion ahead of credentials and requires separately confirmed persisted suspension", async role => {
  mutationRequests({ ...user, role }); render(<Users />); const remove = await openRecord();
  const access = screen.getByRole("region", { name: "دسترسی و حذف حساب" });
  const credentials = await screen.findByRole("region", { name: "اطلاعات ورود کاربر" });
  expect(access.compareDocumentPosition(credentials) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(within(access).getByRole("button", { name: "تعلیق حساب" })).toBeTruthy();
  expect(screen.getAllByRole("button", { name: "حذف حساب" })).toHaveLength(1);
  expect((remove as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(within(screen.getByRole("region", { name: "پروندهٔ کاربر" })).getByLabelText("وضعیت"), { target: { value: "BLOCKED" } });
  expect((remove as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "تعلیق حساب" }));
  expect(request.mock.calls.some(([, options]) => options?.method === "PATCH")).toBe(false);
  confirmMutation();
  await waitFor(() => expect((screen.getByRole("button", { name: "حذف حساب" }) as HTMLButtonElement).disabled).toBe(false));
  expect(request).toHaveBeenCalledWith("/admin/users/5", { method: "PATCH", body: { status: "BLOCKED" } });
  fireEvent.click(screen.getByRole("button", { name: "حذف حساب" }));
  expect(screen.getByRole("dialog").textContent).toContain("قابل بازیابی");
  expect(screen.getByRole("dialog").textContent).toContain("تاریخچه حفظ");
  expect(request.mock.calls.some(([, options]) => options?.method === "DELETE")).toBe(false);
  confirmMutation();
  await screen.findByRole("button", { name: "بازیابی حساب" });
  expect(request.mock.calls.filter(([, options]) => options?.method === "DELETE")).toHaveLength(1);
  expect(request).toHaveBeenCalledWith("/admin/users/5", { method: "DELETE" });
});
it.each(["USER", "ADMIN"])("shows the sole %s stored-BLOCKED delete action at the top and keeps deletion optional/cancellable", async role => {
  mutationRequests({ ...user, role, status: "BLOCKED" }); render(<Users />); const remove = await openRecord();
  const access = screen.getByRole("region", { name: "دسترسی و حذف حساب" });
  expect(within(access).getByRole("button", { name: "حذف حساب" })).toBe(remove);
  expect((remove as HTMLButtonElement).disabled).toBe(false);
  expect(within(access).queryByRole("button", { name: "تعلیق حساب" })).toBeNull();
  expect(access.textContent).toContain("حذف آن اختیاری");
  fireEvent.click(remove);
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "بازگشت" }));
  await act(async () => {});
  expect(request.mock.calls.some(([, options]) => options?.method === "DELETE")).toBe(false);
  fireEvent.click(remove); confirmMutation();
  await waitFor(() => expect(within(screen.getByRole("region", { name: "دسترسی و حذف حساب" })).getByRole("button", { name: "بازیابی حساب" })).toBeTruthy());
  expect(request.mock.calls.filter(([, options]) => options?.method === "DELETE")).toHaveLength(1);
});
it("keeps deletion unavailable when suspension fails and never changes self access", async () => {
  mutationRequests(); const implementation = request.getMockImplementation()!;
  request.mockImplementation((path: string, options?: { method?: string }) => options?.method === "PATCH" ? Promise.reject(new Error("تعلیق انجام نشد")) : implementation(path, options));
  render(<Users />); await openRecord();
  fireEvent.click(screen.getByRole("button", { name: "تعلیق حساب" })); confirmMutation();
  await screen.findByText("تعلیق انجام نشد");
  expect((screen.getByRole("button", { name: "حذف حساب" }) as HTMLButtonElement).disabled).toBe(true);
  expect(request.mock.calls.some(([, options]) => options?.method === "DELETE")).toBe(false);
  cleanup(); request.mockClear(); mutationRequests({ ...user, id: 1, role: "ADMIN" }); render(<Users />); await openRecord();
  expect((screen.getByRole("button", { name: "تعلیق حساب" }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole("button", { name: "حذف حساب" }) as HTMLButtonElement).disabled).toBe(true);
});
it("does not treat a mutation response as proof of persisted suspension, and cancellation never writes", async () => {
  mockRequests(); const implementation = request.getMockImplementation()!;
  request.mockImplementation((path: string, options?: { method?: string }) => options?.method === "PATCH" ? Promise.resolve({ ...user, status: "BLOCKED" }) : implementation(path, options));
  render(<Users />); await openRecord();
  fireEvent.click(screen.getByRole("button", { name: "تعلیق حساب" }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "بازگشت" }));
  await act(async () => {});
  expect(request.mock.calls.some(([, options]) => options?.method === "PATCH")).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "تعلیق حساب" })); confirmMutation();
  await waitFor(() => expect(request.mock.calls.filter(([path, options]) => path === "/admin/users/5" && !options?.method).length).toBe(2));
  await screen.findByRole("button", { name: "تعلیق حساب" });
  expect((screen.getByRole("button", { name: "حذف حساب" }) as HTMLButtonElement).disabled).toBe(true);
});
