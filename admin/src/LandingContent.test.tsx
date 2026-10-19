import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { Blob as NativeBlob } from "node:buffer";
import { landingSample } from "../../frontend/src/features/landing/content";
import { LandingContent, validateLandingImport } from "./LandingContent";
import { hasUnsavedDrafts, useDraftProtection } from "./management";
import { coverCrop, exportCrop, verifyRaster } from "./landing-crop";
import * as cropHelpers from "./landing-crop";

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const copy = () => JSON.parse(JSON.stringify(landingSample));
const openPane = (name: string) => fireEvent.click(within(screen.getByRole("navigation", { name: "بخش‌های ویرایش صفحهٔ اصلی" })).getByRole("button", { name }));

it("offers seven direct panes with only the selected workspace visible and no draft created by navigation", () => {
  function Protected() { useDraftProtection(); return <LandingContent />; }
  render(<Protected />);
  const panes = ["نوار اعلان", "بنرها", "معیار پرفروش‌ترین‌ها", "محصولات", "کلینیک‌ها", "داروخانه‌ها", "داروها"];
  const navigation = screen.getByRole("navigation", { name: "بخش‌های ویرایش صفحهٔ اصلی" });
  expect(within(navigation).getAllByRole("button")).toHaveLength(7);
  for (const name of panes) {
    openPane(name);
    expect(within(navigation).getByRole("button", { name, pressed: true })).toBeTruthy();
    expect(within(screen.getByRole("region", { name })).getAllByRole("heading", { level: 2 })).toHaveLength(1);
    expect(document.querySelectorAll(".landing-pane:not([hidden])")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "دانلود تنظیمات پیش‌نویس" })).toBeTruthy();
    expect(hasUnsavedDrafts()).toBe(false);
  }
  expect(screen.queryByLabelText("بخش صفحهٔ اصلی")).toBeNull();
});

it("rejects unknown section keys before replacing the draft and keeps a subsequent export usable", async () => {
  vi.stubGlobal("Blob", NativeBlob);
  vi.stubGlobal("URL", {
    createObjectURL: vi.fn(() => "blob:draft"),
    revokeObjectURL: vi.fn(),
  });
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(() => {});
  render(<LandingContent />);
  const malformed = copy();
  malformed.sections.unexpected = null;
  expect(validateLandingImport(malformed)).toBe(false);
  fireEvent.change(screen.getByLabelText("فایل تنظیمات لندینگ"), {
    target: {
      files: [{ size: 1000, text: async () => JSON.stringify(malformed) }],
    },
  });
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain("ساختار فایل"),
  );
  expect((screen.getByLabelText("متن اعلان") as HTMLInputElement).value).toBe(
    landingSample.announcement.text,
  );
  await waitFor(() =>
    expect(
      (
        screen.getByRole("button", {
          name: "دانلود تنظیمات پیش‌نویس",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
  vi.useFakeTimers();
  fireEvent.click(
    screen.getByRole("button", { name: "دانلود تنظیمات پیش‌نویس" }),
  );
  expect(click).toHaveBeenCalledOnce();
  expect(screen.getByRole("status").textContent).toContain("هنوز منتشر نشده");
  expect(screen.queryByRole("alert")).toBeNull();
});

it("locks the parent draft during card-image decoding and releases its local preview on import replacement", async () => {
  vi.spyOn(cropHelpers, "verifyRaster").mockResolvedValue(undefined);
  let finish!: (image: HTMLImageElement) => void;
  vi.spyOn(cropHelpers, "loadCropImage").mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const revoke = vi.fn();
  vi.stubGlobal("URL", {
    createObjectURL: () => "blob:local-card",
    revokeObjectURL: revoke,
  });
  function Protected() {
    useDraftProtection();
    return <LandingContent />;
  }
  render(<Protected />);
  openPane("محصولات");
  fireEvent.change(screen.getByLabelText("فایل تصویر مورد"), {
    target: { files: [new File(["image"], "test.png", { type: "image/png" })] },
  });
  expect(
    (
      screen
        .getByLabelText("متن اعلان")
        .closest("fieldset") as HTMLFieldSetElement
    ).disabled,
  ).toBe(true);
  await waitFor(() =>
    expect(cropHelpers.loadCropImage).toHaveBeenCalledWith("blob:local-card"),
  );
  await act(async () =>
    finish({ naturalWidth: 800, naturalHeight: 600 } as HTMLImageElement),
  );
  await waitFor(() =>
    expect(
      document.querySelector(".landing-item-preview img")?.getAttribute("src"),
    ).toBe("blob:local-card"),
  );
  expect(screen.queryByLabelText("نشانی تصویر مورد")).toBeNull();
  expect(
    screen.getByRole("button", { name: "دانلود تصویر اصلی مورد" }),
  ).toBeTruthy();
  expect(hasUnsavedDrafts()).toBe(true);
  openPane("نوار اعلان");
  openPane("کلینیک‌ها");
  openPane("محصولات");
  expect(document.querySelector(".landing-item-preview img")?.getAttribute("src")).toBe("blob:local-card");
  expect(revoke).not.toHaveBeenCalledWith("blob:local-card");
  expect(hasUnsavedDrafts()).toBe(true);
  fireEvent.change(screen.getByLabelText("فایل تنظیمات لندینگ"), {
    target: {
      files: [{ size: 1000, text: async () => JSON.stringify(copy()) }],
    },
  });
  const dialog = await screen.findByRole("dialog", {
    name: "جایگزینی پیش‌نویس",
  });
  fireEvent.click(
    within(dialog).getByRole("button", { name: "جایگزینی پیش‌نویس" }),
  );
  await waitFor(() => expect(revoke).toHaveBeenCalledWith("blob:local-card"));
  expect(
    screen.queryByRole("button", { name: "دانلود تصویر اصلی مورد" }),
  ).toBeNull();
});

it("downloads the actual edited versioned JSON while retaining its unpublished draft warning", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("Blob", NativeBlob);
  let exported: NativeBlob | undefined;
  vi.stubGlobal("URL", {
    createObjectURL: vi.fn((blob: NativeBlob) => {
      exported = blob;
      return "blob:draft";
    }),
    revokeObjectURL: vi.fn(),
  });
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe("dr-gupet-landing-draft.json");
    });
  render(<LandingContent />);
  fireEvent.change(screen.getByLabelText("متن اعلان"), {
    target: { value: "اطلاعیهٔ تازه" },
  });
  openPane("معیار پرفروش‌ترین‌ها");
  fireEvent.change(screen.getByLabelText("معیار فروش"), {
    target: { value: "paid_revenue" },
  });
  openPane("محصولات");
  fireEvent.change(screen.getByLabelText("عنوان بخش"), {
    target: { value: "محصولات برای ارائه" },
  });
  fireEvent.change(screen.getByLabelText("نام مورد"), {
    target: { value: "غذای نمونهٔ ویرایش‌شده" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "دانلود تنظیمات پیش‌نویس" }),
  );
  expect(click).toHaveBeenCalledOnce();
  const saved = JSON.parse(await exported!.text());
  expect(saved.announcement.text).toBe("اطلاعیهٔ تازه");
  expect(saved.ranking.metric).toBe("paid_revenue");
  expect(saved.slides[0].image).toBe(landingSample.slides[0]!.image);
  expect(saved.sections.products.title).toBe("محصولات برای ارائه");
  expect(saved.sections.products.items[0].title).toBe("غذای نمونهٔ ویرایش‌شده");
  expect(Object.keys(saved.sections)).toEqual([
    "products",
    "clinics",
    "pharmacies",
    "medicines",
  ]);
  expect(screen.getByRole("status").textContent).toContain("هنوز منتشر نشده");
  expect(hasUnsavedDrafts()).toBe(true);
});

it("imports a compatible draft and its separate mobile source but refuses unsafe replacement", async () => {
  function Protected() {
    useDraftProtection();
    return <LandingContent />;
  }
  render(<Protected />);
  const next = copy();
  next.ranking.days = 21;
  next.ranking.limit = 5;
  next.announcement.text = "اعلان واردشده";
  next.slides[0].mobileImage = "/brand/mobile-custom.webp";
  const file = { size: 1000, text: async () => JSON.stringify(next) };
  const chooser = screen.getByLabelText("فایل تنظیمات لندینگ");
  fireEvent.change(chooser, { target: { files: [file] } });
  await waitFor(() =>
    expect((screen.getByLabelText("متن اعلان") as HTMLInputElement).value).toBe(
      "اعلان واردشده",
    ),
  );
  openPane("بنرها");
  expect(screen.getAllByRole("img")[1]!.getAttribute("src")).toBe(
    "/brand/mobile-custom.webp",
  );
  expect((screen.getByLabelText("بازهٔ آمار") as HTMLSelectElement).value).toBe(
    "21",
  );
  expect(
    (screen.getByLabelText("تعداد محصولات") as HTMLSelectElement).value,
  ).toBe("5");
  await waitFor(() =>
    expect(
      (screen.getByLabelText("متن اعلان") as HTMLInputElement).disabled,
    ).toBe(false),
  );
  next.slides[0].href = "https://outside.example";
  fireEvent.change(chooser, {
    target: { files: [{ size: 1000, text: async () => JSON.stringify(next) }] },
  });
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain("سازگار نیست"),
  );
  expect((screen.getByLabelText("متن اعلان") as HTMLInputElement).value).toBe(
    "اعلان واردشده",
  );
});

it("keeps the local editor honest and never uses a server or shared browser storage to publish", () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const storage = vi.spyOn(Storage.prototype, "setItem");
  render(<LandingContent />);
  expect(screen.getByText("پیش‌نویس؛ منتشر نشده")).toBeTruthy();
  expect(screen.getByText("انتشار از پنل هنوز به سرور متصل نیست")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("متن اعلان"), {
    target: { value: "یک اعلان تازه" },
  });
  expect(fetch).not.toHaveBeenCalled();
  expect(storage).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: /^انتشار/ })).toBeNull();
});

it("keeps ordering and local announcement changes under the existing draft departure guard", () => {
  function Protected() {
    useDraftProtection();
    return <LandingContent />;
  }
  render(<Protected />);
  expect(hasUnsavedDrafts()).toBe(false);
  openPane("بنرها");
  fireEvent.click(screen.getByRole("button", { name: "یک جایگاه عقب‌تر" }));
  expect(hasUnsavedDrafts()).toBe(true);
  const list = screen.getByLabelText("انتخاب اسلاید");
  expect(
    within(list).getAllByRole("button")[1]?.getAttribute("aria-pressed"),
  ).toBe("true");
  expect(
    (screen.getByLabelText("عنوان اسلاید") as HTMLInputElement).value,
  ).toBe(landingSample.slides[0]!.title);
  fireEvent.change(screen.getByLabelText("جابه‌جایی افقی کادر دسکتاپ"), {
    target: { value: "62" },
  });
  fireEvent.change(screen.getByLabelText("جابه‌جایی عمودی کادر دسکتاپ"), {
    target: { value: "30" },
  });
  fireEvent.change(screen.getByLabelText("جابه‌جایی افقی کادر موبایل"), {
    target: { value: "15" },
  });
  const frames = screen.getAllByRole("img");
  expect(frames[1]!.style.objectPosition).toBe(
    `15% ${landingSample.slides[0]!.mobileFocus.y}%`,
  );
  expect(frames[0]!.style.objectPosition).toBe("62% 30%");
});

it("validates enabled content and focuses the broken field before any draft download", () => {
  render(<LandingContent />);
  openPane("بنرها");
  const title = screen.getByLabelText("عنوان اسلاید");
  fireEvent.change(title, { target: { value: "" } });
  fireEvent.click(within(screen.getByLabelText("انتخاب اسلاید")).getAllByRole("button")[1]!);
  openPane("نوار اعلان");
  fireEvent.click(
    screen.getByRole("button", { name: "دانلود تنظیمات پیش‌نویس" }),
  );
  expect(title.getAttribute("aria-invalid")).toBe("true");
  expect(screen.getByRole("region", { name: "بنرها" })).toBeTruthy();
  expect(document.activeElement).toBe(title);
  expect(screen.getByRole("alert").textContent).toContain("بررسی کنید");
});

it("reveals the affected section and selected card when exporting from another pane", () => {
  render(<LandingContent />);
  openPane("کلینیک‌ها");
  const cards = within(screen.getByLabelText("انتخاب کارت نمونه")).getAllByRole("button");
  fireEvent.click(cards[1]!);
  const id = landingSample.sections.clinics.items[1]!.id;
  fireEvent.change(screen.getByLabelText("نام مورد"), { target: { value: "" } });
  openPane("محصولات");
  openPane("نوار اعلان");
  fireEvent.click(screen.getByRole("button", { name: "دانلود تنظیمات پیش‌نویس" }));
  expect(screen.getByRole("region", { name: "کلینیک‌ها" })).toBeTruthy();
  const field = screen.getByRole("textbox", { name: /^نام مورد/ });
  expect(field.getAttribute("name")).toBe(`itemTitle-clinics-${id}`);
  expect(field.getAttribute("aria-invalid")).toBe("true");
  expect(document.activeElement).toBe(field);
});

it("validates versioned imports, unique slide IDs, URL safety, crop ranges and report bounds", () => {
  expect(validateLandingImport(copy())).toBe(true);
  const oldDraft = copy();
  delete oldDraft.sections;
  expect(validateLandingImport(oldDraft)).toBe(false);
  const missingSection = copy();
  delete missingSection.sections.pharmacies;
  expect(validateLandingImport(missingSection)).toBe(false);
  const unsafeCard = copy();
  unsafeCard.sections.products.items[0].image =
    "https://outside.example/image.jpg";
  expect(validateLandingImport(unsafeCard)).toBe(false);
  const invalidPrice = copy();
  invalidPrice.sections.products.items[0].price = -1;
  expect(validateLandingImport(invalidPrice)).toBe(false);
  const duplicateCard = copy();
  duplicateCard.sections.clinics.items[1].id =
    duplicateCard.sections.clinics.items[0].id;
  expect(validateLandingImport(duplicateCard)).toBe(false);
  const malformedAnnouncement = copy();
  malformedAnnouncement.announcement.href = null;
  expect(validateLandingImport(malformedAnnouncement)).toBe(false);
  const malformedMobileImage = copy();
  malformedMobileImage.slides[0].mobileImage = false;
  expect(validateLandingImport(malformedMobileImage)).toBe(false);
  for (const id of ["constructor", "__proto__", "toString", "valueOf"]) {
    const inherited = copy();
    inherited.slides[0].id = id;
    expect(validateLandingImport(inherited)).toBe(false);
  }
  const wrongVersion = copy();
  wrongVersion.version = 2;
  expect(validateLandingImport(wrongVersion)).toBe(false);
  const duplicate = copy();
  duplicate.slides[1].id = duplicate.slides[0].id;
  expect(validateLandingImport(duplicate)).toBe(false);
  const external = copy();
  external.slides[0].href = "//outside.example";
  expect(validateLandingImport(external)).toBe(false);
  const privateAsset = copy();
  privateAsset.slides[0].mobileImage = "https://outside.example/a.png";
  expect(validateLandingImport(privateAsset)).toBe(false);
  const invalidFocus = copy();
  invalidFocus.slides[0].mobileFocus.x = 101;
  expect(validateLandingImport(invalidFocus)).toBe(false);
  const report = copy();
  report.ranking.limit = 1000;
  expect(validateLandingImport(report)).toBe(false);
});

it("edits all four section templates without treating a section-selection change as an unsaved edit", () => {
  function Protected() {
    useDraftProtection();
    return <LandingContent />;
  }
  render(<Protected />);
  const labels = { products: "محصولات", clinics: "کلینیک‌ها", pharmacies: "داروخانه‌ها", medicines: "داروها" };
  for (const key of [
    "products",
    "clinics",
    "pharmacies",
    "medicines",
  ] as const) {
    openPane(labels[key]);
    expect((screen.getByLabelText("عنوان بخش") as HTMLInputElement).value).toBe(
      landingSample.sections[key].title,
    );
    expect(
      within(screen.getByLabelText("انتخاب کارت نمونه")).getAllByRole("button"),
    ).toHaveLength(6);
    expect(hasUnsavedDrafts()).toBe(false);
  }
  fireEvent.change(screen.getByLabelText("عنوان بخش"), {
    target: { value: "اطلاعات دارویی" },
  });
  expect(hasUnsavedDrafts()).toBe(true);
  fireEvent.click(screen.getByLabelText("نمونهٔ نمایش"));
  expect(
    screen.getByText(/در حالت واقعی، کارت‌ها باید از داده‌های سرور بیایند/),
  ).toBeTruthy();
  openPane("محصولات");
  openPane("داروها");
  expect((screen.getByLabelText("عنوان بخش") as HTMLInputElement).value).toBe(
    "اطلاعات دارویی",
  );
  expect(
    (screen.getByLabelText("نمونهٔ نمایش") as HTMLInputElement).checked,
  ).toBe(false);
});

it("keeps the selected card during reorder, supports Persian sample prices, and confirms deletion", async () => {
  render(<LandingContent />);
  openPane("محصولات");
  const title = landingSample.sections.products.items[0]!.title;
  fireEvent.click(
    screen.getByRole("button", { name: "مورد یک جایگاه عقب‌تر" }),
  );
  expect((screen.getByLabelText("نام مورد") as HTMLInputElement).value).toBe(
    title,
  );
  const rows = within(screen.getByLabelText("انتخاب کارت نمونه")).getAllByRole(
    "button",
  );
  expect(rows[1]!.getAttribute("aria-pressed")).toBe("true");
  fireEvent.change(screen.getByLabelText("قیمت نمونه (تومان؛ اختیاری)"), {
    target: { value: "۲۵۰٬۰۰۰" },
  });
  expect(
    (screen.getByLabelText("قیمت نمونه (تومان؛ اختیاری)") as HTMLInputElement)
      .value,
  ).toBe("۲۵۰٬۰۰۰");
  fireEvent.change(screen.getByLabelText("قیمت نمونه (تومان؛ اختیاری)"), {
    target: { value: "-4" },
  });
  expect(screen.getByRole("alert").textContent).toContain("عدد صحیح و نامنفی");
  expect(
    (screen.getByLabelText("قیمت نمونه (تومان؛ اختیاری)") as HTMLInputElement)
      .value,
  ).toBe("۲۵۰٬۰۰۰");
  fireEvent.click(screen.getByRole("button", { name: "حذف مورد" }));
  const dialog = screen.getByRole("dialog", { name: "حذف مورد" });
  fireEvent.click(within(dialog).getByRole("button", { name: "حذف مورد" }));
  await waitFor(() =>
    expect(
      within(screen.getByLabelText("انتخاب کارت نمونه")).getAllByRole("button"),
    ).toHaveLength(5),
  );
  fireEvent.click(screen.getByRole("button", { name: "افزودن مورد" }));
  expect((screen.getByLabelText("نام مورد") as HTMLInputElement).value).toBe(
    "مورد تازه",
  );
  expect(
    within(screen.getByLabelText("انتخاب کارت نمونه")).getAllByRole("button"),
  ).toHaveLength(6);
});

it("preserves image proportions and exactly matches cover-position crop geometry at both extremes", () => {
  const left = coverCrop(1600, 700, 4 / 5, { x: 0, y: 50 });
  const right = coverCrop(1600, 700, 4 / 5, { x: 100, y: 50 });
  expect(left).toEqual({ x: 0, y: 0, width: 560, height: 700 });
  expect(right).toEqual({ x: 1040, y: 0, width: 560, height: 700 });
  const centered = coverCrop(700, 1600, 16 / 7, { x: 50, y: 50 });
  expect(centered.width / centered.height).toBeCloseTo(16 / 7);
  expect(centered.y).toBeCloseTo((1600 - centered.height) / 2);
  expect(() => coverCrop(0, 700, 1, { x: 50, y: 50 })).toThrow();
});

it("actually draws the selected crop into the WebP export canvas and reports failed encodes", async () => {
  class ImageStub {
    naturalWidth = 1600;
    naturalHeight = 700;
    onload: (() => void) | null = null;
    set src(_value: string) {
      queueMicrotask(() => this.onload?.());
    }
  }
  vi.stubGlobal("Image", ImageStub);
  const drawImage = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage,
  } as unknown as CanvasRenderingContext2D);
  const encoded = new Blob(["image"], { type: "image/webp" });
  const encoder = vi
    .spyOn(HTMLCanvasElement.prototype, "toBlob")
    .mockImplementation((callback) => callback(encoded));
  expect(
    await exportCrop("/brand/sample.webp", 720, 900, { x: 100, y: 50 }),
  ).toBe(encoded);
  expect(drawImage.mock.calls[0]!.slice(1)).toEqual([
    1040, 0, 560, 700, 0, 0, 720, 900,
  ]);
  expect(encoder.mock.calls[0]!.slice(1)).toEqual(["image/webp", 0.9]);
  encoder.mockImplementationOnce((callback) => callback(null));
  await expect(
    exportCrop("/brand/sample.webp", 720, 900, { x: 50, y: 50 }),
  ).rejects.toThrow("خروجی تصویر ساخته نشد");
});

it("refuses disguised and oversized files before browser decoding", async () => {
  const file = (type: string, bytes: number[], size = bytes.length) =>
    ({
      type,
      size,
      slice: () => ({ arrayBuffer: async () => new Uint8Array(bytes).buffer }),
    }) as unknown as File;
  await expect(
    verifyRaster(file("image/png", [137, 80, 78, 71, 13, 10, 26, 10])),
  ).resolves.toBeUndefined();
  await expect(
    verifyRaster(file("image/jpeg", [60, 115, 118, 103])),
  ).rejects.toThrow("تصویر معتبر");
  await expect(
    verifyRaster(file("image/svg+xml", [60, 115, 118, 103])),
  ).rejects.toThrow("تصویر معتبر");
  await expect(
    verifyRaster(file("image/png", [], 11 * 1024 * 1024)),
  ).rejects.toThrow("۱۰ مگابایت");
});
