// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Catalog } from "./Catalog";

const { requestMock } = vi.hoisted(() => ({ requestMock: vi.fn() }));
vi.mock("./auth", () => ({ useAuth: () => ({ request: requestMock }) }));

afterEach(() => {
  document.querySelector(".admin-confirm")?.dispatchEvent(new Event("cancel", { cancelable: true }));
  cleanup();
  requestMock.mockReset();
});

function page(name = "محصول ثبت‌شده", currentPage = 1) {
  return {
    data: [{ id: currentPage, name, slug: "test-product", isActive: true, minPrice: 1000, totalStock: 2 }],
    meta: { page: currentPage, limit: 12, total: 24, totalPages: 2 },
  };
}

function productDeletes() {
  return requestMock.mock.calls.filter(([path, options]) => /^\/admin\/products\/\d+$/.test(path) && options?.method === "DELETE");
}

it("names the product and deletion consequences, then cancels without writing", async () => {
  requestMock.mockImplementation((path: string) => path.startsWith("/admin/products?") ? Promise.resolve(page()) : Promise.resolve([]));
  render(<Catalog />);
  const remove = await screen.findByRole("button", { name: "حذف محصول ثبت‌شده" });
  fireEvent.click(remove); fireEvent.click(remove);
  const dialog = await screen.findByRole("dialog", { name: "حذف محصول" });
  expect(within(dialog).getByText(/محصول «محصول ثبت‌شده» حذف می‌شود/)).toBeTruthy();
  expect(dialog.textContent).toContain("اگر در سفارش استفاده شده باشد، فقط غیرفعال می‌شود");
  fireEvent.click(within(dialog).getByRole("button", { name: "بازگشت" }));
  await waitFor(() => expect((remove as HTMLButtonElement).disabled).toBe(false));
  expect(productDeletes()).toHaveLength(0);
  expect(screen.getByText("محصول ثبت‌شده")).toBeTruthy();
});

it("sends one confirmed row DELETE and refetches the list while duplicate actions are blocked", async () => {
  let resolveDelete: ((value: unknown) => void) | undefined;
  let listReads = 0;
  requestMock.mockImplementation((path: string, options?: { method?: string }) => {
    if (path.startsWith("/admin/products?")) {
      listReads += 1;
      return Promise.resolve(listReads === 1 ? page() : { data: [], meta: { page: 1, limit: 12, total: 0, totalPages: 1 } });
    }
    if (path === "/admin/products/1" && options?.method === "DELETE")
      return new Promise(resolve => { resolveDelete = resolve; });
    return Promise.resolve([]);
  });
  render(<Catalog />);
  const remove = await screen.findByRole("button", { name: "حذف محصول ثبت‌شده" });
  fireEvent.click(remove);
  const confirm = within(await screen.findByRole("dialog")).getByRole("button", { name: "حذف محصول" });
  fireEvent.click(confirm); fireEvent.click(confirm);
  await waitFor(() => expect(productDeletes()).toHaveLength(1));
  expect(requestMock).toHaveBeenCalledWith("/admin/products/1", { method: "DELETE" });
  expect((remove as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole("button", { name: "مشاهده ←" }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole("button", { name: "بعدی" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(remove);
  expect(productDeletes()).toHaveLength(1);
  await act(async () => { resolveDelete?.({ deleted: true, deactivated: false }); });
  await screen.findByText("محصول «محصول ثبت‌شده» حذف شد.");
  await waitFor(() => expect(listReads).toBe(2));
  expect(screen.queryByRole("button", { name: "حذف محصول ثبت‌شده" })).toBeNull();
});

it("keeps the table visible while refreshing after a confirmed row deletion", async () => {
  let reads = 0; let finishRefresh: ((value: unknown) => void) | undefined;
  const initial = page(); initial.data.push({ ...initial.data[0]!, id: 2, name: "محصول باقی‌مانده" });
  requestMock.mockImplementation((path: string, options?: {method?: string}) => {
    if (path.startsWith("/admin/products?")) return ++reads === 1 ? Promise.resolve(initial) : new Promise(resolve => { finishRefresh = resolve; });
    if (options?.method === "DELETE") return Promise.resolve({deleted: true, deactivated: false});
    return Promise.resolve([]);
  });
  render(<Catalog />);
  fireEvent.click(await screen.findByRole("button", {name: "حذف محصول ثبت‌شده"}));
  fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", {name: "حذف محصول"}));
  await waitFor(() => expect(reads).toBe(2));
  expect(screen.getByText("محصول باقی‌مانده")).toBeTruthy();
  expect(screen.queryByText("در حال دریافت محصولات…")).toBeNull();
  await act(async () => finishRefresh?.({ ...initial, data: [initial.data[1]] }));
  expect(screen.getByText("محصول باقی‌مانده")).toBeTruthy();
});

it("preserves the row and unlocks actions after a row deletion fails", async () => {
  requestMock.mockImplementation((path: string, options?: { method?: string }) => {
    if (path.startsWith("/admin/products?")) return Promise.resolve(page());
    if (path === "/admin/products/1" && options?.method === "DELETE") return Promise.reject(new Error("حذف پذیرفته نشد"));
    return Promise.resolve([]);
  });
  render(<Catalog />);
  const remove = await screen.findByRole("button", { name: "حذف محصول ثبت‌شده" });
  fireEvent.click(remove);
  fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "حذف محصول" }));
  expect((await screen.findByRole("alert")).textContent).toContain("حذف پذیرفته نشد");
  expect(screen.getByText("محصول ثبت‌شده")).toBeTruthy();
  await waitFor(() => expect((remove as HTMLButtonElement).disabled).toBe(false));
  expect(productDeletes()).toHaveLength(1);
  expect(requestMock.mock.calls.filter(([path]) => path.startsWith("/admin/products?"))).toHaveLength(1);
});

it("keeps ordered products as inactive rows and accurately reports deactivation", async () => {
  let inactive = false;
  requestMock.mockImplementation((path: string, options?: { method?: string }) => {
    if (path.startsWith("/admin/products?")) {
      const result = page();
      return Promise.resolve({ ...result, data: result.data.map(row => ({ ...row, isActive: !inactive })) });
    }
    if (path === "/admin/products/1" && options?.method === "DELETE") {
      inactive = true;
      return Promise.resolve({ deleted: false, deactivated: true });
    }
    return Promise.resolve([]);
  });
  render(<Catalog />);
  fireEvent.click(await screen.findByRole("button", { name: "حذف محصول ثبت‌شده" }));
  fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "حذف محصول" }));
  await screen.findByText("محصول «محصول ثبت‌شده» به‌دلیل وابستگی به سفارش، غیرفعال شد.");
  const row = (await screen.findByText("محصول ثبت‌شده")).closest("tr")!;
  expect(within(row).getByText("پیش‌نویس")).toBeTruthy();
  expect(screen.queryByText("محصول «محصول ثبت‌شده» حذف شد.")).toBeNull();
  expect(productDeletes()).toHaveLength(1);
});

it("returns to the previous page after deleting its last product without losing search or active filters", async () => {
  let removed = false;
  requestMock.mockImplementation((path: string, options?: { method?: string }) => {
    if (path.startsWith("/admin/products?")) {
      const pageNumber = Number(new URLSearchParams(path.split("?")[1]).get("page"));
      return Promise.resolve(page(pageNumber === 2 ? "محصول آخر" : "محصول صفحهٔ اول", pageNumber));
    }
    if (path === "/admin/products/2" && options?.method === "DELETE") {
      removed = true;
      return Promise.resolve({ deleted: true, deactivated: false });
    }
    return Promise.resolve([]);
  });
  render(<Catalog />);
  await screen.findByText("محصول صفحهٔ اول");
  fireEvent.change(screen.getByRole("textbox", { name: "جستجوی محصول" }), { target: { value: "غذا" } });
  fireEvent.click(screen.getByRole("button", { name: "جستجو" }));
  fireEvent.click(screen.getByRole("button", { name: "فعال" }));
  await waitFor(() => expect((screen.getByRole("button", { name: "بعدی" }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: "بعدی" }));
  fireEvent.click(await screen.findByRole("button", { name: "حذف محصول آخر" }));
  fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "حذف محصول" }));
  await screen.findByText("محصول «محصول آخر» حذف شد.");
  await screen.findByText("محصول صفحهٔ اول");
  expect(removed).toBe(true);
  expect(requestMock).toHaveBeenLastCalledWith("/admin/products?page=1&limit=12&search=%D8%BA%D8%B0%D8%A7&isActive=true", { withMeta: true });
});

it("keeps product editors unavailable until references are ready and moves reference management outside Catalog", async () => {
  let resolveBrands: ((value: unknown) => void) | undefined;
  requestMock.mockImplementation((path: string) => {
    if (path.startsWith("/admin/products?")) return Promise.resolve(page());
    if (path === "/admin/brands") return new Promise(resolve => { resolveBrands = resolve; });
    return Promise.resolve([]);
  });
  render(<Catalog />);
  const create = screen.getByRole("button", { name: "+ ثبت محصول" }) as HTMLButtonElement;
  expect(create.disabled).toBe(true);
  expect(screen.queryByRole("button", { name: "داده‌های مرجع" })).toBeNull();
  expect((screen.getByRole("button", { name: "ورود از CSV" }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText("در حال دریافت داده‌های مرجع…")).toBeTruthy();
  await waitFor(() => expect(resolveBrands).toBeTypeOf("function"));
  await act(async () => { resolveBrands?.([]); });
  expect(create.disabled).toBe(false);
  fireEvent.click(create);
  expect(screen.getByRole("heading", { name: "ثبت محصول" })).toBeTruthy();
});

it("opens the separate CSV review screen after references are ready without writing products", async () => {
  requestMock.mockImplementation((path: string) => path.startsWith("/admin/products?") ? Promise.resolve(page()) : Promise.resolve([]));
  render(<Catalog />);
  const button = screen.getByRole("button", { name: "ورود از CSV" });
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(button);
  expect(screen.getByRole("heading", { name: "ورود محصولات از CSV" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "دریافت قالب CSV" })).toBeTruthy();
  expect(requestMock.mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "بازگشت به محصولات" }));
  expect(screen.getByRole("heading", { name: "محصولات" })).toBeTruthy();
});

it("opens export with applied filters instead of an unsubmitted search draft and keeps the list context", async () => {
  requestMock.mockImplementation((path: string) => path.startsWith("/admin/products?") ? Promise.resolve(page()) : Promise.resolve([]));
  render(<Catalog />);
  await screen.findByText("محصول ثبت‌شده");
  const search = screen.getByRole("textbox", { name: "جستجوی محصول" });
  fireEvent.change(search, { target: { value: "غذا" } });
  fireEvent.click(screen.getByRole("button", { name: "جستجو" }));
  fireEvent.click(screen.getByRole("button", { name: "فعال" }));
  await waitFor(() => expect(requestMock).toHaveBeenCalledWith(expect.stringContaining("isActive=true"), { withMeta: true }));
  fireEvent.change(search, { target: { value: "جستجوی ثبت‌نشده" } });
  fireEvent.click(screen.getByRole("button", { name: "خروجی CSV" }));
  expect(screen.getByText("جستجو: غذا · فعال")).toBeTruthy();
  expect(screen.getByRole("heading", { name: "خروجی محصولات" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "بازگشت به محصولات" }));
  expect((screen.getByRole("textbox", { name: "جستجوی محصول" }) as HTMLInputElement).value).toBe("جستجوی ثبت‌نشده");
  expect(screen.queryByRole("button", { name: "داده‌های مرجع" })).toBeNull();
});

it("retains sync success while products and references refresh after an accepted batch", async () => {
  let saved = false;
  let resolveBrands: ((value: unknown) => void) | undefined;
  const normalized = { variantId: 8, productId: 7, stock: 0, expectedStock: 5, expectedUpdatedAt: "2026-10-17T12:00:00Z" };
  const totals = { created: 0, updated: 1, unchanged: 0, variantsAdded: 0 };
  requestMock.mockImplementation((path: string) => {
    if (path.startsWith("/admin/products?")) return Promise.resolve(page());
    if (path === "/admin/products/sync/preview") return Promise.resolve({ rows: [{ line: 2, action: "update", data: normalized, changes: [{ field: "stock", before: 5, after: 0 }] }], totals });
    if (path === "/admin/products/sync") { saved = true; return Promise.resolve(totals); }
    if (path === "/admin/brands" && saved) return new Promise(resolve => { resolveBrands = resolve; });
    return Promise.resolve([]);
  });
  render(<Catalog />);
  await screen.findByText("محصول ثبت‌شده");
  fireEvent.click(screen.getByRole("button", { name: "به‌روزرسانی با CSV" }));
  const source = "variantId,stock\n8,0";
  const selected = new File([source], "stock.csv", { type: "text/csv" });
  Object.defineProperty(selected, "text", { value: () => Promise.resolve(source) });
  await act(async () => fireEvent.change(screen.getByLabelText("فایل CSV"), { target: { files: [selected] } }));
  fireEvent.click(screen.getByRole("button", { name: "بررسی تغییرات" }));
  fireEvent.click(await screen.findByRole("button", { name: "تأیید و ثبت تغییرات" }));
  fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "ثبت تغییرات CSV" }));
  await waitFor(() => expect(resolveBrands).toBeTypeOf("function"));
  expect(screen.getByText("تغییرات ثبت شد.")).toBeTruthy();
  expect(requestMock.mock.calls.filter(([path]) => path.startsWith("/admin/products?"))).toHaveLength(2);
  await act(async () => resolveBrands?.([]));
  expect(screen.getByText("تغییرات ثبت شد.")).toBeTruthy();
});

it("refreshes imported brands and categories for the next product editor while retaining import success", async () => {
  let imported = false;
  let resolveBrands: ((value: unknown) => void) | undefined;
  let resolveCategories: ((value: unknown) => void) | undefined;
  const petType = { id: 3, name: "گربه", isActive: true };
  const brand = { id: 8, name: "برند تازه", isActive: true };
  const category = { id: 9, name: "دسته تازه", petTypeId: 3, isActive: true };
  requestMock.mockImplementation((path: string, options?: { method?: string }) => {
    if (path === "/admin/products/import" && options?.method === "POST") {
      imported = true;
      return Promise.resolve({ imported: 1, products: [{ id: 10, name: "محصول واردشده", slug: "imported-product" }] });
    }
    if (path.startsWith("/admin/products?")) return Promise.resolve(page());
    if (path === "/admin/brands") return imported ? new Promise(resolve => { resolveBrands = resolve; }) : Promise.resolve([]);
    if (path === "/admin/categories") return imported ? new Promise(resolve => { resolveCategories = resolve; }) : Promise.resolve([]);
    if (path === "/admin/pet-types") return Promise.resolve([petType]);
    return Promise.resolve([]);
  });
  render(<Catalog />);
  const openImport = screen.getByRole("button", { name: "ورود از CSV" });
  await waitFor(() => expect((openImport as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(openImport);
  const source = "name,price,brandName,categoryName,petTypeId\nمحصول واردشده,100,برند تازه,دسته تازه,3";
  const file = new File([source], "new-references.csv", { type: "text/csv" });
  Object.defineProperty(file, "text", { value: () => Promise.resolve(source) });
  await act(async () => fireEvent.change(screen.getByLabelText("فایل محصولات"), { target: { files: [file] } }));
  const submit = screen.getByRole("button", { name: "بررسی و ثبت محصولات" });
  expect((submit as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(submit);
  fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "تأیید ورود محصولات" }));
  await waitFor(() => expect(resolveBrands).toBeTypeOf("function"));
  expect(screen.getByText("۱ محصول ثبت شد و در فهرست محصولات قابل ویرایش است.")).toBeTruthy();
  expect(requestMock).toHaveBeenCalledWith("/admin/products/import", expect.objectContaining({
    method: "POST", body: { rows: [expect.objectContaining({ brandName: "برند تازه", categoryName: "دسته تازه", petTypeId: 3 })] },
  }));
  await act(async () => { resolveBrands?.([brand]); resolveCategories?.([category]); });
  fireEvent.click(screen.getByRole("button", { name: "بازگشت به محصولات" }));
  fireEvent.click(screen.getByRole("button", { name: "+ ثبت محصول" }));
  fireEvent.change(screen.getByLabelText(/نوع حیوان/), { target: { value: "3" } });
  expect(within(screen.getByLabelText(/^برند/)).getByRole("option", { name: "برند تازه" }).getAttribute("value")).toBe("8");
  expect(within(screen.getByLabelText(/دسته‌بندی/)).getByRole("option", { name: "دسته تازه" }).getAttribute("value")).toBe("9");
  expect(requestMock.mock.calls.filter(([path]) => path === "/admin/brands")).toHaveLength(2);
  expect(requestMock.mock.calls.filter(([path]) => path === "/admin/categories")).toHaveLength(2);
});

it("shows a recoverable reference error instead of opening an incomplete product form", async () => {
  let failed = true;
  requestMock.mockImplementation((path: string) => {
    if (path.startsWith("/admin/products?")) return Promise.resolve(page());
    if (path === "/admin/tags" && failed) return Promise.reject(new Error("خطای دریافت برچسب‌ها"));
    return Promise.resolve([]);
  });
  render(<Catalog />);
  expect(await screen.findByRole("alert")).toBeTruthy();
  const create = screen.getByRole("button", { name: "+ ثبت محصول" }) as HTMLButtonElement;
  expect(create.disabled).toBe(true);
  fireEvent.click(create);
  expect(screen.queryByRole("heading", { name: "ثبت محصول" })).toBeNull();
  failed = false;
  fireEvent.click(screen.getByRole("button", { name: "تلاش دوباره" }));
  await waitFor(() => expect(create.disabled).toBe(false));
  expect(screen.queryByRole("alert")).toBeNull();
});

it("hides stale products and blocks pagination while the next page is pending", async () => {
  let resolveNext: ((value: unknown) => void) | undefined;
  requestMock.mockImplementation((path: string) => {
    if (path.startsWith("/admin/products?")) {
      if (new URLSearchParams(path.split("?")[1]).get("page") === "2")
        return new Promise(resolve => { resolveNext = resolve; });
      return Promise.resolve(page());
    }
    return Promise.resolve([]);
  });
  render(<Catalog />);
  expect(await screen.findByText("محصول ثبت‌شده")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "بعدی" }));
  expect(await screen.findByText("در حال دریافت محصولات…")).toBeTruthy();
  expect(screen.queryByText("محصول ثبت‌شده")).toBeNull();
  expect((screen.getByRole("button", { name: "بعدی" }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole("button", { name: "قبلی" }) as HTMLButtonElement).disabled).toBe(true);
  await act(async () => { resolveNext?.(page("محصول صفحهٔ دوم", 2)); });
  expect(screen.getByText("محصول صفحهٔ دوم")).toBeTruthy();
  expect((screen.getByRole("button", { name: "قبلی" }) as HTMLButtonElement).disabled).toBe(false);
});

function productDetail() {
  const reference = { id: 1, name: "مرجع آزمایشی", isActive: true };
  return {
    ...page().data[0],
    brand: reference,
    category: reference,
    petType: reference,
    lifeStage: "ALL",
    sizeClass: "ALL",
    neuterSuitability: "ANY",
    ingredientsText: null,
    description: null,
    variants: [],
    images: [],
    tags: [],
  };
}

it("focuses the first missing product field and provides Persian associated validation without submitting", async () => {
  requestMock.mockImplementation((path: string) => path.startsWith("/admin/products?") ? Promise.resolve(page()) : Promise.resolve([]));
  render(<Catalog />);
  await waitFor(() => expect((screen.getByRole("button", { name: "+ ثبت محصول" }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: "+ ثبت محصول" }));
  const name = screen.getByPlaceholderText("مثلاً غذای خشک سگ بالغ");
  fireEvent.submit(name.closest("form")!);
  expect(document.activeElement).toBe(name);
  expect(name.getAttribute("aria-invalid")).toBe("true");
  expect(document.getElementById(name.getAttribute("aria-describedby")!)?.textContent).toBe("این فیلد را تکمیل کنید.");
  expect(requestMock.mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
});

it("retries only the detail read after a saved variant cannot be reloaded", async () => {
  let reads = 0;
  let allowReload = false;
  requestMock.mockImplementation((path: string, options?: { method?: string }) => {
    if (path.startsWith("/admin/products?")) return Promise.resolve(page());
    if (path === "/admin/products/1/variants" && options?.method === "POST")
      return Promise.resolve({ id: 9 });
    if (path === "/admin/products/1") {
      reads += 1;
      return reads === 1 || allowReload
        ? Promise.resolve(productDetail())
        : Promise.reject(new TypeError("offline"));
    }
    return Promise.resolve([]);
  });
  render(<Catalog />);
  fireEvent.click(await screen.findByRole("button", { name: "مشاهده ←" }));
  await screen.findByRole("heading", { name: "افزودن واریانت" });
  fireEvent.change(screen.getByRole("textbox", { name: "شناسهٔ کالا (SKU)" }), { target: { value: "LOCAL-VARIANT-1" } });
  fireEvent.change(screen.getByRole("spinbutton", { name: "وزن (گرم)" }), { target: { value: "400" } });
  fireEvent.change(screen.getByRole("textbox", { name: "قیمت (تومان)" }), { target: { value: "123000" } });
  expect((screen.getByRole("textbox", { name: "قیمت (تومان)" }) as HTMLInputElement).value).toBe("۱۲۳٬۰۰۰");
  fireEvent.click(screen.getByRole("button", { name: "افزودن واریانت" }));
  await screen.findByRole("button", { name: "دریافت دوبارهٔ جزئیات" });
  expect(requestMock).toHaveBeenCalledWith("/admin/products/1/variants", expect.objectContaining({ method: "POST", body: expect.objectContaining({ price: 123000 }) }));
  await waitFor(() => expect((screen.getByRole("button", { name: "دریافت دوبارهٔ جزئیات" }) as HTMLButtonElement).disabled).toBe(false));
  expect(screen.getByText("واریانت افزوده شد.")).toBeTruthy();
  expect((screen.getByRole("button", { name: "افزودن واریانت" }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole("textbox", { name: "شناسهٔ کالا (SKU)" }) as HTMLInputElement).value).toBe("");
  fireEvent.click(screen.getByRole("button", { name: "دریافت دوبارهٔ جزئیات" }));
  await waitFor(() => expect(reads).toBe(3));
  await waitFor(() => expect((screen.getByRole("button", { name: "دریافت دوبارهٔ جزئیات" }) as HTMLButtonElement).disabled).toBe(false));
  expect(requestMock.mock.calls.filter(([path, options]) => path === "/admin/products/1/variants" && options?.method === "POST")).toHaveLength(1);
  expect((screen.getByRole("button", { name: "افزودن واریانت" }) as HTMLButtonElement).disabled).toBe(true);
  allowReload = true;
  fireEvent.click(screen.getByRole("button", { name: "دریافت دوبارهٔ جزئیات" }));
  await waitFor(() => expect((screen.getByRole("button", { name: "افزودن واریانت" }) as HTMLButtonElement).disabled).toBe(false));
  expect(screen.queryByRole("alert")).toBeNull();
});

it("clears a successfully attached image and cannot upload it again when reloading fails", async () => {
  let reads = 0;
  requestMock.mockImplementation((path: string, options?: { method?: string }) => {
    if (path.startsWith("/admin/products?")) return Promise.resolve(page());
    if (path === "/upload/image") return Promise.resolve({ url: "/uploads/local-test.webp" });
    if (path === "/admin/products/1/images" && options?.method === "POST") return Promise.resolve({ id: 3 });
    if (path === "/admin/products/1") {
      reads += 1;
      return reads === 1 ? Promise.resolve(productDetail()) : Promise.reject(new TypeError("offline"));
    }
    return Promise.resolve([]);
  });
  render(<Catalog />);
  fireEvent.click(await screen.findByRole("button", { name: "مشاهده ←" }));
  const input = await screen.findByLabelText("افزودن تصویر") as HTMLInputElement;
  fireEvent.change(input, { target: { files: [new File(["local image"], "local-test.webp", { type: "image/webp" })] } });
  fireEvent.click(screen.getByRole("button", { name: "آپلود و ثبت تصویر" }));
  await screen.findByRole("button", { name: "دریافت دوبارهٔ جزئیات" });
  await waitFor(() => expect((screen.getByRole("button", { name: "دریافت دوبارهٔ جزئیات" }) as HTMLButtonElement).disabled).toBe(false));
  expect(screen.getByText("تصویر افزوده شد.")).toBeTruthy();
  expect((screen.getByRole("button", { name: "آپلود و ثبت تصویر" }) as HTMLButtonElement).disabled).toBe(true);
  expect(input.value).toBe("");
  fireEvent.click(screen.getByRole("button", { name: "دریافت دوبارهٔ جزئیات" }));
  await waitFor(() => expect(reads).toBe(3));
  expect(requestMock.mock.calls.filter(([path]) => path === "/upload/image")).toHaveLength(1);
  expect(requestMock.mock.calls.filter(([path, options]) => path === "/admin/products/1/images" && options?.method === "POST")).toHaveLength(1);
});

function galleryDetail(selectedThird = false) {
  return {
    ...productDetail(),
    // Deliberately unsorted: the interface must derive primary/hover from persisted order.
    images: [
      { id: 11, url: "/uploads/third.webp", sortOrder: selectedThird ? 1 : 2 },
      { id: 12, url: "/uploads/primary.webp", sortOrder: 0 },
      { id: 13, url: "/uploads/second.webp", sortOrder: selectedThird ? 2 : 1 },
    ],
  };
}

function galleryImage(filename: string) {
  const image = screen.getAllByRole("img").find(item => (item as HTMLImageElement).src.endsWith(filename));
  expect(image).toBeTruthy();
  return image!.closest(".catalog-image-item") as HTMLElement;
}

function hoverMutations() {
  return requestMock.mock.calls.filter(([path, options]) => path === "/admin/products/1/hover-image" && options?.method === "PATCH");
}

it("protects the primary, locks hover selection while saving and reloading, then reflects persisted image order", async () => {
  let reads = 0;
  let resolveSave: ((value: unknown) => void) | undefined;
  let resolveDetail: ((value: unknown) => void) | undefined;
  requestMock.mockImplementation((path: string, options?: { method?: string }) => {
    if (path.startsWith("/admin/products?")) return Promise.resolve(page());
    if (path === "/admin/products/1/hover-image" && options?.method === "PATCH")
      return new Promise(resolve => { resolveSave = resolve; });
    if (path === "/admin/products/1") {
      reads += 1;
      return reads === 1 ? Promise.resolve(galleryDetail()) : new Promise(resolve => { resolveDetail = resolve; });
    }
    return Promise.resolve([]);
  });
  render(<Catalog />);
  fireEvent.click(await screen.findByRole("button", { name: "مشاهده ←" }));
  await screen.findByText("تصویر اصلی");
  const primary = galleryImage("primary.webp");
  expect(within(primary).getByText("تصویر اصلی")).toBeTruthy();
  expect(within(primary).queryByRole("button", { name: /هاور/ })).toBeNull();
  const current = within(galleryImage("second.webp")).getByRole("button", { name: "عکس هنگام هاور" }) as HTMLButtonElement;
  expect(current.disabled).toBe(true); expect(current.getAttribute("aria-pressed")).toBe("true");
  const select = within(galleryImage("third.webp")).getByRole("button", { name: "انتخاب برای هاور" }) as HTMLButtonElement;
  expect(select.disabled).toBe(false); expect(select.getAttribute("aria-pressed")).toBe("false");
  fireEvent.click(select); fireEvent.click(select);
  expect(select.disabled).toBe(true); expect(hoverMutations()).toHaveLength(1);
  expect(requestMock).toHaveBeenCalledWith("/admin/products/1/hover-image", { method: "PATCH", body: { imageId: 11 } });
  await act(async () => { resolveSave?.({ images: galleryDetail(true).images, hoverImage: "/uploads/third.webp" }); });
  await waitFor(() => expect(resolveDetail).toBeTypeOf("function"));
  expect(select.disabled).toBe(true); expect(reads).toBe(2);
  await act(async () => { resolveDetail?.(galleryDetail(true)); });
  const updated = within(galleryImage("third.webp")).getByRole("button", { name: "عکس هنگام هاور" }) as HTMLButtonElement;
  expect(updated.disabled).toBe(true); expect(updated.getAttribute("aria-pressed")).toBe("true");
  expect((within(galleryImage("second.webp")).getByRole("button", { name: "انتخاب برای هاور" }) as HTMLButtonElement).disabled).toBe(false);
  expect(within(galleryImage("primary.webp")).getByText("تصویر اصلی")).toBeTruthy();
  expect(hoverMutations()).toHaveLength(1);
});

it("retries only the read after a saved hover selection cannot be reloaded", async () => {
  let reads = 0;
  let allowReload = false;
  requestMock.mockImplementation((path: string, options?: { method?: string }) => {
    if (path.startsWith("/admin/products?")) return Promise.resolve(page());
    if (path === "/admin/products/1/hover-image" && options?.method === "PATCH") return Promise.resolve({ hoverImage: "/uploads/third.webp" });
    if (path === "/admin/products/1") {
      reads += 1;
      return reads === 1 ? Promise.resolve(galleryDetail()) : allowReload ? Promise.resolve(galleryDetail(true)) : Promise.reject(new TypeError("offline"));
    }
    return Promise.resolve([]);
  });
  render(<Catalog />);
  fireEvent.click(await screen.findByRole("button", { name: "مشاهده ←" }));
  const select = await screen.findByRole("button", { name: "انتخاب برای هاور" }) as HTMLButtonElement;
  fireEvent.click(select);
  const retry = await screen.findByRole("button", { name: "دریافت دوبارهٔ جزئیات" }) as HTMLButtonElement;
  await waitFor(() => expect(retry.disabled).toBe(false));
  expect(screen.getByText("عکس هنگام هاور ثبت شد؛ تصویر اصلی تغییر نکرد.")).toBeTruthy();
  expect(select.disabled).toBe(true); expect(screen.getByRole("alert")).toBeTruthy();
  fireEvent.click(select); expect(hoverMutations()).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "دریافت دوبارهٔ جزئیات" }));
  await waitFor(() => expect(reads).toBe(3));
  await waitFor(() => expect((screen.getByRole("button", { name: "دریافت دوبارهٔ جزئیات" }) as HTMLButtonElement).disabled).toBe(false));
  expect(select.disabled).toBe(true); expect(hoverMutations()).toHaveLength(1);
  allowReload = true; fireEvent.click(screen.getByRole("button", { name: "دریافت دوبارهٔ جزئیات" }));
  await waitFor(() => expect(within(galleryImage("third.webp")).getByRole("button", { name: "عکس هنگام هاور" }).getAttribute("aria-pressed")).toBe("true"));
  expect(screen.queryByRole("alert")).toBeNull(); expect(hoverMutations()).toHaveLength(1);
});

it("does not claim a saved hover photo when the mutation fails and leaves the current selection intact", async () => {
  requestMock.mockImplementation((path: string, options?: { method?: string }) => {
    if (path.startsWith("/admin/products?")) return Promise.resolve(page());
    if (path === "/admin/products/1") return Promise.resolve(galleryDetail());
    if (path === "/admin/products/1/hover-image" && options?.method === "PATCH") return Promise.reject(new Error("تغییر عکس پذیرفته نشد"));
    return Promise.resolve([]);
  });
  render(<Catalog />); fireEvent.click(await screen.findByRole("button", { name: "مشاهده ←" }));
  const select = await screen.findByRole("button", { name: "انتخاب برای هاور" }) as HTMLButtonElement;
  fireEvent.click(select); await screen.findByRole("alert");
  await waitFor(() => expect(select.disabled).toBe(false));
  expect(screen.queryByText("عکس هنگام هاور ثبت شد؛ تصویر اصلی تغییر نکرد.")).toBeNull();
  expect(within(galleryImage("second.webp")).getByRole("button", { name: "عکس هنگام هاور" }).getAttribute("aria-pressed")).toBe("true");
  expect(requestMock.mock.calls.filter(([path]) => path === "/admin/products/1")).toHaveLength(1);
});
