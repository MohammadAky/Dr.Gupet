import { afterEach, describe, expect, it, vi } from "vitest";
import { adminSections } from "./navigation";
import { defaultSidebarOrder, isDefaultSidebarOrder, moveSidebarItem, normalizeSidebarOrder, readSidebarOrder, saveSidebarOrder, sidebarPreferenceKey } from "./sidebar-order";

afterEach(() => { window.localStorage.clear(); vi.restoreAllMocks(); });
describe("account-scoped sidebar ordering", () => {
  it("retains every allowlisted section and appends sections absent from an older preference", () => {
    expect(defaultSidebarOrder).toEqual([...adminSections]);
    expect(normalizeSidebarOrder(["orders", "orders", "unknown", 4, "people"])).toEqual([
      "orders", "people", ...defaultSidebarOrder.filter(id => id !== "orders" && id !== "people"),
    ]);
    expect(normalizeSidebarOrder(defaultSidebarOrder.slice(0, -1))).toEqual(defaultSidebarOrder);
    expect(normalizeSidebarOrder([])).toEqual(defaultSidebarOrder);
  });
  it("uses separate account keys and stores only the section order without account details", () => {
    const first = moveSidebarItem(defaultSidebarOrder, "orders", 0);
    expect(saveSidebarOrder(1, first)).toBe(true);
    expect(readSidebarOrder(1).order).toEqual(first);
    expect(readSidebarOrder(2).order).toEqual(defaultSidebarOrder);
    expect(JSON.parse(window.localStorage.getItem(sidebarPreferenceKey(1)!)!)).toEqual(first);
    expect(saveSidebarOrder(2, moveSidebarItem(defaultSidebarOrder, "reports", 0))).toBe(true);
    expect(readSidebarOrder(1).order).toEqual(first);
    expect(window.localStorage.length).toBe(2);
  });
  it("rejects malformed, oversized and non-array stored preferences without hiding links", () => {
    for (const value of ["{broken", "x".repeat(5000), JSON.stringify({ order: ["orders"] }), JSON.stringify(Array.from({ length: 100 }, () => "orders"))]) {
      window.localStorage.setItem(sidebarPreferenceKey(1)!, value);
      expect(readSidebarOrder(1).order).toEqual(defaultSidebarOrder);
    }
    window.localStorage.setItem(sidebarPreferenceKey(1)!, '["<script>","ADMIN","orders","orders"]');
    expect(readSidebarOrder(1).order[0]).toBe("orders");
    expect(readSidebarOrder(1).order).toHaveLength(defaultSidebarOrder.length);
  });
  it("fails safely when storage or a valid identity is unavailable", () => {
    for (const id of [null, 0, -1, Number.NaN, Number.POSITIVE_INFINITY, 1.5]) {
      expect(sidebarPreferenceKey(id)).toBeNull();
      expect(saveSidebarOrder(id, defaultSidebarOrder)).toBe(false);
      expect(readSidebarOrder(id).persistent).toBe(false);
    }
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new DOMException("blocked", "SecurityError"); });
    expect(readSidebarOrder(1)).toEqual({ order: defaultSidebarOrder, persistent: false });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("full", "QuotaExceededError"); });
    expect(saveSidebarOrder(1, defaultSidebarOrder)).toBe(false);
  });
  it("moves immutably, clamps the endpoints and recognizes the exact default order", () => {
    const initial = [...defaultSidebarOrder];
    expect(moveSidebarItem(initial, "orders", -10)[0]).toBe("orders");
    expect(moveSidebarItem(initial, "overview", 100).at(-1)).toBe("overview");
    expect(moveSidebarItem(initial, "orders", Number.NaN)).toEqual(initial);
    expect(initial).toEqual(defaultSidebarOrder);
    expect(isDefaultSidebarOrder(initial)).toBe(true);
    expect(isDefaultSidebarOrder(moveSidebarItem(initial, "orders", 0))).toBe(false);
  });
});
