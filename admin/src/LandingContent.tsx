import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  landingSample,
  landingSectionOrder,
  safeLandingLink,
  type LandingContent as Content,
  type LandingSlide,
} from "../../frontend/src/features/landing/content";
import { confirmAction, showFieldErrors } from "./management";
import { exportCrop, loadCropImage, verifyRaster } from "./landing-crop";
import { downloadLandingFile } from "./landing-files";
import {
  LandingSectionsEditor,
  validateLandingSections,
  completeLandingSections,
} from "./LandingSectionsEditor";
export { downloadLandingFile } from "./landing-files";
import "./landing-content.css";

const cloneSample = (): Content =>
  JSON.parse(JSON.stringify(landingSample)) as Content;
const number = new Intl.NumberFormat("fa-IR");
type LocalImage = { file: File; url: string; name: string };
const internalHref = (value: unknown): value is string =>
  typeof value === "string" && value !== "" && safeLandingLink(value);
const assetPath = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\/brand\/[a-zA-Z0-9_-]+\.(webp|png|jpg|jpeg)$/.test(value);
const text = (value: unknown, maximum: number): value is string =>
  typeof value === "string" && value.length <= maximum;
const focus = (value: unknown): boolean =>
  typeof value === "object" &&
  value !== null &&
  ["x", "y"].every(
    (key) =>
      typeof (value as Record<string, unknown>)[key] === "number" &&
      Number.isFinite((value as Record<string, unknown>)[key]) &&
      Number((value as Record<string, unknown>)[key]) >= 0 &&
      Number((value as Record<string, unknown>)[key]) <= 100,
  );

/** Reject private URLs, incompatible versions and malformed drafts before replacing work. */
export function validateLandingImport(value: unknown): value is Content {
  if (!value || typeof value !== "object") return false;
  const content = value as Partial<Content>;
  const announcement = content.announcement;
  const ranking = content.ranking;
  return (
    content.version === 1 &&
    !!announcement &&
    typeof announcement.enabled === "boolean" &&
    text(announcement.text, 180) &&
    typeof announcement.href === "string" &&
    (announcement.href === "" || internalHref(announcement.href)) &&
    Array.isArray(content.slides) &&
    content.slides.length > 0 &&
    content.slides.length <= 12 &&
    new Set(content.slides.map((slide) => slide?.id)).size ===
      content.slides.length &&
    content.slides.every(
      (slide) =>
        !!slide &&
        typeof slide.enabled === "boolean" &&
        text(slide.id, 64) &&
        /^[a-zA-Z0-9_-]+$/.test(slide.id) &&
        !Object.hasOwn(Object.prototype, slide.id) &&
        text(slide.title, 90) &&
        text(slide.description, 220) &&
        text(slide.alt, 220) &&
        text(slide.ctaLabel, 45) &&
        internalHref(slide.href) &&
        assetPath(slide.image) &&
        (slide.mobileImage === undefined || assetPath(slide.mobileImage)) &&
        focus(slide.desktopFocus) &&
        focus(slide.mobileFocus),
    ) &&
    !!ranking &&
    ["paid_units", "paid_revenue"].includes(ranking.metric) &&
    Number.isSafeInteger(ranking.days) &&
    ranking.days >= 1 &&
    ranking.days <= 365 &&
    Number.isSafeInteger(ranking.limit) &&
    ranking.limit >= 1 &&
    ranking.limit <= 12 &&
    validateLandingSections(content.sections)
  );
}

export function LandingContent() {
  const [content, setContent] = useState<Content>(cloneSample);
  const [selected, setSelected] = useState(landingSample.slides[0]?.id ?? "");
  const [localImages, setLocalImages] = useState<Record<string, LocalImage>>(
    {},
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [sectionRevision, setSectionRevision] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  const pending = useRef(false);
  const imagesRef = useRef<Record<string, LocalImage>>({});
  const nextSlide = useRef(0);
  const slide =
    content.slides.find((item) => item.id === selected) ?? content.slides[0]!;
  const index = content.slides.findIndex((item) => item.id === slide.id);
  const source = localImages[slide.id]?.url ?? slide.image;
  const mobileSource =
    localImages[slide.id]?.url ?? slide.mobileImage ?? slide.image;
  const imageFailed = !!failedImages[source] || !!failedImages[mobileSource];

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      Object.values(imagesRef.current).forEach((image) =>
        URL.revokeObjectURL(image.url),
      );
    };
  }, []);

  function dirty() {
    if (formRef.current) formRef.current.dataset.dirty = "true";
    setNotice("");
  }
  function updateSlide(patch: Partial<LandingSlide>) {
    dirty();
    setContent((current) => ({
      ...current,
      slides: current.slides.map((item) =>
        item.id === slide.id ? { ...item, ...patch } : item,
      ),
    }));
  }
  function updateAnnouncement(patch: Partial<Content["announcement"]>) {
    dirty();
    setContent((current) => ({
      ...current,
      announcement: { ...current.announcement, ...patch },
    }));
  }
  function chooseSlide(id: string) {
    setSelected(id);
    setError("");
  }
  function addSlide() {
    if (content.slides.length >= 12) return;
    const id = `slide-${Date.now().toString(36)}-${++nextSlide.current}`;
    const next: LandingSlide = {
      id,
      enabled: false,
      title: "",
      description: "",
      ctaLabel: "مشاهدهٔ محصولات",
      href: "/products",
      image: landingSample.slides[0]!.image,
      alt: "",
      desktopFocus: { x: 50, y: 50 },
      mobileFocus: { x: 50, y: 50 },
    };
    dirty();
    setContent((current) => ({
      ...current,
      slides: [...current.slides, next],
    }));
    chooseSlide(id);
  }
  function moveSlide(direction: -1 | 1) {
    const destination = index + direction;
    if (destination < 0 || destination >= content.slides.length) return;
    dirty();
    setContent((current) => {
      const slides = [...current.slides];
      [slides[index], slides[destination]] = [
        slides[destination]!,
        slides[index]!,
      ];
      return { ...current, slides };
    });
  }
  async function removeSlide() {
    if (pending.current || content.slides.length < 2) return;
    if (
      !(await confirmAction(
        "این اسلاید از پیش‌نویس حذف می‌شود. محتوای منتشرشدهٔ سایت تغییر نمی‌کند.",
        "حذف اسلاید",
      ))
    )
      return;
    dirty();
    const id = slide.id;
    setContent((current) => ({
      ...current,
      slides: current.slides.filter((item) => item.id !== id),
    }));
    chooseSlide(content.slides[index === 0 ? 1 : index - 1]!.id);
    const image = imagesRef.current[id];
    if (image) URL.revokeObjectURL(image.url);
    const rest = { ...imagesRef.current };
    delete rest[id];
    imagesRef.current = rest;
    setLocalImages(rest);
  }

  async function uploadImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || pending.current) return;
    const id = slide.id;
    let url = "";
    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await verifyRaster(file);
      url = URL.createObjectURL(file);
      await loadCropImage(url);
      if (!mounted.current) {
        URL.revokeObjectURL(url);
        return;
      }
      const ext =
        file.type === "image/jpeg"
          ? "jpg"
          : file.type === "image/png"
            ? "png"
            : "webp";
      const name = `landing-${id}.${ext}`;
      const previous = imagesRef.current[id];
      if (previous) URL.revokeObjectURL(previous.url);
      const next = { ...imagesRef.current, [id]: { file, url, name } };
      imagesRef.current = next;
      setLocalImages(next);
      updateSlide({
        image: `/brand/${name}`,
        mobileImage: undefined,
        desktopFocus: { x: 50, y: 50 },
        mobileFocus: { x: 50, y: 50 },
      });
      setNotice(
        "تصویر فقط در پیش‌نویس باز شد. برای انتشار، فایل اصلی و تنظیمات باید به سرور منتقل شوند.",
      );
    } catch (problem) {
      if (url) URL.revokeObjectURL(url);
      if (mounted.current)
        setError(problem instanceof Error ? problem.message : "تصویر باز نشد.");
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function crop(device: "desktop" | "mobile") {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const size =
        device === "desktop"
          ? { width: 1600, height: 700 }
          : { width: 720, height: 900 };
      const blob = await exportCrop(
        device === "desktop" ? source : mobileSource,
        size.width,
        size.height,
        device === "desktop" ? slide.desktopFocus : slide.mobileFocus,
      );
      if (!mounted.current) return;
      downloadLandingFile(blob, `${slide.id}-${device}.webp`);
      setNotice(
        "نسخهٔ برش‌خورده دانلود شد؛ تصویر اصلی دست‌نخورده است. این خروجی به‌تنهایی سایت را تغییر نمی‌دهد.",
      );
    } catch (problem) {
      if (mounted.current)
        setError(
          problem instanceof Error ? problem.message : "برش تصویر انجام نشد.",
        );
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  function exportDraft() {
    if (pending.current || !formRef.current) return;
    const errors: Record<string, string> = {};
    if (content.announcement.enabled && !content.announcement.text.trim())
      errors.announcementText = "متن نوار اعلان را وارد کنید.";
    if (content.announcement.href && !internalHref(content.announcement.href))
      errors.announcementHref = "نشانی داخلی سایت را با / آغاز کنید.";
    if (!content.slides.some((item) => item.enabled))
      errors.slideEnabled = "دست‌کم یک اسلاید فعال باشد.";
    if (!internalHref(slide.href))
      errors.slideHref = "نشانی داخلی سایت را با / آغاز کنید.";
    if (slide.enabled && !slide.title.trim())
      errors.slideTitle = "عنوان اسلاید را وارد کنید.";
    if (slide.enabled && !slide.alt.trim())
      errors.slideAlt = "توضیح قابل‌فهمی برای تصویر بنویسید.";
    if (slide.enabled && !slide.ctaLabel.trim())
      errors.slideCta = "متن دکمه را وارد کنید.";
    for (const key of landingSectionOrder) {
      const section = content.sections[key];
      if (!section.title.trim())
        errors[`sectionTitle-${key}`] = "عنوان بخش را وارد کنید.";
      for (const item of section.items) {
        if (!item.title.trim())
          errors[`itemTitle-${key}-${item.id}`] = "نام مورد را وارد کنید.";
        if (!assetPath(item.image))
          errors[`itemImage-${key}-${item.id}`] =
            "مسیر یک تصویر محلی معتبر را وارد کنید.";
        if (!internalHref(item.href))
          errors[`itemHref-${key}-${item.id}`] =
            "لینک داخلی را با / آغاز کنید.";
      }
    }
    const invalidSlide = content.slides.find(
      (item) =>
        item.enabled &&
        (!item.title.trim() ||
          !item.alt.trim() ||
          !item.ctaLabel.trim() ||
          !internalHref(item.href) ||
          !assetPath(item.image)),
    );
    showFieldErrors(formRef.current, errors);
    if (
      Object.keys(errors).length ||
      invalidSlide ||
      !validateLandingImport(content) ||
      !completeLandingSections(content.sections)
    ) {
      setError(
        invalidSlide && invalidSlide.id !== slide.id
          ? "یکی از اسلایدهای فعال ناقص است. عنوان، توضیح تصویر و دکمهٔ همهٔ اسلایدهای فعال را بررسی کنید."
          : "فیلدهای مشخص‌شده و تنظیمات پیش‌نویس را بررسی کنید؛ عنوان بخش‌ها و نام، تصویر و لینک همهٔ کارت‌ها باید معتبر باشند.",
      );
      return;
    }
    downloadLandingFile(
      new Blob([JSON.stringify(content, null, 2)], {
        type: "application/json",
      }),
      "dr-gupet-landing-draft.json",
    );
    setError("");
    setNotice(
      "فایل تنظیمات دانلود شد؛ پیش‌نویس هنوز منتشر نشده است. تصاویر تازه را هم دانلود و همراه این فایل نگه دارید.",
    );
  }

  async function importDraft(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      if (file.size > 128 * 1024)
        throw new Error("حجم فایل تنظیمات باید حداکثر ۱۲۸ کیلوبایت باشد.");
      const imported: unknown = JSON.parse(await file.text());
      if (!validateLandingImport(imported))
        throw new Error(
          "ساختار فایل با نسخهٔ فعلی سازگار نیست؛ تنظیمات هر چهار بخش محصولات، کلینیک‌ها، داروخانه‌ها و داروها لازم است.",
        );
      if (!mounted.current) return;
      if (
        formRef.current?.dataset.dirty === "true" &&
        !(await confirmAction(
          "باز کردن فایل، پیش‌نویس فعلی را جایگزین می‌کند.",
          "جایگزینی پیش‌نویس",
        ))
      )
        return;
      if (!mounted.current) return;
      Object.values(imagesRef.current).forEach((image) =>
        URL.revokeObjectURL(image.url),
      );
      imagesRef.current = {};
      setLocalImages({});
      setContent(imported);
      setSectionRevision((current) => current + 1);
      chooseSlide(imported.slides[0]!.id);
      dirty();
      setNotice(
        "تنظیمات در پیش‌نویس باز شد؛ فایل‌های تصویر باید جداگانه در دسترس باشند. سایت تغییر نکرده است.",
      );
    } catch (problem) {
      if (mounted.current)
        setError(
          problem instanceof SyntaxError
            ? "فایل JSON معتبر نیست."
            : problem instanceof Error
              ? problem.message
              : "فایل باز نشد.",
        );
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return (
    <section className="landing-editor">
      <header className="manage-head">
        <div>
          <span className="eyebrow">مدیریت لندینگ</span>
          <h1>محتوای صفحهٔ اصلی</h1>
          <p>نوار اعلان، بنر و محتوای همهٔ بخش‌های صفحهٔ اصلی.</p>
        </div>
        <span className="landing-draft-status">پیش‌نویس؛ منتشر نشده</span>
      </header>
      <aside className="landing-integration-note">
        <strong>انتشار از پنل هنوز به سرور متصل نیست</strong>
        <p>
          تغییرها در همین صفحه باقی می‌مانند و با بستن آن از بین می‌روند.
          تنظیمات و تصاویر را دانلود کنید تا برای اتصال و انتشار آماده باشند؛
          خروجی گرفتن، صفحهٔ اصلی سایت را تغییر نمی‌دهد.
        </p>
      </aside>
      {error && (
        <p className="manage-notice manage-notice--error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="manage-notice manage-notice--success" role="status">
          {notice}
        </p>
      )}
      <form
        ref={formRef}
        data-draft-editor
        className="landing-draft-form"
        onSubmit={(event) => event.preventDefault()}
      >
        <fieldset disabled={busy} className="landing-all-fields">
          <legend className="landing-sr-only">
            پیش‌نویس محتوای صفحهٔ اصلی
          </legend>
          <section className="manage-card">
            <h2>نوار اعلان بالای منو</h2>
            <div className="landing-form-grid">
              <label className="landing-check">
                <input
                  type="checkbox"
                  checked={content.announcement.enabled}
                  onChange={(event) =>
                    updateAnnouncement({ enabled: event.target.checked })
                  }
                />
                نمایش نوار اعلان
              </label>
              <label className="landing-field landing-full">
                متن اعلان
                <input
                  name="announcementText"
                  value={content.announcement.text}
                  maxLength={180}
                  onChange={(event) =>
                    updateAnnouncement({ text: event.target.value })
                  }
                />
              </label>
              <label className="landing-field landing-full">
                لینک اعلان (اختیاری)
                <input
                  dir="ltr"
                  name="announcementHref"
                  value={content.announcement.href ?? ""}
                  placeholder="/products"
                  onChange={(event) =>
                    updateAnnouncement({ href: event.target.value })
                  }
                />
                <small>
                  فقط نشانی داخلی سایت؛ بدون لینک، نوار صرفاً اطلاع‌رسانی است.
                </small>
              </label>
            </div>
          </section>

          <section className="manage-card">
            <div className="landing-section-head">
              <h2>اسلایدهای بنر</h2>
              <button
                type="button"
                onClick={addSlide}
                disabled={content.slides.length >= 12}
              >
                افزودن اسلاید
              </button>
            </div>
            <p className="landing-help">
              ترتیب اسلایدها از راست به چپ است. اسلاید غیرفعال در سایت نمایش
              داده نمی‌شود.
            </p>
            <div className="landing-slide-list" aria-label="انتخاب اسلاید">
              {content.slides.map((item, position) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={item.id === slide.id}
                  onClick={() => chooseSlide(item.id)}
                >
                  <span>{number.format(position + 1)}</span>
                  <strong>{item.title || "اسلاید تازه"}</strong>
                  <small>{item.enabled ? "فعال" : "غیرفعال"}</small>
                </button>
              ))}
            </div>
            <div className="landing-section-head">
              <h3>ویرایش اسلاید {number.format(index + 1)}</h3>
              <div className="landing-row-actions">
                <button
                  type="button"
                  onClick={() => moveSlide(-1)}
                  disabled={index === 0}
                >
                  یک جایگاه جلوتر
                </button>
                <button
                  type="button"
                  onClick={() => moveSlide(1)}
                  disabled={index === content.slides.length - 1}
                >
                  یک جایگاه عقب‌تر
                </button>
                <button
                  data-draft-keep
                  type="button"
                  className="landing-remove"
                  onClick={() => void removeSlide()}
                  disabled={content.slides.length === 1}
                >
                  حذف اسلاید
                </button>
              </div>
            </div>
            <div className="landing-form-grid">
              <label className="landing-check landing-full">
                <input
                  name="slideEnabled"
                  type="checkbox"
                  checked={slide.enabled}
                  onChange={(event) =>
                    updateSlide({ enabled: event.target.checked })
                  }
                />
                نمایش این اسلاید
              </label>
              <label className="landing-field landing-full">
                عنوان اسلاید
                <input
                  name="slideTitle"
                  value={slide.title}
                  maxLength={90}
                  onChange={(event) =>
                    updateSlide({ title: event.target.value })
                  }
                />
              </label>
              <label className="landing-field landing-full">
                توضیح کوتاه
                <textarea
                  value={slide.description}
                  maxLength={220}
                  onChange={(event) =>
                    updateSlide({ description: event.target.value })
                  }
                />
              </label>
              <label className="landing-field">
                متن دکمه
                <input
                  name="slideCta"
                  value={slide.ctaLabel}
                  maxLength={45}
                  onChange={(event) =>
                    updateSlide({ ctaLabel: event.target.value })
                  }
                />
              </label>
              <label className="landing-field">
                لینک دکمه
                <input
                  dir="ltr"
                  name="slideHref"
                  value={slide.href}
                  onChange={(event) =>
                    updateSlide({ href: event.target.value })
                  }
                />
              </label>
              <label className="landing-field landing-full">
                توضیح تصویر برای دسترس‌پذیری
                <input
                  name="slideAlt"
                  value={slide.alt}
                  maxLength={220}
                  onChange={(event) => updateSlide({ alt: event.target.value })}
                />
              </label>
            </div>
            <div className="landing-image-actions">
              <input
                ref={imageInput}
                data-draft-selector
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="landing-sr-only"
                tabIndex={-1}
                aria-label="فایل تصویر بنر"
                onChange={(event) => void uploadImage(event)}
              />
              <button type="button" onClick={() => imageInput.current?.click()}>
                انتخاب تصویر بنر
              </button>
              {localImages[slide.id] && (
                <button
                  type="button"
                  onClick={() => {
                    const image = localImages[slide.id]!;
                    downloadLandingFile(image.file, image.name);
                  }}
                >
                  دانلود تصویر اصلی
                </button>
              )}
              <small>
                JPEG، PNG یا WebP؛ حداکثر ۱۰ مگابایت. برش خودکار تصویر را کشیده
                یا فشرده نمی‌کند.
              </small>
            </div>
            {imageFailed && (
              <p className="manage-notice manage-notice--error">
                تصویر در دسترس نیست. فایل اصلی بنر را دوباره انتخاب کنید.
              </p>
            )}
            <div className="landing-crop-grid">
              {(["desktop", "mobile"] as const).map((device) => {
                const point =
                  device === "desktop" ? slide.desktopFocus : slide.mobileFocus;
                const title = device === "desktop" ? "دسکتاپ" : "موبایل";
                const deviceSource =
                  device === "desktop" ? source : mobileSource;
                return (
                  <section
                    className={`landing-crop landing-crop--${device}`}
                    key={device}
                  >
                    <h3>کادر {title}</h3>
                    <div className="landing-crop-frame">
                      <img
                        key={`${deviceSource}-${device}`}
                        src={deviceSource}
                        alt={slide.alt}
                        style={{ objectPosition: `${point.x}% ${point.y}%` }}
                        onLoad={() =>
                          setFailedImages((current) => ({
                            ...current,
                            [deviceSource]: false,
                          }))
                        }
                        onError={() =>
                          setFailedImages((current) => ({
                            ...current,
                            [deviceSource]: true,
                          }))
                        }
                      />
                    </div>
                    <p className="landing-help">
                      {device === "desktop"
                        ? "۱۶۰۰ × ۷۰۰ پیکسل؛ نسبت ۱۶ به ۷"
                        : "۷۲۰ × ۹۰۰ پیکسل؛ نسبت ۴ به ۵"}
                    </p>
                    <label className="landing-range">
                      جابه‌جایی افقی کادر {title}
                      <input
                        type="range"
                        aria-label={`جابه‌جایی افقی کادر ${title}`}
                        aria-valuetext={`${number.format(point.x)} درصد`}
                        min={0}
                        max={100}
                        value={point.x}
                        onChange={(event) =>
                          updateSlide({
                            [device === "desktop"
                              ? "desktopFocus"
                              : "mobileFocus"]: {
                              ...point,
                              x: Number(event.target.value),
                            },
                          })
                        }
                      />
                      <span aria-hidden="true">{number.format(point.x)}٪</span>
                    </label>
                    <label className="landing-range">
                      جابه‌جایی عمودی کادر {title}
                      <input
                        type="range"
                        aria-label={`جابه‌جایی عمودی کادر ${title}`}
                        aria-valuetext={`${number.format(point.y)} درصد`}
                        min={0}
                        max={100}
                        value={point.y}
                        onChange={(event) =>
                          updateSlide({
                            [device === "desktop"
                              ? "desktopFocus"
                              : "mobileFocus"]: {
                              ...point,
                              y: Number(event.target.value),
                            },
                          })
                        }
                      />
                      <span aria-hidden="true">{number.format(point.y)}٪</span>
                    </label>
                    <div className="landing-row-actions">
                      <button
                        type="button"
                        onClick={() =>
                          updateSlide({
                            [device === "desktop"
                              ? "desktopFocus"
                              : "mobileFocus"]: { x: 50, y: 50 },
                          })
                        }
                      >
                        مرکز کادر
                      </button>
                      <button
                        type="button"
                        disabled={!!failedImages[deviceSource]}
                        onClick={() => void crop(device)}
                      >
                        دانلود برش {title}
                      </button>
                    </div>
                  </section>
                );
              })}
            </div>
            <aside className="landing-preview-copy">
              <small>پیش‌نمایش متن اسلاید</small>
              <h3>{slide.title || "عنوان اسلاید"}</h3>
              <p>{slide.description}</p>
              <span>{slide.ctaLabel || "متن دکمه"}</span>
            </aside>
          </section>

          <section className="manage-card">
            <h2>معیار پرفروش‌ترین‌ها</h2>
            <p className="landing-help">
              پس از اتصال به سرور، این معیار فقط فروش پرداخت‌شده را می‌سنجد.
              اتصال آن به فهرست محصولات هنوز آماده نیست.
            </p>
            <div className="landing-form-grid">
              <label className="landing-field">
                معیار فروش
                <select
                  value={content.ranking.metric}
                  onChange={(event) => {
                    dirty();
                    setContent((current) => ({
                      ...current,
                      ranking: {
                        ...current.ranking,
                        metric: event.target
                          .value as Content["ranking"]["metric"],
                      },
                    }));
                  }}
                >
                  <option value="paid_units">تعداد واحد فروخته‌شده</option>
                  <option value="paid_revenue">مبلغ فروش پرداخت‌شده</option>
                </select>
              </label>
              <label className="landing-field">
                بازهٔ آمار
                <select
                  value={content.ranking.days}
                  onChange={(event) => {
                    dirty();
                    setContent((current) => ({
                      ...current,
                      ranking: {
                        ...current.ranking,
                        days: Number(event.target.value),
                      },
                    }));
                  }}
                >
                  {[...new Set([7, 30, 90, 365, content.ranking.days])]
                    .sort((a, b) => a - b)
                    .map((days) => (
                      <option key={days} value={days}>
                        {number.format(days)} روز اخیر
                      </option>
                    ))}
                </select>
              </label>
              <label className="landing-field">
                تعداد محصولات
                <select
                  value={content.ranking.limit}
                  onChange={(event) => {
                    dirty();
                    setContent((current) => ({
                      ...current,
                      ranking: {
                        ...current.ranking,
                        limit: Number(event.target.value),
                      },
                    }));
                  }}
                >
                  {[...new Set([4, 6, 8, 12, content.ranking.limit])]
                    .sort((a, b) => a - b)
                    .map((limit) => (
                      <option key={limit} value={limit}>
                        {number.format(limit)} محصول
                      </option>
                    ))}
                </select>
              </label>
            </div>
          </section>
          <LandingSectionsEditor
            key={sectionRevision}
            sections={content.sections}
            onChange={(sections) => {
              dirty();
              setContent((current) => ({ ...current, sections }));
            }}
            onBusyChange={(value) => {
              pending.current = value;
              setBusy(value);
            }}
          />
          <div className="landing-export-bar">
            <div>
              <strong>نگهداری پیش‌نویس</strong>
              <p>
                خروجی تنظیمات شامل تصاویر نیست. تصویرهای تازه را جداگانه دانلود
                کنید.
              </p>
            </div>
            <div className="landing-row-actions">
              <input
                ref={importInput}
                data-draft-selector
                type="file"
                accept="application/json,.json"
                className="landing-sr-only"
                tabIndex={-1}
                aria-label="فایل تنظیمات لندینگ"
                onChange={(event) => void importDraft(event)}
              />
              <button
                type="button"
                data-draft-keep
                onClick={() => importInput.current?.click()}
              >
                باز کردن فایل تنظیمات
              </button>
              <button
                className="landing-primary"
                type="button"
                onClick={exportDraft}
              >
                دانلود تنظیمات پیش‌نویس
              </button>
            </div>
          </div>
        </fieldset>
      </form>
      {busy && (
        <p role="status" className="landing-help">
          در حال آماده‌سازی فایل…
        </p>
      )}
    </section>
  );
}
