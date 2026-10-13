// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Orders } from "./Orders";
import { hasUnsavedDrafts, useDraftProtection } from "./management";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("./auth", () => ({ useAuth: () => ({ request }) }));
const order = {
  id: 42, orderNumber: "DG-42", status: "PAID", finalAmount: 100000,
  createdAt: "2026-10-01T00:00:00Z", trackingCode: null, refundedAt: null,
  user: { id: 5, phone: "09120000000", firstName: "کاربر", lastName: null },
  _count: { items: 0, payments: 0 }, items: [], payments: [], addressSnapshot: null,
  shippingMethod: null, note: null, refundNote: null, itemsTotal: 100000, discountAmount: 0, shippingCost: 0,
};
afterEach(() => { cleanup(); request.mockReset(); window.history.replaceState(null, "", "/"); });

it("submits an order transition once and clears only its accepted processing-note draft", async () => {
  let complete: ((value: unknown) => void) | undefined;
  request.mockImplementation((path: string, options?: { method?: string }) => {
    if (options?.method === "PATCH") return new Promise((resolve) => { complete = resolve; });
    if (path.includes("?")) return Promise.resolve({ data: [order], meta: { page: 1, totalPages: 1 } });
    return Promise.resolve(order);
  });
  function ProtectedOrders() { useDraftProtection(); return <Orders />; }
  render(<ProtectedOrders />);
  fireEvent.click(await screen.findByRole("button", { name: "بررسی" }));
  const note = await screen.findByLabelText("یادداشت پردازش");
  fireEvent.change(note, { target: { value: " آماده‌سازی بسته " } });
  expect(hasUnsavedDrafts()).toBe(true);
  const transition = screen.getByRole("button", { name: "انتقال به در حال پردازش" });
  act(() => { fireEvent.click(transition); fireEvent.click(transition); });
  await waitFor(() => expect(complete).toBeDefined());
  expect(request.mock.calls.filter(([, options]) => options?.method === "PATCH")).toHaveLength(1);
  expect(request).toHaveBeenCalledWith("/admin/orders/42/transition", expect.objectContaining({ method: "PATCH", body: { to: "PROCESSING", note: "آماده‌سازی بسته" } }));
  expect((note as HTMLInputElement).disabled).toBe(true);
  await act(async () => complete?.({}));
  expect(hasUnsavedDrafts()).toBe(false);
});

it("clears the accepted cancellation reason draft while sending the API reason field", async () => {
  const pendingOrder = { ...order, status: "PENDING_PAYMENT" };
  request.mockImplementation((path: string, options?: { method?: string }) => {
    if (options?.method === "POST") return Promise.resolve({});
    if (path.includes("?")) return Promise.resolve({ data: [pendingOrder], meta: { page: 1, totalPages: 1 } });
    return Promise.resolve(pendingOrder);
  });
  function ProtectedOrders() { useDraftProtection(); return <Orders />; }
  render(<ProtectedOrders />);
  fireEvent.click(await screen.findByRole("button", { name: "بررسی" }));
  const note = await screen.findByLabelText("دلیل لغو");
  fireEvent.change(note, { target: { value: " درخواست مشتری " } });
  expect(hasUnsavedDrafts()).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "لغو سفارش" }));
  expect(request.mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "تأیید عملیات سفارش" }));
  await waitFor(() => expect(request).toHaveBeenCalledWith("/admin/orders/42/cancel", { method: "POST", body: { reason: "درخواست مشتری" } }));
  await waitFor(() => expect(hasUnsavedDrafts()).toBe(false));
});
