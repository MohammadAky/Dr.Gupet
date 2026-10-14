import { createRef } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AdminSidebar } from "./AdminSidebar";
import { defaultSidebarOrder, sidebarPreferenceKey } from "./sidebar-order";

const onSelect = vi.fn();
const onClose = vi.fn();
function sidebar(accountId = 1, mobile = false, open = false) {
  return <AdminSidebar accountId={accountId} mobile={mobile} open={open} active="products" onSelect={onSelect} onClose={onClose}
    brand={<strong>دکتر گوپت</strong>} sidebarRef={createRef<HTMLElement>()} closeRef={createRef<HTMLButtonElement>()} />;
}
function order() { return Array.from(document.querySelectorAll<HTMLElement>("[data-sidebar-id]")).map(row => row.dataset.sidebarId); }
function edit() { fireEvent.click(screen.getByRole("button", { name: "تنظیم ترتیب" })); }
function handle(label: string) { return screen.getByRole("button", { name: `جابه‌جایی ${label}` }); }
async function point(type: string, y: number, target: Element, kind = "touch", pointerId = 1) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientY: y, buttons: 1, button: 0 });
  Object.defineProperties(event, { pointerId: { value: pointerId }, pointerType: { value: kind }, isPrimary: { value: pointerId === 1 } });
  await act(async () => { fireEvent(target, event); });
}
async function tick(ms = 20) { await act(async () => { vi.advanceTimersByTime(ms); }); }

beforeEach(() => {
  vi.useFakeTimers(); onSelect.mockClear(); onClose.mockClear();
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => true);
  HTMLElement.prototype.releasePointerCapture = vi.fn();
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function(this: HTMLElement) {
    const index = Array.from(document.querySelectorAll("[data-sidebar-id]")).indexOf(this);
    const top = index >= 0 ? 100 + index * 52 : 0;
    const height = index >= 0 ? 48 : 650;
    return { x: 0, y: top, top, bottom: top + height, left: 0, right: 280, width: 280, height, toJSON() { return {}; } };
  });
});
afterEach(() => {
  cleanup(); vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); window.localStorage.clear();
  for (const key of ["setPointerCapture", "hasPointerCapture", "releasePointerCapture"]) Reflect.deleteProperty(HTMLElement.prototype, key);
});

it("keeps the default groups uncluttered, and allows keyboard ordering without navigation or hash changes", () => {
  render(sidebar());
  expect(screen.getByText("مرکز فرمان")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "جابه‌جایی سفارش‌ها" })).toBeNull();
  const hash = window.location.hash;
  edit();
  expect(screen.queryByText(/این ترتیب برای حساب شما/)).toBeNull();
  expect(screen.queryByText(/دستگیره را بکشید/)).toBeNull();
  const grip = handle("سفارش‌ها"); grip.focus();
  expect(grip.hasAttribute("aria-describedby")).toBe(false);
  fireEvent.keyDown(grip, { key: " " });
  fireEvent.keyDown(grip, { key: "Home" });
  expect(order()[0]).toBe("orders");
  expect(document.activeElement).toBe(grip);
  expect(window.localStorage.getItem(sidebarPreferenceKey(1)!)).toBeNull();
  fireEvent.keyDown(grip, { key: "Enter" });
  expect(JSON.parse(window.localStorage.getItem(sidebarPreferenceKey(1)!)!)[0]).toBe("orders");
  expect(onSelect).not.toHaveBeenCalled();
  expect(window.location.hash).toBe(hash);
  fireEvent.click(screen.getByRole("button", { name: "پایان تنظیم ترتیب" }));
  expect(screen.queryByText("مدیریت فروشگاه")).toBeNull();
  expect(screen.getByText("فهرست مدیریت")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "سفارش‌ها" }));
  expect(onSelect).toHaveBeenCalledWith("orders");
});

it("cancels keyboard preview and restores default grouping through the reset action", () => {
  render(sidebar()); edit();
  fireEvent.keyDown(handle("کاربران"), { key: " " });
  fireEvent.keyDown(handle("کاربران"), { key: "ArrowUp" });
  expect(order()[2]).toBe("people");
  fireEvent.keyDown(handle("کاربران"), { key: "Escape" });
  expect(order()).toEqual(defaultSidebarOrder);
  expect(window.localStorage.length).toBe(0);
  fireEvent.click(handle("کاربران"));
  fireEvent.click(screen.getByRole("button", { name: "انتقال گزینهٔ انتخاب‌شده به بالا" }));
  fireEvent.click(screen.getByRole("button", { name: "ثبت جایگاه" }));
  expect(order()[2]).toBe("people");
  fireEvent.click(screen.getByRole("button", { name: "بازگشت به ترتیب پیش‌فرض" }));
  fireEvent.click(screen.getByRole("button", { name: "پایان تنظیم ترتیب" }));
  expect(screen.getByText("مدیریت فروشگاه")).toBeTruthy();
});

it("supports touch dragging with a threshold and commits only its resulting order", async () => {
  render(sidebar()); edit();
  const list = document.querySelector(".sidebar-sort-list")!;
  await point("pointerdown", 228, handle("سفارش‌ها"));
  await point("pointermove", 224, list); await tick();
  expect(order()).toEqual(defaultSidebarOrder);
  await point("pointermove", 128, list); await tick();
  expect(order()[0]).toBe("orders");
  expect(window.localStorage.length).toBe(0);
  await point("pointerup", 128, list); await tick(700);
  expect(document.activeElement).toBe(handle("سفارش‌ها"));
  expect(JSON.parse(window.localStorage.getItem(sidebarPreferenceKey(1)!)!)[0]).toBe("orders");
  expect(HTMLElement.prototype.setPointerCapture).toHaveBeenCalledWith(1);
  expect(HTMLElement.prototype.releasePointerCapture).toHaveBeenCalledWith(1);
  expect(onSelect).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

it("cancels a mouse drag without saving, ignores another pointer and cleans an interrupted gesture on unmount", async () => {
  const shown = render(sidebar()); edit(); const list = document.querySelector(".sidebar-sort-list")!;
  await point("pointerdown", 228, handle("سفارش‌ها"), "mouse");
  await point("pointermove", 128, list, "mouse", 2); await tick();
  expect(order()).toEqual(defaultSidebarOrder);
  await point("pointermove", 128, list, "mouse"); await tick();
  expect(order()[0]).toBe("orders");
  await point("pointercancel", 128, list, "mouse");
  expect(order()).toEqual(defaultSidebarOrder);
  expect(window.localStorage.length).toBe(0);
  const requestedFrame = vi.spyOn(globalThis, "requestAnimationFrame");
  const cancelledFrame = vi.spyOn(globalThis, "cancelAnimationFrame");
  await point("pointerdown", 228, handle("سفارش‌ها"));
  await point("pointermove", 128, list);
  expect(requestedFrame).toHaveBeenCalledOnce();
  const pending = requestedFrame.mock.results[0]!.value;
  shown.unmount(); expect(cancelledFrame).toHaveBeenCalledWith(pending);
});

it("keeps touch capture handoff from a handle to the list, but cancels when the list itself loses capture", async () => {
  render(sidebar()); edit();
  const list = document.querySelector(".sidebar-sort-list")!;
  const grip = handle("سفارش‌ها");
  await point("pointerdown", 228, grip);
  await point("lostpointercapture", 228, grip);
  await point("pointermove", 128, list); await tick();
  expect(order()[0]).toBe("orders");
  await point("pointerup", 128, list); await tick(700);
  expect(JSON.parse(window.localStorage.getItem(sidebarPreferenceKey(1)!)!)[0]).toBe("orders");
  window.localStorage.clear();
  await point("pointerdown", 128, grip);
  await point("pointermove", 380, list); await tick();
  expect(order()[0]).not.toBe("orders");
  await point("lostpointercapture", 380, list);
  expect(order()[0]).toBe("orders");
  expect(window.localStorage.length).toBe(0);
  expect(document.querySelector("[aria-pressed='true']")).toBeNull();
  expect(onSelect).not.toHaveBeenCalled();
});

it("lets a touch user select and move an item with taps instead of a dragging gesture", async () => {
  render(sidebar()); edit();
  const list = document.querySelector(".sidebar-sort-list")!;
  await point("pointerdown", 228, handle("سفارش‌ها"));
  await point("pointerup", 228, list);
  fireEvent.click(handle("سفارش‌ها"), { detail: 1 });
  expect(handle("سفارش‌ها").getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "انتقال گزینهٔ انتخاب‌شده به بالا" }));
  expect(order()[1]).toBe("orders");
  fireEvent.click(screen.getByRole("button", { name: "لغو جابه‌جایی" }));
  expect(order()).toEqual(defaultSidebarOrder);
  expect(window.localStorage.length).toBe(0);
});

it("keeps blocked-storage ordering useful in RAM and separates accounts on identity changes", () => {
  const saved = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("blocked", "SecurityError"); });
  const shown = render(sidebar(1)); edit();
  fireEvent.click(handle("سفارش‌ها"));
  fireEvent.keyDown(handle("سفارش‌ها"), { key: "Home" });
  fireEvent.click(screen.getByRole("button", { name: "ثبت جایگاه" }));
  expect(order()[0]).toBe("orders");
  expect(screen.getByText(/چیدمان فقط برای همین بازدید/)).toBeTruthy();
  saved.mockRestore();
  shown.rerender(sidebar(2));
  expect(screen.getByText("مرکز فرمان")).toBeTruthy(); edit();
  expect(order()).toEqual(defaultSidebarOrder);
  fireEvent.click(handle("گزارش‌ها")); fireEvent.keyDown(handle("گزارش‌ها"), { key: "Home" }); fireEvent.click(screen.getByRole("button", { name: "ثبت جایگاه" }));
  expect(window.localStorage.getItem(sidebarPreferenceKey(1)!)).toBeNull();
  expect(JSON.parse(window.localStorage.getItem(sidebarPreferenceKey(2)!)!)[0]).toBe("reports");
});

it("respects reduced motion and cancels an open drawer's unsaved keyboard selection when closed", async () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  const shown = render(sidebar(1, true, true)); edit();
  const list = document.querySelector(".sidebar-sort-list")!;
  await point("pointerdown", 228, handle("سفارش‌ها")); await point("pointermove", 128, list); await tick(); await point("pointerup", 128, list);
  expect(vi.getTimerCount()).toBe(0);
  expect(document.querySelector("[data-floating]")).toBeNull();
  fireEvent.click(handle("کاربران")); fireEvent.keyDown(handle("کاربران"), { key: "Home" });
  shown.rerender(sidebar(1, true, false)); await act(async () => {});
  expect(document.querySelector("[aria-pressed='true']")).toBeNull();
  expect(document.getElementById("admin-navigation")?.hasAttribute("inert")).toBe(true);
  expect(order()[0]).toBe("orders");
});
