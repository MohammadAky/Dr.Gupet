// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Orders } from "./Orders";
import { hasUnsavedDrafts, useDraftProtection } from "./management";
import { ApiError } from "./api/client";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("./auth", () => ({ useAuth: () => ({ request }) }));
const order = {
  id: 42, orderNumber: "DG-42", status: "PAID", finalAmount: 100000,
  createdAt: "2026-10-01T00:00:00Z", trackingCode: null, refundedAt: null as string | null,
  user: { id: 5, phone: "09120000000", firstName: "کاربر", lastName: null },
  _count: { items: 0, payments: 0 }, items: [], payments: [], addressSnapshot: null,
  shippingMethod: null, note: null, refundNote: null, itemsTotal: 100000, discountAmount: 0, shippingCost: 0,
};
afterEach(() => { document.querySelector('.admin-confirm')?.dispatchEvent(new Event('cancel', { cancelable: true })); cleanup(); request.mockReset(); window.history.replaceState(null, "", "/"); });

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
  fireEvent.change(await screen.findByLabelText("وضعیت جدید سفارش"), { target: { value: "PROCESSING" } });
  const note = await screen.findByLabelText("یادداشت پردازش");
  fireEvent.change(note, { target: { value: " آماده‌سازی بسته " } });
  expect(hasUnsavedDrafts()).toBe(true);
  const transition = screen.getByRole("button", { name: "ثبت وضعیت" });
  act(() => { fireEvent.click(transition); fireEvent.click(transition); });
  await waitFor(() => expect(complete).toBeDefined());
  expect(request.mock.calls.filter(([, options]) => options?.method === "PATCH")).toHaveLength(1);
  expect(request).toHaveBeenCalledWith("/admin/orders/42/transition", expect.objectContaining({ method: "PATCH", body: { to: "PROCESSING", expectedStatus: "PAID", note: "آماده‌سازی بسته" } }));
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
  fireEvent.change(await screen.findByLabelText("وضعیت جدید سفارش"), { target: { value: "CANCELED" } });
  const note = await screen.findByLabelText("دلیل لغو");
  fireEvent.change(note, { target: { value: " درخواست مشتری " } });
  expect(hasUnsavedDrafts()).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "ثبت وضعیت" }));
  expect(request.mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "تأیید عملیات سفارش" }));
  await waitFor(() => expect(request).toHaveBeenCalledWith("/admin/orders/42/cancel", { method: "POST", body: { reason: "درخواست مشتری", expectedStatus: "PENDING_PAYMENT" } }));
  await waitFor(() => expect(hasUnsavedDrafts()).toBe(false));
});

async function openOrder(value = order) {
  request.mockImplementation((path: string, options?: { method?: string }) => {
    if (options?.method) return Promise.resolve({});
    return Promise.resolve(path.includes('?') ? { data: [value], meta: { page: 1, totalPages: 1 } } : value);
  });
  render(<Orders />);
  fireEvent.click(await screen.findByRole('button', { name: 'بررسی' }));
  return await screen.findByLabelText('وضعیت جدید سفارش') as HTMLSelectElement;
}

it('shows all six statuses, explains protected options, and enables only direct forward fulfillment', async () => {
  const select = await openOrder();
  const options = Array.from(select.options);
  expect(options.map(option => option.value)).toEqual(['PENDING_PAYMENT', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELED']);
  expect(options.filter(option => !option.disabled).map(option => option.value)).toEqual(['PROCESSING', 'SHIPPED', 'DELIVERED']);
  expect(options.find(option => option.value === 'PAID')?.disabled).toBe(true);
  expect(options.find(option => option.value === 'PENDING_PAYMENT')?.textContent).toContain('فقط هنگام ثبت سفارش');
  expect(options.find(option => option.value === 'CANCELED')?.textContent).toContain('فقط پیش از پرداخت');
  expect((screen.getByRole('button', { name: 'ثبت وضعیت' }) as HTMLButtonElement).disabled).toBe(true);
});

it('sends one direct delivery without intermediate calls or shipping fields', async () => {
  const select = await openOrder();
  fireEvent.change(select, { target: { value: 'DELIVERED' } });
  fireEvent.click(screen.getByRole('button', { name: 'ثبت وضعیت' }));
  await waitFor(() => expect(request).toHaveBeenCalledWith('/admin/orders/42/transition', {
    method: 'PATCH', body: { to: 'DELIVERED', expectedStatus: 'PAID' },
  }));
  expect(request.mock.calls.filter(([, options]) => options?.method)).toHaveLength(1);
});

it('includes shipping metadata when PAID goes directly to SHIPPED', async () => {
  const select = await openOrder();
  fireEvent.change(screen.getByLabelText('کد رهگیری'), { target: { value: ' IR42 ' } });
  fireEvent.change(screen.getByLabelText('روش ارسال'), { target: { value: ' پست ' } });
  fireEvent.change(select, { target: { value: 'SHIPPED' } });
  fireEvent.click(screen.getByRole('button', { name: 'ثبت وضعیت' }));
  await waitFor(() => expect(request).toHaveBeenCalledWith('/admin/orders/42/transition', {
    method: 'PATCH', body: { to: 'SHIPPED', expectedStatus: 'PAID', trackingCode: 'IR42', shippingMethod: 'پست' },
  }));
});

it.each(['CANCELED', 'DELIVERED'])('does not reopen terminal %s orders through the selector', async status => {
  const select = await openOrder({ ...order, status });
  expect(Array.from(select.options).every(option => option.disabled)).toBe(true);
  fireEvent.change(select, { target: { value: 'PROCESSING' } });
  fireEvent.click(screen.getByRole('button', { name: 'ثبت وضعیت' }));
  expect(request.mock.calls.some(([, options]) => options?.method)).toBe(false);
});

it('blocks fulfillment after a refund while preserving the separate recorded-refund explanation', async () => {
  const select = await openOrder({ ...order, refundedAt: '2026-10-16T12:00:00Z' });
  expect(Array.from(select.options).every(option => option.disabled)).toBe(true);
  expect(screen.getByText('استرداد ثبت شده است؛ تغییر وضعیت آماده‌سازی، ارسال و تحویل مجاز نیست.')).toBeTruthy();
  fireEvent.change(select, { target: { value: 'DELIVERED' } });
  fireEvent.click(screen.getByRole('button', { name: 'ثبت وضعیت' }));
  expect(request.mock.calls.some(([, options]) => options?.method)).toBe(false);
});

it('cancels confirmation without any order write', async () => {
  const select = await openOrder({ ...order, status: 'PENDING_PAYMENT' });
  fireEvent.change(select, { target: { value: 'CANCELED' } });
  fireEvent.click(screen.getByRole('button', { name: 'ثبت وضعیت' }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'بازگشت' }));
  await act(async () => {});
  expect(request.mock.calls.some(([, options]) => options?.method)).toBe(false);
  expect(select.value).toBe('CANCELED');
});

it('preserves a rejected status draft and can explicitly refresh the current server status', async () => {
  let current = { ...order };
  request.mockImplementation((path: string, options?: { method?: string }) => {
    if (options?.method) { current = { ...order, status: 'SHIPPED' }; return Promise.reject(new ApiError('وضعیت سفارش تغییر کرده است', 409, 'ORDER_STALE_STATE')); }
    return Promise.resolve(path.includes('?') ? { data: [current], meta: { page: 1, totalPages: 1 } } : current);
  });
  function ProtectedOrders() { useDraftProtection(); return <Orders />; }
  render(<ProtectedOrders />);
  fireEvent.click(await screen.findByRole('button', { name: 'بررسی' }));
  const select = await screen.findByLabelText('وضعیت جدید سفارش') as HTMLSelectElement;
  fireEvent.change(select, { target: { value: 'DELIVERED' } });
  fireEvent.click(screen.getByRole('button', { name: 'ثبت وضعیت' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('وضعیت سفارش تغییر کرده است'));
  expect(hasUnsavedDrafts()).toBe(true); expect(select.value).toBe('DELIVERED');
  fireEvent.click(screen.getByRole('button', { name: 'تازه‌سازی جزئیات' }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'کنار گذاشتن تغییرها' }));
  await waitFor(() => expect((screen.getByLabelText('وضعیت جدید سفارش') as HTMLSelectElement).value).toBe('SHIPPED'));
  expect(request.mock.calls.filter(([, options]) => options?.method)).toHaveLength(1);
});
