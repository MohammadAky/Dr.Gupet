// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Promotions } from "./Promotions";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("./auth", () => ({ useAuth: () => ({ request }) }));

const coupon = {
  id: 7, code: "AUTUMN", type: "PERCENT", value: 10,
  minOrderAmount: null, maxDiscount: null, totalLimit: null, perUserLimit: null,
  startAt: "2026-10-08T08:30:37.123Z", endAt: "2026-10-09T20:30:15.456Z",
  isActive: true, _count: { redemptions: 0, orders: 0 }, redemptions: [],
};

afterEach(() => { cleanup(); vi.resetAllMocks(); });

it("preserves coupon instants when an admin opens and saves the local datetime fields", async () => {
  request.mockImplementation((path: string, options?: { method?: string }) => {
    if (options?.method === "PATCH") return Promise.resolve(coupon);
    if (path.startsWith("/admin/coupons?")) return Promise.resolve({ data: [coupon], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } });
    if (path === "/admin/coupons/7") return Promise.resolve(coupon);
    throw new Error(`Unexpected request: ${path}`);
  });
  render(<Promotions />);
  fireEvent.click(await screen.findByRole("button", { name: "بررسی" }));
  const start = await screen.findByLabelText("شروع");
  await waitFor(() => expect(start.textContent).toContain("۱۲:۰۰"));
  expect(start.textContent).toContain("۱۶ مهر ۱۴۰۵");
  fireEvent.submit(start.closest("form")!);
  await waitFor(() => expect(request).toHaveBeenCalledWith("/admin/coupons/7", expect.objectContaining({ method: "PATCH", body: expect.objectContaining({ startAt: coupon.startAt, endAt: coupon.endAt }) })));
});

it("normalizes Persian and Arabic coupon numbers before sending a numeric API value", async () => {
  request.mockImplementation((path: string, options?: { method?: string }) => options?.method === "POST" ? Promise.resolve(coupon) : path.includes("?") ? Promise.resolve({ data: [], meta: { page: 1, totalPages: 1 } }) : Promise.resolve(coupon));
  render(<Promotions />);
  fireEvent.click(screen.getByRole("button", { name: "+ کد جدید" }));
  const code = within(screen.getByRole("region", { name: "ساخت کد تخفیف" })).getByLabelText("کد");
  fireEvent.change(code, { target: { value: "NEW" } });
  fireEvent.change(screen.getByLabelText("مقدار (درصد)"), { target: { value: "۲۰" } });
  fireEvent.change(screen.getByLabelText("حداقل سفارش (تومان)"), { target: { value: "١٠٠" } });
  fireEvent.submit(code.closest("form")!);
  await waitFor(() => expect(request).toHaveBeenCalledWith("/admin/coupons", expect.objectContaining({ method: "POST", body: expect.objectContaining({ value: 20, minOrderAmount: 100 }) })));
});

it("does not reopen a deliberately closed coupon editor when its pending save completes", async () => {
  let complete: ((value: unknown) => void) | undefined;
  request.mockImplementation((path: string, options?: { method?: string }) => options?.method === "POST" ? new Promise((resolve) => { complete = resolve; }) : path.includes("?") ? Promise.resolve({ data: [], meta: { page: 1, totalPages: 1 } }) : Promise.resolve(coupon));
  render(<Promotions />);
  fireEvent.click(screen.getByRole("button", { name: "+ کد جدید" }));
  const code = within(screen.getByRole("region", { name: "ساخت کد تخفیف" })).getByLabelText("کد");
  fireEvent.change(code, { target: { value: "NEW" } });
  fireEvent.change(screen.getByLabelText("مقدار (درصد)"), { target: { value: "20" } });
  fireEvent.submit(code.closest("form")!);
  await waitFor(() => expect(complete).toBeDefined());
  fireEvent.click(screen.getByRole("button", { name: "بستن فرم" }));
  await act(async () => complete?.(coupon));
  expect(screen.queryByRole("region", { name: "ساخت کد تخفیف" })).toBeNull();
  expect(screen.queryByRole("region", { name: "جزئیات کد تخفیف" })).toBeNull();
});

it("serializes coupon deletion and ignores its failure after another coupon is selected", async () => {
  let fail: ((error: unknown) => void) | undefined;
  const other = { ...coupon, id: 8, code: "WINTER" };
  request.mockImplementation((path: string, options?: { method?: string }) => {
    if (options?.method === "DELETE") return new Promise((_resolve, reject) => { fail = reject; });
    if (path.includes("?")) return Promise.resolve({ data: [coupon, other], meta: { page: 1, totalPages: 1 } });
    return Promise.resolve(path.endsWith("/8") ? other : coupon);
  });
  render(<Promotions />);
  fireEvent.click((await screen.findAllByRole("button", { name: "بررسی" }))[0]!);
  await screen.findByRole("heading", { name: "ویرایش AUTUMN" });
  const remove = screen.getByRole("button", { name: "حذف / غیرفعال‌سازی" });
  fireEvent.click(remove); fireEvent.click(remove);
  fireEvent.click(screen.getByRole("button", { name: "حذف کد تخفیف" }));
  await waitFor(() => expect(fail).toBeDefined());
  expect(request.mock.calls.filter(([, options]) => options?.method === "DELETE")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "بستن فرم" }));
  fireEvent.click(screen.getAllByRole("button", { name: "بررسی" })[1]!);
  await screen.findByRole("heading", { name: "ویرایش WINTER" });
  await act(async () => fail?.(new Error("old deletion failed")));
  expect(screen.getByRole("heading", { name: "ویرایش WINTER" })).toBeTruthy();
  expect(screen.queryByText("old deletion failed")).toBeNull();
});
