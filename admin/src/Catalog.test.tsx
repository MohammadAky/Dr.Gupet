// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Catalog } from "./Catalog";

const { requestMock } = vi.hoisted(() => ({ requestMock: vi.fn() }));
vi.mock("./auth", () => ({ useAuth: () => ({ request: requestMock }) }));

afterEach(() => {
  cleanup();
  requestMock.mockReset();
});

function page(name = "محصول ثبت‌شده", currentPage = 1) {
  return {
    data: [{ id: currentPage, name, slug: "test-product", isActive: true, minPrice: 1000, totalStock: 2 }],
    meta: { page: currentPage, limit: 12, total: 24, totalPages: 2 },
  };
}

it("keeps product and reference editors unavailable until their reference data is ready", async () => {
  let resolveBrands: ((value: unknown) => void) | undefined;
  requestMock.mockImplementation((path: string) => {
    if (path.startsWith("/admin/products?")) return Promise.resolve(page());
    if (path === "/admin/brands") return new Promise(resolve => { resolveBrands = resolve; });
    return Promise.resolve([]);
  });
  render(<Catalog />);
  const create = screen.getByRole("button", { name: "+ ثبت محصول" }) as HTMLButtonElement;
  const references = screen.getByRole("button", { name: "داده‌های مرجع" }) as HTMLButtonElement;
  expect(create.disabled).toBe(true);
  expect(references.disabled).toBe(true);
  expect(screen.getByText("در حال دریافت داده‌های مرجع…")).toBeTruthy();
  await waitFor(() => expect(resolveBrands).toBeTypeOf("function"));
  await act(async () => { resolveBrands?.([]); });
  expect(create.disabled).toBe(false);
  expect(references.disabled).toBe(false);
  fireEvent.click(create);
  expect(screen.getByRole("heading", { name: "ثبت محصول" })).toBeTruthy();
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
