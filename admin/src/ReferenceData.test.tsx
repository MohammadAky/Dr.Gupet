import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ReferenceData } from "./ReferenceData";
import { hasUnsavedDrafts, useDraftProtection } from "./management";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("./auth", () => ({ useAuth: () => ({ request }) }));

afterEach(() => { cleanup(); request.mockReset(); vi.restoreAllMocks(); });
const paths = ["/admin/brands", "/admin/categories", "/admin/pet-types", "/admin/breeds", "/admin/tags"];
const pet = { id: 3, name: "گربه", isActive: true };

it("replaces a reference image through upload, retains it after save failure and never accepts a typed URL", async () => {
  const brand = { id: 8, name: "برند تصویری", isActive: true, logo: "/uploads/old.webp" };
  let fail = true;
  request.mockImplementation((path: string, options?: { method?: string }) => {
    if (path === "/upload/image") return Promise.resolve({ url: "https://api.example.test/uploads/new.webp" });
    if (options?.method === "PATCH") {
      if (fail) { fail = false; return Promise.reject(new Error("ذخیره انجام نشد")); }
      return Promise.resolve({});
    }
    return Promise.resolve(path === "/admin/brands" ? [brand] : []);
  });
  Object.defineProperty(URL, "createObjectURL", { configurable: true, writable: true, value: vi.fn(() => "blob:reference") });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, writable: true, value: vi.fn() });
  render(<ReferenceData />);
  fireEvent.click(await screen.findByRole("button", { name: /برند تصویری/ }));
  expect(screen.queryByLabelText("نشانی تصویر")).toBeNull();
  expect(screen.getByAltText("پیش‌نمایش تصویر").getAttribute("src")).toContain("/uploads/old.webp");
  fireEvent.change(screen.getByLabelText("تصویر"), { target: { files: [new File(["image"], "new.png", { type: "image/png" })] } });
  expect(screen.getByAltText("پیش‌نمایش تصویر").getAttribute("src")).toBe("blob:reference");
  expect(request.mock.calls.some(([path]) => path === "/upload/image")).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "ذخیرهٔ تغییرات" }));
  await screen.findByText("ذخیره انجام نشد");
  expect(request.mock.calls.filter(([path]) => path === "/upload/image")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "ذخیرهٔ تغییرات" }));
  await screen.findByText("تغییرات ذخیره شد.");
  expect(request.mock.calls.filter(([path]) => path === "/upload/image")).toHaveLength(1);
  expect(request).toHaveBeenCalledWith("/admin/brands/8", { method: "PATCH", body: { name: brand.name, country: null, description: null, logo: "/uploads/new.webp", isActive: true } });
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:reference");
});

it("preserves an existing reference image on ordinary edits and allows explicit removal", async () => {
  const brand = { id: 8, name: "برند تصویری", isActive: true, logo: "/uploads/old.webp" };
  request.mockImplementation((path: string, options?: { method?: string }) => Promise.resolve(options?.method ? {} : path === "/admin/brands" ? [brand] : []));
  function Protected() { useDraftProtection(); return <ReferenceData />; }
  render(<Protected />);
  fireEvent.click(await screen.findByRole("button", { name: /برند تصویری/ }));
  fireEvent.click(screen.getByRole("button", { name: "ذخیرهٔ تغییرات" }));
  await screen.findByText("تغییرات ذخیره شد.");
  expect(request).toHaveBeenCalledWith("/admin/brands/8", { method: "PATCH", body: { name: brand.name, country: null, description: null, logo: brand.logo, isActive: true } });
  fireEvent.click(screen.getByRole("button", { name: "حذف تصویر" }));
  expect(hasUnsavedDrafts()).toBe(true);
  expect(screen.queryByAltText("پیش‌نمایش تصویر")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "ذخیرهٔ تغییرات" }));
  await waitFor(() => expect(request).toHaveBeenCalledWith("/admin/brands/8", { method: "PATCH", body: { name: brand.name, country: null, description: null, logo: null, isActive: true } }));
});

it("opens a standalone reference workspace only after all five authenticated lists arrive", async () => {
  let finish!: (value: unknown) => void;
  request.mockImplementation((path: string) => path === "/admin/brands" ? new Promise(resolve => { finish = resolve; }) : Promise.resolve([]));
  render(<ReferenceData />);
  expect(screen.getByRole("heading", { name: "داده‌های مرجع" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "ثبت مورد تازه" })).toBeNull();
  await waitFor(() => expect(request.mock.calls.map(([path]) => path)).toEqual(paths));
  await act(async () => finish([]));
  expect(screen.getByRole("button", { name: "ثبت مورد تازه" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "بازگشت به محصولات" })).toBeNull();
  const kinds = screen.getByRole("group", { name: "نوع دادهٔ مرجع" });
  expect(within(kinds).getAllByRole("button").map(button => button.textContent)).toEqual(["برندها", "دسته‌بندی‌ها", "نوع حیوان", "نژادها", "برچسب‌ها"]);
});

it("shows a recoverable loading failure without enabling an incomplete editor", async () => {
  let failed = true;
  request.mockImplementation((path: string) => path === "/admin/tags" && failed ? Promise.reject(new Error("دریافت برچسب‌ها انجام نشد")) : Promise.resolve([]));
  render(<ReferenceData />);
  expect((await screen.findByRole("alert")).textContent).toContain("دریافت برچسب‌ها");
  expect(screen.queryByRole("button", { name: "ثبت مورد تازه" })).toBeNull();
  failed = false;
  fireEvent.click(screen.getByRole("button", { name: "تلاش دوباره" }));
  await screen.findByRole("button", { name: "ثبت مورد تازه" });
  expect(screen.queryByRole("alert")).toBeNull();
  expect(request).toHaveBeenCalledTimes(10);
});

it("keeps the saved editor and success notice mounted while refreshing new reference data", async () => {
  let created = false;
  let refresh!: (value: unknown) => void;
  request.mockImplementation((path: string, options?: { method?: string }) => {
    if (options?.method === "POST") { created = true; return Promise.resolve({ id: 8 }); }
    if (path === "/admin/brands" && created) return new Promise(resolve => { refresh = resolve; });
    return Promise.resolve([]);
  });
  render(<ReferenceData />);
  await screen.findByRole("button", { name: "ثبت مورد تازه" });
  fireEvent.change(screen.getByLabelText(/نام/), { target: { value: "برند تازه" } });
  fireEvent.click(screen.getByRole("button", { name: "ثبت مورد تازه" }));
  await screen.findByText("مورد تازه ثبت شد.");
  await waitFor(() => expect(refresh).toBeTypeOf("function"));
  expect(screen.getByRole("button", { name: "ثبت مورد تازه" })).toBeTruthy();
  expect(request).toHaveBeenCalledWith("/admin/brands", { method: "POST", body: { name: "برند تازه", country: null, description: null, logo: null, isActive: true } });
  await act(async () => refresh([{ id: 8, name: "برند تازه", isActive: true }]));
  expect(screen.getByRole("button", { name: /برند تازه/ })).toBeTruthy();
  expect(screen.getByText("مورد تازه ثبت شد.")).toBeTruthy();
});

it.each([
  ["دسته‌بندی‌ها", "/admin/categories", { petTypeId: null, parentId: null, image: null, isActive: true }],
  ["نوع حیوان", "/admin/pet-types", { isActive: true }],
  ["نژادها", "/admin/breeds", { petTypeId: 3, isActive: true }],
  ["برچسب‌ها", "/admin/tags", { type: "ALLERGEN" }],
])("retains the existing %s creation contract", async (label, path, fields) => {
  request.mockImplementation((url: string) => Promise.resolve(url === "/admin/pet-types" ? [pet] : []));
  render(<ReferenceData />);
  await screen.findByRole("button", { name: "ثبت مورد تازه" });
  fireEvent.click(within(screen.getByRole("group", { name: "نوع دادهٔ مرجع" })).getByRole("button", { name: label }));
  fireEvent.change(screen.getByLabelText(/نام/), { target: { value: "مرجع تازه" } });
  if (path === "/admin/breeds") fireEvent.change(screen.getByLabelText(/نوع حیوان/), { target: { value: "3" } });
  fireEvent.click(screen.getByRole("button", { name: "ثبت مورد تازه" }));
  await screen.findByText("مورد تازه ثبت شد.");
  expect(request).toHaveBeenCalledWith(path, { method: "POST", body: { name: "مرجع تازه", ...fields } });
});

it("protects edits when changing reference kind or item, without losing a cancelled draft", async () => {
  request.mockImplementation((path: string) => Promise.resolve(path === "/admin/brands" ? [{ id: 8, name: "برند ثبت‌شده", isActive: true }] : []));
  function Protected() { useDraftProtection(); return <ReferenceData />; }
  render(<Protected />);
  await screen.findByRole("button", { name: "ثبت مورد تازه" });
  fireEvent.change(screen.getByLabelText(/نام/), { target: { value: "پیش‌نویس برند" } });
  expect(hasUnsavedDrafts()).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "دسته‌بندی‌ها" }));
  let dialog = await screen.findByRole("dialog", { name: "کنار گذاشتن تغییرها" });
  fireEvent.click(within(dialog).getByRole("button", { name: "بازگشت" }));
  expect((screen.getByLabelText(/نام/) as HTMLInputElement).value).toBe("پیش‌نویس برند");
  expect(hasUnsavedDrafts()).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: /برند ثبت‌شده/ }));
  dialog = await screen.findByRole("dialog", { name: "کنار گذاشتن تغییرها" });
  fireEvent.click(within(dialog).getByRole("button", { name: "کنار گذاشتن تغییرها" }));
  await waitFor(() => expect((screen.getByLabelText(/نام/) as HTMLInputElement).value).toBe("برند ثبت‌شده"));
  expect(hasUnsavedDrafts()).toBe(false);
});

it("updates and removes a selected reference through its existing API while blocking duplicate saves", async () => {
  let brand = { id: 8, name: "برند ثبت‌شده", isActive: true };
  let removed = false;
  let save!: (value: unknown) => void;
  request.mockImplementation((path: string, options?: { method?: string; body?: { name: string } }) => {
    if (options?.method === "PATCH") {
      brand = { ...brand, name: options.body!.name };
      return new Promise(resolve => { save = resolve; });
    }
    if (options?.method === "DELETE") { removed = true; return Promise.resolve({}); }
    return Promise.resolve(path === "/admin/brands" && !removed ? [brand] : []);
  });
  render(<ReferenceData />);
  fireEvent.click(await screen.findByRole("button", { name: /برند ثبت‌شده/ }));
  fireEvent.change(screen.getByLabelText(/نام/), { target: { value: "برند ویرایش‌شده" } });
  const form = screen.getByLabelText(/نام/).closest("form")!;
  fireEvent.submit(form);
  fireEvent.submit(form);
  expect(request.mock.calls.filter(([, options]) => options?.method === "PATCH")).toHaveLength(1);
  await act(async () => save({}));
  await screen.findByText("تغییرات ذخیره شد.");
  expect(request).toHaveBeenCalledWith("/admin/brands/8", { method: "PATCH", body: { name: "برند ویرایش‌شده", country: null, description: null, logo: null, isActive: true } });
  fireEvent.click(screen.getByRole("button", { name: "حذف / غیرفعال‌سازی" }));
  const dialog = await screen.findByRole("dialog", { name: "حذف مورد" });
  fireEvent.click(within(dialog).getByRole("button", { name: "حذف مورد" }));
  await screen.findByText("حذف یا غیرفعال‌سازی انجام شد.");
  await waitFor(() => expect(screen.queryByRole("button", { name: /برند ویرایش‌شده/ })).toBeNull());
  expect(request).toHaveBeenCalledWith("/admin/brands/8", { method: "DELETE" });
});
