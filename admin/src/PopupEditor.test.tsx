// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { isPopupImagePath, PopupEditor, type PopupContent } from "./PopupEditor";
import { hasUnsavedDrafts } from "./management";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("./auth", () => ({ useAuth: () => ({ request }) }));
const initial: PopupContent = { enabled: false, title: "خبر فروشگاه", body: "تازه‌ها را ببینید.", image: "/brand/landing-meal-mobile.webp" };
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}
async function ready() { render(<PopupEditor />); return await screen.findByRole("button", { name: "ذخیره پاپ‌آپ" }); }
function submit() { fireEvent.submit(screen.getByLabelText("عنوان").closest("form")!); }
beforeEach(() => {
  request.mockImplementation((path: string, options?: { method?: string }) => {
    if (path === "/admin/storefront/popup") return Promise.resolve(options?.method === "PUT" ? {} : initial);
    if (path === "/upload/image") return Promise.resolve({ url: "/uploads/popup.webp" });
    throw new Error(`Unexpected request ${path}`);
  });
  Object.defineProperty(URL, "createObjectURL", { configurable: true, writable: true, value: vi.fn(() => "blob:popup-preview") });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, writable: true, value: vi.fn() });
});
afterEach(() => { cleanup(); request.mockReset(); vi.restoreAllMocks(); });

it("loads shared settings disabled and previews only first-party content", async () => {
  await ready();
  expect(request).toHaveBeenCalledWith("/admin/storefront/popup");
  expect((screen.getByLabelText("نمایش پاپ‌آپ") as HTMLInputElement).checked).toBe(false);
  const preview = screen.getByLabelText("پیش‌نمایش پاپ‌آپ");
  expect(preview.textContent).toContain(initial.body);
  expect(preview.querySelector("img")?.getAttribute("src")).toBe(initial.image);
  expect(hasUnsavedDrafts()).toBe(false);
  expect(request.mock.calls.some(([, options]) => options?.method === "PUT")).toBe(false);
});
it("saves normalized full content once and clears the dirty form only after success", async () => {
  const save = deferred<unknown>();
  request.mockImplementation((path: string, options?: { method?: string }) => path === "/admin/storefront/popup" && options?.method === "PUT" ? save.promise : Promise.resolve(initial));
  const button = await ready();
  fireEvent.click(screen.getByLabelText("نمایش پاپ‌آپ"));
  fireEvent.change(screen.getByLabelText("عنوان"), { target: { value: "  پیشنهاد تازه  " } });
  expect(hasUnsavedDrafts()).toBe(true);
  submit(); submit();
  expect(request.mock.calls.filter(([, options]) => options?.method === "PUT")).toHaveLength(1);
  expect(request).toHaveBeenCalledWith("/admin/storefront/popup", { method: "PUT", body: { ...initial, enabled: true, title: "پیشنهاد تازه" } });
  expect((button as HTMLButtonElement).disabled).toBe(true);
  expect(hasUnsavedDrafts()).toBe(true);
  await act(async () => save.resolve({}));
  expect(hasUnsavedDrafts()).toBe(false);
  expect(screen.getByRole("status").textContent).toContain("پاپ‌آپ ذخیره شد");
});
it("retains the draft after a failed save and supports retry", async () => {
  await ready();
  request.mockRejectedValueOnce(new Error("ذخیره انجام نشد"));
  fireEvent.change(screen.getByLabelText("متن"), { target: { value: "متن تازه" } });
  submit();
  await screen.findByRole("alert");
  expect(hasUnsavedDrafts()).toBe(true);
  expect((screen.getByLabelText("متن") as HTMLTextAreaElement).value).toBe("متن تازه");
  submit(); await screen.findByText("پاپ‌آپ ذخیره شد.");
  expect(hasUnsavedDrafts()).toBe(false);
});
it("rejects remote, traversal, SVG and overlong image paths without loading or saving them", async () => {
  for (const path of ["https://tracker.example/pixel.png", "//tracker.example/a.png", "/uploads/../private/a.png", "/brand/a.svg", "/uploads/a.png?track=1", "/uploads/" + "a".repeat(501) + ".png"]) expect(isPopupImagePath(path)).toBe(false);
  await ready();
  const imageInput = screen.getByLabelText("نشانی تصویر");
  fireEvent.change(imageInput, { target: { value: "https://tracker.example/pixel.png" } });
  expect(screen.getByLabelText("پیش‌نمایش پاپ‌آپ").querySelector("img")).toBeNull();
  submit();
  expect(imageInput.getAttribute("aria-invalid")).toBe("true");
  expect(request.mock.calls.some(([, options]) => options?.method === "PUT")).toBe(false);
});
it("requires title and text before enabling a popup, but permits an empty disabled draft", async () => {
  await ready();
  const title = screen.getByLabelText("عنوان");
  const body = screen.getByLabelText("متن");
  fireEvent.change(title, { target: { value: "  " } });
  fireEvent.change(body, { target: { value: "  " } });
  fireEvent.click(screen.getByLabelText("نمایش پاپ‌آپ"));
  submit();
  expect(title.getAttribute("aria-invalid")).toBe("true");
  expect(body.getAttribute("aria-invalid")).toBe("true");
  expect(request.mock.calls.some(([, options]) => options?.method === "PUT")).toBe(false);
  fireEvent.click(screen.getByLabelText("نمایش پاپ‌آپ"));
  fireEvent.submit(title.closest("form")!);
  await screen.findByText("پاپ‌آپ ذخیره شد.");
  expect(request).toHaveBeenLastCalledWith("/admin/storefront/popup", { method: "PUT", body: { ...initial, title: "", body: "" } });
});
it("uploads a selected image only when saving, and reuses it if the content save fails", async () => {
  let firstSave = true;
  request.mockImplementation((path: string, options?: { method?: string }) => {
    if (path === "/upload/image") return Promise.resolve({ url: "/uploads/popup.webp" });
    if (options?.method === "PUT" && firstSave) { firstSave = false; return Promise.reject(new Error("موقتاً در دسترس نیست")); }
    return Promise.resolve(options?.method === "PUT" ? {} : initial);
  });
  await ready();
  const file = new File(["image"], "photo.png", { type: "image/png" });
  fireEvent.change(screen.getByLabelText("تصویر پاپ‌آپ"), { target: { files: [file] } });
  expect(screen.getByLabelText("پیش‌نمایش پاپ‌آپ").querySelector("img")?.getAttribute("src")).toBe("blob:popup-preview");
  expect(request.mock.calls.some(([path]) => path === "/upload/image")).toBe(false);
  submit(); await screen.findByRole("alert");
  expect(request.mock.calls.filter(([path]) => path === "/upload/image")).toHaveLength(1);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:popup-preview");
  expect(hasUnsavedDrafts()).toBe(true);
  submit(); await screen.findByText("پاپ‌آپ ذخیره شد.");
  expect(request.mock.calls.filter(([path]) => path === "/upload/image")).toHaveLength(1);
  expect(request).toHaveBeenLastCalledWith("/admin/storefront/popup", { method: "PUT", body: { ...initial, image: "/uploads/popup.webp" } });
});
it("does not continue into a settings write after an upload's editor was unmounted", async () => {
  const upload = deferred<{ url: string }>();
  request.mockImplementation((path: string) => path === "/upload/image" ? upload.promise : Promise.resolve(initial));
  await ready();
  fireEvent.change(screen.getByLabelText("تصویر پاپ‌آپ"), { target: { files: [new File(["image"], "photo.png", { type: "image/png" })] } });
  submit(); cleanup();
  await act(async () => upload.resolve({ url: "/uploads/popup.webp" }));
  expect(request.mock.calls.some(([, options]) => options?.method === "PUT")).toBe(false);
});
it("shows load failure without an editable default and can retry safely", async () => {
  request.mockRejectedValueOnce(new Error("ارتباط برقرار نشد"));
  render(<PopupEditor />);
  await screen.findByRole("alert");
  expect(screen.queryByRole("button", { name: "ذخیره پاپ‌آپ" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "تلاش دوباره" }));
  await screen.findByRole("button", { name: "ذخیره پاپ‌آپ" });
  await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
});
