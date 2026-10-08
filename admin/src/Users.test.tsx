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
