// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ProductCsvSync } from "./ProductCsvSync";
import { ProductCsvExport } from "./ProductCsvExport";
import { EXPORT_COLUMNS, ROUNDTRIP_COLUMNS } from "./product-csv-sync";

const { request, download, createUrl, revokeUrl } = vi.hoisted(() => ({ request: vi.fn(), download: vi.fn(), createUrl: vi.fn(), revokeUrl: vi.fn() }));
vi.mock("./auth", () => ({ useAuth: () => ({ request, download }) }));
beforeEach(() => {
  vi.stubGlobal("URL", class extends URL { static createObjectURL = createUrl; static revokeObjectURL = revokeUrl; });
  createUrl.mockReturnValue("blob:products-test");
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});
afterEach(() => {
  document.querySelector(".admin-confirm")?.dispatchEvent(new Event("cancel", { cancelable: true }));
  cleanup(); vi.resetAllMocks(); vi.restoreAllMocks(); vi.unstubAllGlobals();
});
const totals = { created: 0, updated: 1, unchanged: 0, variantsAdded: 0 };
const data = { productId: 7, variantId: 8, stock: 0, expectedStock: 5, expectedUpdatedAt: "2026-10-17T12:00:00.123Z" };
const preview = () => ({ rows: [{ line: 2, action: "update", data: { ...data }, changes: [{ field: "stock", before: 5, after: 0 }] }], totals: { ...totals } });
const source = "variantId,stock\n8,0";
async function file(value = source, reading = Promise.resolve(value)) {
  const selected = new File([value], "products.csv", { type: "text/csv" });
  Object.defineProperty(selected, "text", { value: () => reading });
  await act(async () => fireEvent.change(screen.getByLabelText("فایل CSV"), { target: { files: [selected] } }));
}
function mount() { const onSynced = vi.fn(); render(<ProductCsvSync onBack={vi.fn()} onSynced={onSynced} />); return onSynced; }
async function review() { await file(); fireEvent.click(screen.getByRole("button", { name: "بررسی تغییرات" })); await screen.findByRole("heading", { name: "پیش‌نمایش تغییرات" }); }
async function confirm() {
  fireEvent.click(screen.getByRole("button", { name: "تأیید و ثبت تغییرات" }));
  const button = within(await screen.findByRole("dialog")).getByRole("button", { name: "ثبت تغییرات CSV" });
  fireEvent.click(button); return button;
}
it("previews without mutation, shows before/after, cancels safely and applies only server-normalized identities/snapshots once", async () => {
  let finish: ((value: unknown) => void) | undefined;
  request.mockImplementation((path: string) => path.endsWith("/preview") ? Promise.resolve(preview()) : new Promise(resolve => { finish = resolve; }));
  const onSynced = mount(); await review();
  expect(request).toHaveBeenCalledExactlyOnceWith("/admin/products/sync/preview", { method: "POST", body: { rows: [{ variantId: 8, stock: 0 }] }, timeoutMs: 70_000 });
  expect(screen.queryByRole("dialog")).toBeNull(); expect(screen.getByText("موجودی")).toBeTruthy();
  expect(screen.getByText("۵")).toBeTruthy(); expect(screen.getByRole("heading", { name: "پیش‌نمایش تغییرات" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "تأیید و ثبت تغییرات" }));
  fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "بازگشت" }));
  await waitFor(() => expect((screen.getByRole("button", { name: "تأیید و ثبت تغییرات" }) as HTMLButtonElement).disabled).toBe(false));
  expect(request).toHaveBeenCalledTimes(1);
  const accepted = await confirm(); fireEvent.click(accepted);
  await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  expect(request).toHaveBeenLastCalledWith("/admin/products/sync", { method: "POST", body: { rows: [data] }, timeoutMs: 70_000 });
  expect(screen.queryByRole("button", { name: "تأیید و ثبت تغییرات" })).toBeNull();
  expect((screen.getByLabelText("فایل CSV") as HTMLInputElement).disabled).toBe(true);
  await act(async () => finish?.(totals));
  expect(await screen.findByText("تغییرات ثبت شد.")).toBeTruthy(); expect(onSynced).toHaveBeenCalledOnce();
  fireEvent.submit(screen.getByLabelText("فایل CSV").closest("form")!);
  expect(request).toHaveBeenCalledTimes(2);
});
it("recognizes a price file, says what it will not touch and names skipped rows", async () => {
  mount(); await file("sku,name,price\nSKU-1,غذای گربه,1200\n,بدون گزینه,\nSKU-2,غذای سگ,0");
  expect(screen.getByText(/این فایل قیمت‌محور است/)).toBeTruthy();
  expect(screen.getByText(/۱ ردیف بدون گزینه و بدون قیمت نادیده گرفته شد/)).toBeTruthy();
  expect((screen.getByRole("button", { name: "بررسی تغییرات" }) as HTMLButtonElement).disabled).toBe(false);
});
it("keeps the file label on price preview rows and explains an unknown SKU instead of quoting a creation error", async () => {
  request.mockImplementation((path: string) => path.endsWith("/preview")
    ? Promise.resolve({ rows: [2, 3, 4].map(line => ({ line, action: "update", data: { sku: `SKU-${line}`, price: 1200 + line }, changes: [{ field: "price", before: 1000, after: 1200 + line }] })), totals: { ...totals, updated: 3 } })
    : Promise.reject(new Error("ردیف ۳: محصول جدید به نام، قیمت، برند، دسته‌بندی و نوع حیوان نیاز دارد")));
  mount(); await file("sku,name,price\nSKU-1,غذای گربه,1200\nSKU-9,غذای تازه,900\nSKU-3,غذای سگ,800");
  fireEvent.click(screen.getByRole("button", { name: "بررسی تغییرات" }));
  await screen.findByRole("heading", { name: "پیش‌نمایش تغییرات" });
  expect(screen.getByText("غذای گربه")).toBeTruthy();
  await confirm();
  expect(await screen.findByText(/SKU «SKU-9»/)).toBeTruthy();
  expect(screen.queryByText(/محصول جدید به نام/)).toBeNull();
});
it("guards same-tick preview requests and rejects malformed responses instead of enabling apply", async () => {
  let finish: ((value: unknown) => void) | undefined;
  request.mockReturnValue(new Promise(resolve => { finish = resolve; })); mount(); await file();
  const form = screen.getByLabelText("فایل CSV").closest("form")!;
  fireEvent.submit(form); fireEvent.submit(form); expect(request).toHaveBeenCalledOnce();
  await act(async () => finish?.({ ...preview(), totals: { ...totals, updated: 2 } }));
  expect((await screen.findByRole("alert")).textContent).toContain("پاسخ بررسی معتبر نیست");
  expect(screen.queryByRole("button", { name: "تأیید و ثبت تغییرات" })).toBeNull();
});
it("drops stale preview after a conflict and requires a new server review before any retry", async () => {
  request.mockImplementation((path: string) => path.endsWith("/preview") ? Promise.resolve(preview()) : Promise.reject(new Error("موجودی تغییر کرده است")));
  const onSynced = mount(); await review(); await confirm();
  expect((await screen.findByRole("alert")).textContent).toContain("پیش‌نمایش تازه");
  expect(screen.queryByRole("heading", { name: "پیش‌نمایش تغییرات" })).toBeNull();
  expect(onSynced).not.toHaveBeenCalled(); expect(request).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole("button", { name: "بررسی تغییرات" }));
  await screen.findByRole("heading", { name: "پیش‌نمایش تغییرات" });
  expect(request).toHaveBeenCalledTimes(3);
});
it("shows the conflicted rows and the preserved live values instead of a bare conflict message", async () => {
  const { ApiError } = await import("./api/client");
  request.mockImplementation((path: string) => path.endsWith("/preview")
    ? Promise.resolve({ ...preview(), notes: [{ line: 3, field: "stock", variant: "SKU-2", message: "موجودی فعلی حفظ شد" }] })
    : Promise.reject(new ApiError("موجودی یا اطلاعات محصول تغییر کرده است", 409, "CONFLICT", [
      { line: 3, product: "غذای سگ", variant: "SKU-2", field: "stock", message: "موجودی از ۵ به ۴ رسیده است" },
    ])));
  mount(); await review();
  expect(screen.getByRole("heading", { name: "مقدارهایی که بازنویسی نشدند" })).toBeTruthy();
  expect(screen.getByText(/موجودی فعلی حفظ شد/)).toBeTruthy();
  await confirm();
  expect(await screen.findByRole("heading", { name: "هیچ تغییری ثبت نشد — ردیف‌های مانع" })).toBeTruthy();
  expect(screen.getByText("هیچ تغییری اعمال نشد.")).toBeTruthy();
  expect(screen.getByText(/موجودی از ۵ به ۴ رسیده است/)).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "پیش‌نمایش تغییرات" })).toBeNull();
});
it("does not post invalid local rows and ignores an older file read after replacement", async () => {
  mount(); await file("variantId,stock\n8,-1");
  expect((screen.getByRole("button", { name: "بررسی تغییرات" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.submit(screen.getByLabelText("فایل CSV").closest("form")!); expect(request).not.toHaveBeenCalled();
  let finish!: (value: string) => void;
  await file("old", new Promise(resolve => { finish = resolve; }));
  await file(source);
  await act(async () => finish("unknown\nold"));
  expect((screen.getByRole("button", { name: "بررسی تغییرات" }) as HTMLButtonElement).disabled).toBe(false);
});
it("ignores an apply response after unmount instead of refreshing another admin screen", async () => {
  let finish: ((value: unknown) => void) | undefined;
  request.mockImplementation((path: string) => path.endsWith("/preview") ? Promise.resolve(preview()) : new Promise(resolve => { finish = resolve; }));
  const onSynced = vi.fn(); const screenRoot = render(<ProductCsvSync onBack={vi.fn()} onSynced={onSynced} />);
  await review(); await confirm(); await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  screenRoot.unmount(); await act(async () => finish?.(totals)); expect(onSynced).not.toHaveBeenCalled();
});
it("keeps round-trip identifiers checked, exports all selected columns through authenticated filters and cleans the Blob URL", async () => {
  download.mockResolvedValue(new Blob(["csvEncoding,sku\r\n"], { type: "text/csv" }));
  const rendered = render(<ProductCsvExport filters={{ search: "غذا", isActive: false }} onBack={vi.fn()} />);
  expect((screen.getByRole("checkbox", { name: "شناسهٔ محصول" }) as HTMLInputElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("checkbox", { name: "همهٔ ستون‌ها" }));
  fireEvent.click(screen.getByRole("button", { name: "دریافت CSV" }));
  await screen.findByText("فایل خروجی آماده شد.");
  expect(download).toHaveBeenCalledExactlyOnceWith(expect.any(String), { timeoutMs: 70_000 }); const query = new URLSearchParams(download.mock.calls[0]![0].split("?")[1]);
  expect(query.get("columns")?.split(",")).toEqual(EXPORT_COLUMNS); expect(query.get("search")).toBe("غذا"); expect(query.get("isActive")).toBe("false");
  expect(query.has("page")).toBe(false); expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce();
  rendered.unmount(); expect(revokeUrl).toHaveBeenCalledExactlyOnceWith("blob:products-test"); expect(request).not.toHaveBeenCalled();
});
it("offers a one-click price file that skips stock and version columns", async () => {
  download.mockResolvedValue(new Blob(["sku,name,price,compareAtPrice"]));
  render(<ProductCsvExport filters={{ search: "غذا" }} onBack={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "دریافت فایل قیمت" }));
  await waitFor(() => expect(download).toHaveBeenCalledOnce());
  const query = new URLSearchParams(download.mock.calls[0]![0].split("?")[1]);
  expect(query.get("columns")).toBe("sku,name,price,compareAtPrice");
  expect(query.get("search")).toBe("غذا");
  expect((screen.getByRole("status").textContent)).toContain("فایل خروجی آماده شد");
});
it("supports arbitrary report subsets without silently readding hidden columns and does not download an empty selection", async () => {
  download.mockResolvedValue(new Blob(["report"])); render(<ProductCsvExport filters={{}} onBack={vi.fn()} />);
  expect((screen.getByRole("checkbox", { name: "قیمت (تومان)" }) as HTMLInputElement).checked).toBe(true);
  fireEvent.click(screen.getByRole("checkbox", { name: "حفظ شناسه‌ها و نسخه برای ورود مجدد" }));
  for (const key of [...ROUNDTRIP_COLUMNS, "price"]) {
    const names: Record<string, string> = { productId: "شناسهٔ محصول", variantId: "شناسهٔ گزینه", sku: "شناسهٔ کالا (SKU)", stock: "موجودی", expectedStock: "موجودی هنگام خروجی", expectedUpdatedAt: "زمان نسخهٔ محصول", price: "قیمت (تومان)" };
    fireEvent.click(screen.getByRole("checkbox", { name: names[key] }));
  }
  expect((screen.getByRole("button", { name: "دریافت CSV" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("checkbox", { name: "نام محصول" }));
  fireEvent.click(screen.getByRole("button", { name: "دریافت CSV" }));
  await waitFor(() => expect(download).toHaveBeenCalledOnce());
  expect(new URLSearchParams(download.mock.calls[0]![0].split("?")[1]).get("columns")).toBe("name");
});
it("guards duplicate export requests, reports failures and never claims a download after unmount", async () => {
  let finish: ((value: Blob) => void) | undefined;
  download.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const rendered = render(<ProductCsvExport filters={{}} onBack={vi.fn()} />);
  const button = screen.getByRole("button", { name: "دریافت CSV" }); fireEvent.click(button); fireEvent.click(button);
  expect(download).toHaveBeenCalledOnce(); rendered.unmount();
  await act(async () => finish?.(new Blob(["csv"]))); expect(createUrl).not.toHaveBeenCalled();
  download.mockRejectedValue(new Error("بیش از ۵۰۰ ردیف")); render(<ProductCsvExport filters={{}} onBack={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "دریافت CSV" }));
  expect((await screen.findByRole("alert")).textContent).toContain("۵۰۰"); expect(createUrl).not.toHaveBeenCalled();
});
