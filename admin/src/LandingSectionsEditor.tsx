import { TomanInput } from './TomanInput';
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  landingSample,
  safeLandingLink,
  type LandingContent,
  type LandingItem,
} from "../../frontend/src/features/landing/content";
import { confirmAction, normalizeDigits } from "./management";
import { loadCropImage, verifyRaster } from "./landing-crop";
import { downloadLandingFile } from "./landing-files";

type Sections = LandingContent["sections"];
type SectionKey = keyof Sections;
const sectionLabels: Record<SectionKey, string> = {
  products: "پرفروش‌ترین محصولات",
  clinics: "کلینیک‌ها",
  pharmacies: "داروخانه‌ها",
  medicines: "داروها",
};
const sectionKeys = ["products", "clinics", "pharmacies", "medicines"] as const;
const number = new Intl.NumberFormat("fa-IR");
const imagePath = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\/brand\/[a-zA-Z0-9_-]+\.(webp|png|jpg|jpeg)$/.test(value);
const internalPath = (value: unknown): value is string =>
  typeof value === "string" && value !== "" && safeLandingLink(value);
const boundedText = (value: unknown, length: number): value is string =>
  typeof value === "string" && value.length <= length;

export function validateLandingSections(value: unknown): value is Sections {
  if (!value || typeof value !== "object") return false;
  const keys = Object.keys(value);
  if (
    keys.length !== sectionKeys.length ||
    keys.some((key) => !sectionKeys.includes(key as SectionKey))
  )
    return false;
  const sections = value as Partial<Sections>;
  return sectionKeys.every((key) => {
    const section = sections[key];
    return (
      !!section &&
      boundedText(section.title, 90) &&
      typeof section.demo === "boolean" &&
      Array.isArray(section.items) &&
      section.items.length <= 12 &&
      new Set(section.items.map((item) => item?.id)).size ===
        section.items.length &&
      section.items.every(
        (item) =>
          !!item &&
          boundedText(item.id, 64) &&
          /^[a-zA-Z0-9_-]+$/.test(item.id) &&
          !Object.hasOwn(Object.prototype, item.id) &&
          boundedText(item.title, 90) &&
          boundedText(item.description, 220) &&
          imagePath(item.image) &&
          internalPath(item.href) &&
          (item.badge === undefined || boundedText(item.badge, 40)) &&
          (item.price === undefined ||
            (Number.isSafeInteger(item.price) && item.price >= 0)),
      )
    );
  });
}

export function completeLandingSections(value: Sections): boolean {
  return sectionKeys.every(
    (key) =>
      value[key].title.trim() &&
      value[key].items.every((item) => item.title.trim()),
  );
}

type LocalImage = { file: File; url: string; name: string };
export function LandingSectionsEditor({
  selected,
  selectedItem,
  onSelectItem: setSelectedItem,
  sections,
  onChange,
  onBusyChange,
}: {
  selected: SectionKey;
  selectedItem: string;
  onSelectItem: (id: string) => void;
  sections: Sections;
  onChange: (sections: Sections) => void;
  onBusyChange: (value: boolean) => void;
}) {
  const [images, setImages] = useState<Record<string, LocalImage>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const input = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  const pending = useRef(false);
  const imageRefs = useRef<Record<string, LocalImage>>({});
  const nextItem = useRef(0);
  const section = sections[selected];
  const item =
    section.items.find((row) => row.id === selectedItem) ?? section.items[0];
  const index = item
    ? section.items.findIndex((row) => row.id === item.id)
    : -1;
  const imageKey = item ? `${selected}:${item.id}` : "";
  const source = item ? (images[imageKey]?.url ?? item.image) : "";

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      Object.values(imageRefs.current).forEach((image) =>
        URL.revokeObjectURL(image.url),
      );
    };
  }, []);

  function updateSection(patch: Partial<Sections[SectionKey]>) {
    setNotice("");
    onChange({ ...sections, [selected]: { ...section, ...patch } });
  }
  function updateItem(patch: Partial<LandingItem>) {
    if (!item) return;
    updateSection({
      items: section.items.map((row) =>
        row.id === item.id ? { ...row, ...patch } : row,
      ),
    });
  }
  function addItem() {
    if (section.items.length >= 12) return;
    const id = `item-${Date.now().toString(36)}-${++nextItem.current}`;
    const defaults = landingSample.sections[selected].items[0];
    updateSection({
      items: [
        ...section.items,
        {
          id,
          title: "مورد تازه",
          description: "",
          image: defaults?.image ?? "/brand/landing-meal-1600.webp",
          href: defaults?.href ?? `/${selected}`,
        },
      ],
    });
    setSelectedItem(id);
    setError("");
  }
  function move(direction: -1 | 1) {
    const destination = index + direction;
    if (destination < 0 || destination >= section.items.length) return;
    if (item) setSelectedItem(item.id);
    const items = [...section.items];
    [items[index], items[destination]] = [items[destination]!, items[index]!];
    updateSection({ items });
  }
  async function remove() {
    if (
      !item ||
      pending.current ||
      !(await confirmAction(
        "این مورد فقط از پیش‌نویس حذف می‌شود؛ داده‌های واقعی فروشگاه تغییر نمی‌کنند.",
        "حذف مورد",
      ))
    )
      return;
    const remaining = section.items.filter((row) => row.id !== item.id);
    updateSection({ items: remaining });
    setSelectedItem(remaining[Math.min(index, remaining.length - 1)]?.id ?? "");
    const image = imageRefs.current[imageKey];
    if (image) URL.revokeObjectURL(image.url);
    const next = { ...imageRefs.current };
    delete next[imageKey];
    imageRefs.current = next;
    setImages(next);
  }
  function price(value: string) {
    const raw = normalizeDigits(value).replace(/[,٬،\s]/g, "");
    if (raw === "") {
      setError("");
      updateItem({ price: undefined });
      return;
    }
    const amount = Number(raw);
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(amount) || amount < 0) {
      setError(
        "قیمت نمونه باید عدد صحیح و نامنفی باشد؛ بدون علامت منفی یا اعشار.",
      );
      return;
    }
    setError("");
    updateItem({ price: amount });
  }
  function releaseImage() {
    const previous = imageRefs.current[imageKey];
    if (!previous) return;
    URL.revokeObjectURL(previous.url);
    const next = { ...imageRefs.current };
    delete next[imageKey];
    imageRefs.current = next;
    setImages(next);
  }
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!item || !file || pending.current) return;
    pending.current = true;
    onBusyChange(true);
    setError("");
    setNotice("");
    let url = "";
    try {
      await verifyRaster(file);
      url = URL.createObjectURL(file);
      await loadCropImage(url);
      if (!mounted.current) {
        URL.revokeObjectURL(url);
        return;
      }
      const extension =
        file.type === "image/jpeg"
          ? "jpg"
          : file.type === "image/png"
            ? "png"
            : "webp";
      const name = `landing-${selected}-${item.id}.${extension}`;
      releaseImage();
      const next = { ...imageRefs.current, [imageKey]: { file, url, name } };
      imageRefs.current = next;
      setImages(next);
      updateItem({ image: `/brand/${name}` });
      setNotice(
        "تصویر در پیش‌نویس باز شد. آن را جداگانه دانلود کنید؛ هنوز به سرور منتقل نشده است.",
      );
    } catch (problem) {
      if (url) URL.revokeObjectURL(url);
      if (mounted.current)
        setError(problem instanceof Error ? problem.message : "تصویر باز نشد.");
    } finally {
      pending.current = false;
      if (mounted.current) onBusyChange(false);
    }
  }

  return (
    <section className="manage-card landing-sections-editor">
      <h2>{sectionLabels[selected]}</h2>
      <p className="landing-help">
        ترتیب صفحه ثابت است: محصولات، کلینیک‌ها، داروخانه‌ها و داروها. نام بخش و
        کارت‌های نمونه را اینجا ویرایش کنید.
      </p>
      <div className="landing-form-grid">
        <label className="landing-field">
          عنوان بخش
          <input
            name={`sectionTitle-${selected}`}
            value={section.title}
            maxLength={90}
            onChange={(event) => updateSection({ title: event.target.value })}
          />
        </label>
        <label className="landing-check landing-full">
          <input
            type="checkbox"
            checked={section.demo}
            onChange={(event) => updateSection({ demo: event.target.checked })}
          />
          نمونهٔ نمایش
        </label>
      </div>
      <p className="landing-integration-note">
        {section.demo
          ? "کارت‌ها برای ارائهٔ طراحی هستند و با برچسب «نمونه» نمایش داده می‌شوند؛ موجودی، قیمت، مرکز و فروش واقعی را معرفی نمی‌کنند."
          : "در حالت واقعی، کارت‌ها باید از داده‌های سرور بیایند. تغییر این گزینه در پیش‌نویس، اتصال یا انتشار را فعال نمی‌کند."}
      </p>
      {error && (
        <p role="alert" className="manage-notice manage-notice--error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="manage-notice manage-notice--success">
          {notice}
        </p>
      )}
      <div className="landing-section-head">
        <h3>کارت‌های {sectionLabels[selected]}</h3>
        <button
          type="button"
          onClick={addItem}
          disabled={section.items.length >= 12}
        >
          افزودن مورد
        </button>
      </div>
      <div className="landing-slide-list" aria-label="انتخاب کارت نمونه">
        {section.items.map((row, position) => (
          <button
            type="button"
            key={row.id}
            aria-pressed={row.id === item?.id}
            onClick={() => {
              setSelectedItem(row.id);
              setError("");
              setNotice("");
            }}
          >
            <span>{number.format(position + 1)}</span>
            <strong>{row.title || "بدون عنوان"}</strong>
            <small>نمونهٔ قابل ویرایش</small>
          </button>
        ))}
      </div>
      {!item ? (
        <p className="landing-help">
          این بخش کارت نمونه ندارد. یک مورد اضافه کنید.
        </p>
      ) : (
        <>
          <div className="landing-section-head">
            <h3>ویرایش کارت {number.format(index + 1)}</h3>
            <div className="landing-row-actions">
              <button
                type="button"
                disabled={index === 0}
                onClick={() => move(-1)}
              >
                مورد یک جایگاه جلوتر
              </button>
              <button
                type="button"
                disabled={index === section.items.length - 1}
                onClick={() => move(1)}
              >
                مورد یک جایگاه عقب‌تر
              </button>
              <button
                type="button"
                data-draft-keep
                onClick={() => void remove()}
              >
                حذف مورد
              </button>
            </div>
          </div>
          <div className="landing-form-grid">
            <label className="landing-field landing-full">
              نام مورد
              <input
                name={`itemTitle-${selected}-${item.id}`}
                value={item.title}
                maxLength={90}
                onChange={(event) => updateItem({ title: event.target.value })}
              />
            </label>
            <label className="landing-field landing-full">
              توضیح مورد
              <textarea
                value={item.description}
                maxLength={220}
                onChange={(event) =>
                  updateItem({ description: event.target.value })
                }
              />
            </label>
            <label className="landing-field">
              لینک مورد
              <input
                dir="ltr"
                value={item.href}
                name={`itemHref-${selected}-${item.id}`}
                placeholder={`/${selected}`}
                onChange={(event) => updateItem({ href: event.target.value })}
              />
            </label>
            <label className="landing-field">
              قیمت نمونه (تومان؛ اختیاری)
              <TomanInput


                value={item.price ?? ""}
                onValueChange={price}
              />
            </label>
            <label className="landing-field">
              برچسب مورد (اختیاری)
              <input
                value={item.badge ?? ""}
                maxLength={40}
                onChange={(event) =>
                  updateItem({ badge: event.target.value || undefined })
                }
              />
            </label>
          </div>
          <div className="landing-image-actions">
            <input
              ref={input}
              data-draft-selector
              className="landing-sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-label="فایل تصویر مورد"
              tabIndex={-1}
              onChange={(event) => void upload(event)}
            />
            <button type="button" onClick={() => input.current?.click()}>
              انتخاب تصویر مورد
            </button>
            {images[imageKey] && (
              <button
                type="button"
                onClick={() => {
                  const image = images[imageKey]!;
                  downloadLandingFile(image.file, image.name);
                }}
              >
                دانلود تصویر اصلی مورد
              </button>
            )}
            <small>
              JPEG، PNG یا WebP؛ حداکثر ۱۰ مگابایت. تصویر تازه همراه فایل
              تنظیمات دانلود شود.
            </small>
          </div>
          <div className="landing-item-preview">
            <div className="landing-item-preview__image">
              {imagePath(item.image) ? (
                <img
                  key={source}
                  src={source}
                  alt=""
                  onError={() =>
                    setFailedImages((current) => ({
                      ...current,
                      [source]: true,
                    }))
                  }
                  onLoad={() =>
                    setFailedImages((current) => ({
                      ...current,
                      [source]: false,
                    }))
                  }
                />
              ) : null}
              {(!imagePath(item.image) || failedImages[source]) && (
                <span>تصویر در دسترس نیست</span>
              )}
            </div>
            <div>
              <small>نمونهٔ پیش‌نمایش؛ منتشر نشده</small>
              <h3>{item.title || "نام مورد"}</h3>
              <p>{item.description}</p>
              {item.badge && (
                <span className="landing-preview-badge">{item.badge}</span>
              )}
              {item.price !== undefined && (
                <strong>{number.format(item.price)} تومان؛ نمونه</strong>
              )}
              <span className="landing-help">
                {internalPath(item.href)
                  ? "لینک داخلی معتبر"
                  : "لینک داخلی را با / آغاز کنید"}
              </span>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
