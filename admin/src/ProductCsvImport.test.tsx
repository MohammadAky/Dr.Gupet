// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ProductCsvImport } from "./ProductCsvImport";
import { ApiError } from "./api/client";
import { PRODUCT_CSV_TEMPLATE_COLUMNS, reviewProductCsv } from "./product-csv";
import { useDraftProtection } from "./management";
const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("./auth", () => ({ useAuth: () => ({ request }) }));
const refs = { brands: [{ id: 2, name: "برند", isActive: true }], petTypes: [{ id: 3, name: "گربه", isActive: true }, { id: 4, name: "سگ", isActive: true }], categories: [{ id: 5, name: "غذای گربه", petTypeId: 3, isActive: true }, { id: 6, name: "غذای سگ", petTypeId: 4, isActive: true }, { id: 7, name: "غیرفعال", isActive: false }], breeds: [], tags: [] };
afterEach(() => { cleanup(); vi.resetAllMocks(); document.querySelectorAll(".admin-confirm").forEach(dialog => dialog.remove()); });
function mount() { const onImported = vi.fn(); render(<ProductCsvImport refs={refs} onBack={vi.fn()} onImported={onImported} />); return onImported; }
function chooseReferences() {
  fireEvent.change(screen.getByLabelText("نوع حیوان"), { target: { value: "3" } });
  fireEvent.change(screen.getByLabelText("برند"), { target: { value: "2" } });
  fireEvent.change(screen.getByLabelText("دسته‌بندی"), { target: { value: "5" } });
}
async function file(source: string, read = Promise.resolve(source)) {
  const selected = new File([source], "products.csv", { type: "text/csv" });
  Object.defineProperty(selected, "text", { value: () => read });
  await act(async () => fireEvent.change(screen.getByLabelText("فایل محصولات"), { target: { files: [selected] } }));
}
it("downloads a UTF-8 template with a safe unpublished default and no importable example product", () => {
  mount(); const link = screen.getByRole("link", { name: "دریافت قالب CSV" });
  expect(link.getAttribute("download")).toBe("product-import-template.csv");
  const source = decodeURIComponent(link.getAttribute("href")!.split(",").slice(1).join(","));
  expect(source.startsWith("\uFEFF")).toBe(true);
  expect(source.replace(/^\uFEFF/, "").trim().split(/\r?\n/)).toEqual([PRODUCT_CSV_TEMPLATE_COLUMNS.join(","), ",,,,,,,,,,,,F"]);
  const review = reviewProductCsv(source);
  expect(review.errors).toEqual([]);
  expect(review.rows[0]?.data).toBeUndefined();
  expect(review.rows[0]?.errors.join(" ")).toContain("نام");
  expect(review.rows[0]?.errors.join(" ")).not.toContain("نمایش");
  expect(request).not.toHaveBeenCalled();
});
it("previews each T/F publication choice and submits exact boolean values without changing numeric validation", async () => {
  const onImported = mount(); chooseReferences();
  await file("name,price,stock,weightGram,نمایش\nغذای گربه,100,2,500,T\nخوراک گربه,0,,,f");
  const table = screen.getByRole("table");
  expect(within(table).getByRole("columnheader", { name: "نمایش" })).toBeTruthy();
  expect((within(table).getByLabelText("نمایش ردیف ۲") as HTMLSelectElement).value).toBe("T");
  expect((within(table).getByLabelText("نمایش ردیف ۳") as HTMLSelectElement).value).toBe("F");
  request.mockResolvedValue({ imported: 2, products: [{ id: 10, name: "غذای گربه", slug: "cat" }, { id: 11, name: "غذای سگ", slug: "dog" }] });
  fireEvent.click(screen.getByRole("button", { name: "بررسی و ثبت محصولات" }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "تأیید ورود محصولات" }));
  await waitFor(() => expect(onImported).toHaveBeenCalledOnce());
  expect(request).toHaveBeenCalledWith("/admin/products/import", { method: "POST", body: { brandId: 2, categoryId: 5, petTypeId: 3, rows: [
    { name: "غذای گربه", price: 100, stock: 2, weightGram: 500, compareAtPrice: 0, isActive: true },
    { name: "خوراک گربه", price: 0, stock: 0, weightGram: 0, compareAtPrice: 0, isActive: false },
  ] } });
});
it("imports mixed fully referenced rows without requiring any shared selectors", async () => {
  const onImported = mount();
  await file("name,price,brandId,categoryId,petTypeId,نمایش\nغذای گربه,1,2,5,3,F\nغذای سگ,2,2,6,4,F");
  expect((screen.getByLabelText("برند") as HTMLSelectElement).value).toBe("");
  expect((screen.getByRole("button", { name: "بررسی و ثبت محصولات" }) as HTMLButtonElement).disabled).toBe(false);
  request.mockResolvedValue({ imported: 2, products: [{ id: 10, name: "غذای گربه", slug: "cat" }, { id: 11, name: "غذای سگ", slug: "dog" }] });
  fireEvent.click(screen.getByRole("button", { name: "بررسی و ثبت محصولات" }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "تأیید ورود محصولات" }));
  await waitFor(() => expect(onImported).toHaveBeenCalledOnce());
  expect(request).toHaveBeenCalledWith("/admin/products/import", { method: "POST", body: { rows: [
    { name: "غذای گربه", price: 1, stock: 0, weightGram: 0, compareAtPrice: 0, isActive: false, brandId: 2, categoryId: 5, petTypeId: 3 },
    { name: "غذای سگ", price: 2, stock: 0, weightGram: 0, compareAtPrice: 0, isActive: false, brandId: 2, categoryId: 6, petTypeId: 4 },
  ] } });
});
it("keeps suggested references editable and requires a real weight before publishing a sample-shaped active row", async () => {
  mount(); await file("name,price,isActive\nغذای خشک گربه جوسرا,1,true");
  expect((screen.getByLabelText("برند ردیف ۲") as HTMLInputElement).value).toBe("جوسرا");
  expect((screen.getByLabelText("دسته‌بندی ردیف ۲") as HTMLInputElement).value).toBe("غذای خشک");
  expect((screen.getByLabelText("نوع حیوان ردیف ۲") as HTMLSelectElement).value).toBe("3");
  expect((screen.getByLabelText("وزن ردیف ۲ (گرم)") as HTMLInputElement).value).toBe("");
  expect((screen.getByLabelText("نمایش ردیف ۲") as HTMLSelectElement).value).toBe("T");
  expect((screen.getByRole("button", { name: "بررسی و ثبت محصولات" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText("وزن ردیف ۲ (گرم)"), { target: { value: "750" } });
  fireEvent.change(screen.getByLabelText("برند ردیف ۲"), { target: { value: "برند" } });
  fireEvent.change(screen.getByLabelText("دسته‌بندی ردیف ۲"), { target: { value: "غذای گربه" } });
  expect((screen.getByRole("button", { name: "بررسی و ثبت محصولات" }) as HTMLButtonElement).disabled).toBe(false);
  request.mockResolvedValue({ imported: 1, products: [{ id: 10, name: "غذا", slug: "food" }] });
  fireEvent.click(screen.getByRole("button", { name: "بررسی و ثبت محصولات" }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "تأیید ورود محصولات" }));
  await waitFor(() => expect(request).toHaveBeenCalledOnce());
  expect(request).toHaveBeenCalledWith("/admin/products/import", { method: "POST", body: { rows: [
    { name: "غذای خشک گربه جوسرا", price: 1, stock: 0, weightGram: 750, compareAtPrice: 0, isActive: true, brandId: 2, categoryId: 5, petTypeId: 3 },
  ] } });
});
it("leaves ambiguous species manual and allows an explicit F edit without inventing a weight", async () => {
  mount(); await file("name,price,isActive\nدستکش پرزگیر سگ و گربه,1,T");
  expect((screen.getByLabelText("نوع حیوان ردیف ۲") as HTMLSelectElement).value).toBe("");
  expect((screen.getByLabelText("برند ردیف ۲") as HTMLInputElement).value).toBe("");
  expect((screen.getByRole("button", { name: "بررسی و ثبت محصولات" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText("برند ردیف ۲"), { target: { value: "تولیدکننده تازه" } });
  fireEvent.change(screen.getByLabelText("نوع حیوان ردیف ۲"), { target: { value: "4" } });
  fireEvent.change(screen.getByLabelText("نمایش ردیف ۲"), { target: { value: "F" } });
  expect((screen.getByLabelText("وزن ردیف ۲ (گرم)") as HTMLInputElement).value).toBe("");
  expect((screen.getByRole("button", { name: "بررسی و ثبت محصولات" }) as HTMLButtonElement).disabled).toBe(false);
  expect(screen.getByRole("table").textContent).toContain("هنگام ثبت ساخته می‌شود");
  expect(request).not.toHaveBeenCalled();
});
it("lets clear row suggestions override shared defaults even when defaults were selected before upload", async () => {
  mount(); chooseReferences();
  await file("name,price,weightGram,نمایش\nغذای خشک سگ ونپی,10,500,F");
  expect((screen.getByLabelText("برند ردیف ۲") as HTMLInputElement).value).toBe("ونپی");
  expect((screen.getByLabelText("نوع حیوان ردیف ۲") as HTMLSelectElement).value).toBe("4");
  expect((screen.getByLabelText("دسته‌بندی ردیف ۲") as HTMLInputElement).value).toContain("غذای خشک");
  expect((screen.getByRole("button", { name: "بررسی و ثبت محصولات" }) as HTMLButtonElement).disabled).toBe(false);
  request.mockResolvedValue({ imported: 1, products: [{ id: 10, name: "غذا", slug: "food" }] });
  fireEvent.click(screen.getByRole("button", { name: "بررسی و ثبت محصولات" }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "تأیید ورود محصولات" }));
  await waitFor(() => expect(request).toHaveBeenCalledOnce());
  const imported = request.mock.calls[0]![1].body;
  expect(imported.rows[0]).toMatchObject({ brandName: "ونپی", petTypeId: 4, isActive: false, weightGram: 500 });
  expect(imported.rows[0]).not.toHaveProperty("brandId");
  expect(imported.rows[0]).not.toHaveProperty("categoryId");
});
it("does not resolve a multiple-species row through a shared animal default", async () => {
  mount(); chooseReferences();
  await file("name,price,نمایش\nدستکش پرزگیر سگ و گربه,1,F");
  expect((screen.getByLabelText("نوع حیوان ردیف ۲") as HTMLSelectElement).value).toBe("");
  expect((screen.getByRole("button", { name: "بررسی و ثبت محصولات" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText("نوع حیوان ردیف ۲"), { target: { value: "3" } });
  expect((screen.getByRole("button", { name: "بررسی و ثبت محصولات" }) as HTMLButtonElement).disabled).toBe(false);
});
it("previews genuine zero/defaults and only writes one complete raw-Toman batch after explicit confirmation", async () => {
  const onImported = mount(); chooseReferences(); await file("name,price\nغذای گربه,۰\nخوراک گربه,۲۵۰۰۰۰");
  expect(request).not.toHaveBeenCalled(); expect(screen.getByRole("table")).toBeTruthy();
  request.mockResolvedValue({ imported: 2, products: [{ id: 10, name: "غذای گربه", slug: "غذای-گربه" }, { id: 11, name: "غذای سگ", slug: "غذای-سگ" }] });
  fireEvent.click(screen.getByRole("button", { name: "بررسی و ثبت محصولات" }));
  expect(request).not.toHaveBeenCalled();
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "تأیید ورود محصولات" }));
  await waitFor(() => expect(onImported).toHaveBeenCalledTimes(1));
  expect(request).toHaveBeenCalledTimes(1);
  expect(request).toHaveBeenCalledWith("/admin/products/import", { method: "POST", body: { brandId: 2, categoryId: 5, petTypeId: 3, rows: [
    { name: "غذای گربه", price: 0, stock: 0, weightGram: 0, compareAtPrice: 0, isActive: false },
    { name: "خوراک گربه", price: 250000, stock: 0, weightGram: 0, compareAtPrice: 0, isActive: false },
  ] } });
  expect(screen.queryByRole("button", { name: "بررسی و ثبت محصولات" })).toBeNull();
});
it("does not import on cancel and keeps preview after a recoverable duplicate/server rejection", async () => {
  mount(); chooseReferences(); await file("name,price\nغذای گربه,100");
  fireEvent.click(screen.getByRole("button", { name: "بررسی و ثبت محصولات" }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "بازگشت" }));
  await waitFor(() => expect((screen.getByRole("button", { name: "بررسی و ثبت محصولات" }) as HTMLButtonElement).disabled).toBe(false));
  expect(request).not.toHaveBeenCalled();
  request.mockRejectedValue(new ApiError("ردیف ۲: نشانی تکراری است", 409, "CONFLICT"));
  fireEvent.click(screen.getByRole("button", { name: "بررسی و ثبت محصولات" }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "تأیید ورود محصولات" }));
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("ردیف ۲"));
  expect(screen.getByRole("table")).toBeTruthy(); expect(request).toHaveBeenCalledTimes(1);
});
it("requires compatible real references and blocks any invalid row without partial writes", async () => {
  mount(); await file('name,price\nغذای گربه,10\nغذای سگ,"1,5"');
  expect((screen.getByRole("button", { name: "بررسی و ثبت محصولات" }) as HTMLButtonElement).disabled).toBe(true);
  chooseReferences();
  expect(screen.queryByRole("option", { name: "غذای سگ" })).toBeNull();
  expect(screen.queryByRole("option", { name: "غیرفعال" })).toBeNull();
  expect((screen.getByRole("button", { name: "بررسی و ثبت محصولات" }) as HTMLButtonElement).disabled).toBe(true);
  await file("name,price\nغذای گربه,10");
  expect((screen.getByRole("button", { name: "بررسی و ثبت محصولات" }) as HTMLButtonElement).disabled).toBe(false);
  fireEvent.change(screen.getByLabelText("نوع حیوان"), { target: { value: "4" } });
  expect((screen.getByLabelText("دسته‌بندی") as HTMLSelectElement).value).toBe("");
  expect((screen.getByRole("button", { name: "بررسی و ثبت محصولات" }) as HTMLButtonElement).disabled).toBe(true);
  expect(request).not.toHaveBeenCalled();
});
it("blocks normalized JSON payloads above 90KiB before they hit the default API body limit", async () => {
  mount(); chooseReferences(); await file("name,price,description\n" + Array.from({ length: 10 }, (_, index) => `غذای گربه ${index},10,${"ی".repeat(4700)}`).join("\n"));
  expect(screen.getByRole("alert").textContent).toContain("چند فایل");
  expect((screen.getByRole("button", { name: "بررسی و ثبت محصولات" }) as HTMLButtonElement).disabled).toBe(true);
  expect(request).not.toHaveBeenCalled();
});
it("ignores an older slow file read when another file is selected", async () => {
  mount(); let resolve: (source: string) => void = () => {};
  const delayed = new Promise<string>(done => { resolve = done; });
  await file("name,price\nقدیمی,10", delayed);
  await file("name,price\nجدید,20");
  await act(async () => resolve("name,price\nقدیمی,10"));
  expect(screen.getByRole("table").textContent).toContain("جدید");
  expect(screen.getByRole("table").textContent).not.toContain("قدیمی");
  expect(request).not.toHaveBeenCalled();
});
it("preserves the existing unsaved-draft confirmation when leaving a CSV preview", async () => {
  const onBack = vi.fn();
  function GuardedImport() { useDraftProtection(); return <ProductCsvImport refs={refs} onBack={onBack} onImported={vi.fn()} />; }
  render(<GuardedImport />); await file("name,price\nغذای گربه,10");
  fireEvent.click(screen.getByRole("button", { name: "بازگشت به محصولات" }));
  expect(onBack).not.toHaveBeenCalled();
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "بازگشت" }));
  await act(async () => {}); expect(screen.getByRole("table")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "بازگشت به محصولات" }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "کنار گذاشتن تغییرها" }));
  await waitFor(() => expect(onBack).toHaveBeenCalledTimes(1));
  expect(request).not.toHaveBeenCalled();
});
