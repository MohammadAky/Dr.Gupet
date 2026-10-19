import type { AdminSection } from "./navigation";

export const sidebarGroups: Array<{ title: string; items: Array<{ id: AdminSection; label: string; index: string }> }> = [
  { title: "مرکز فرمان", items: [
    { id: "overview", label: "نمای کلی", index: "۰۱" },
    { id: "products", label: "محصولات", index: "۰۲" },
  ] },
  { title: "مدیریت فروشگاه", items: [
    { id: "orders", label: "سفارش‌ها", index: "۰۳" },
    { id: "people", label: "کاربران", index: "۰۴" },
    { id: "promotions", label: "کدهای تخفیف", index: "۰۵" },
    { id: "care", label: "دارو و مراکز", index: "۰۶" },
  ] },
  { title: "پایش و تنظیمات", items: [
    { id: "payments", label: "پرداخت‌ها", index: "۰۷" },
    { id: "reports", label: "گزارش‌ها", index: "۰۸" },
    { id: "audit", label: "لاگ تغییرات", index: "۰۹" },
    { id: "settings", label: "تنظیمات", index: "۱۰" },
    { id: "landing", label: "محتوای صفحهٔ اصلی", index: "۱۱" },
    { id: "references", label: "داده‌های مرجع", index: "۱۲" },
    { id: "popup", label: "پاپ‌آپ", index: "۱۳" },
  ] },
];

export const sidebarItems = sidebarGroups.flatMap(group => group.items);
export const defaultSidebarOrder: AdminSection[] = sidebarItems.map(item => item.id);

export function sidebarPreferenceKey(accountId: number | null): string | null {
  return accountId !== null && Number.isSafeInteger(accountId) && accountId > 0
    ? `drgupet.admin.sidebar.v1.${accountId}` : null;
}

export function normalizeSidebarOrder(value: unknown): AdminSection[] {
  if (!Array.isArray(value) || value.length > 64) return [...defaultSidebarOrder];
  const valid = value.filter((item): item is AdminSection =>
    typeof item === "string" && defaultSidebarOrder.includes(item as AdminSection));
  return [...new Set([...valid, ...defaultSidebarOrder])];
}

export function readSidebarOrder(accountId: number | null): { order: AdminSection[]; persistent: boolean } {
  const key = sidebarPreferenceKey(accountId);
  if (!key) return { order: [...defaultSidebarOrder], persistent: false };
  try {
    const value = window.localStorage.getItem(key);
    if (!value || value.length > 4096) return { order: [...defaultSidebarOrder], persistent: true };
    try { return { order: normalizeSidebarOrder(JSON.parse(value)), persistent: true }; }
    catch { return { order: [...defaultSidebarOrder], persistent: true }; }
  } catch { return { order: [...defaultSidebarOrder], persistent: false }; }
}

export function saveSidebarOrder(accountId: number | null, order: readonly AdminSection[]): boolean {
  const key = sidebarPreferenceKey(accountId);
  if (!key) return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(normalizeSidebarOrder(order)));
    return true;
  } catch { return false; }
}

export function moveSidebarItem(order: readonly AdminSection[], item: AdminSection, target: number): AdminSection[] {
  const from = order.indexOf(item);
  if (from < 0 || !Number.isFinite(target)) return [...order];
  const next = [...order];
  next.splice(from, 1);
  next.splice(Math.max(0, Math.min(next.length, Math.trunc(target))), 0, item);
  return next;
}

export function isDefaultSidebarOrder(order: readonly AdminSection[]): boolean {
  return order.length === defaultSidebarOrder.length && order.every((id, index) => id === defaultSidebarOrder[index]);
}
