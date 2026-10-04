import { useState, type FormEvent } from "react";
import { ApiError } from "./api/client";
import { useAuth } from "./auth";
import { safeImageUrl, type CatalogTag, type NamedRef } from "./catalog-model";

export type ReferenceKind =
  "brands" | "categories" | "pet-types" | "breeds" | "tags";
export interface CatalogReferences {
  brands: NamedRef[];
  categories: NamedRef[];
  petTypes: NamedRef[];
  breeds: NamedRef[];
  tags: CatalogTag[];
}

const definitions: Array<{ kind: ReferenceKind; label: string }> = [
  { kind: "brands", label: "برندها" },
  { kind: "categories", label: "دسته‌بندی‌ها" },
  { kind: "pet-types", label: "نوع حیوان" },
  { kind: "breeds", label: "نژادها" },
  { kind: "tags", label: "برچسب‌ها" },
];

const message = (error: unknown) =>
  error instanceof ApiError || error instanceof Error
    ? error.message
    : "درخواست انجام نشد. دوباره تلاش کنید.";

export function CatalogReferencesManager({
  refs,
  onBack,
  onChanged,
}: {
  refs: CatalogReferences;
  onBack: () => void;
  onChanged: () => void;
}) {
  const { request } = useAuth();
  const [kind, setKind] = useState<ReferenceKind>("brands");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [petTypeId, setPetTypeId] = useState("");
  const [parentId, setParentId] = useState("");
  const [tagType, setTagType] = useState<"ALLERGEN" | "DIET">("ALLERGEN");
  const [country, setCountry] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const items =
    kind === "pet-types"
      ? refs.petTypes
      : kind === "tags"
        ? refs.tags
        : kind === "brands"
          ? refs.brands
          : kind === "categories"
            ? refs.categories
            : refs.breeds;
  const label =
    definitions.find((item) => item.kind === kind)?.label || "داده‌های مرجع";
  const selected = items.find((item) => item.id === selectedId);

  function reset() {
    setSelectedId(null);
    setName("");
    setPetTypeId("");
    setParentId("");
    setTagType("ALLERGEN");
    setCountry("");
    setDescription("");
    setImage("");
    setIsActive(true);
    setError("");
    setNotice("");
  }

  function select(item: NamedRef | CatalogTag) {
    setSelectedId(item.id);
    setName(item.name);
    setPetTypeId(item.petTypeId ? String(item.petTypeId) : "");
    setParentId(
      "parentId" in item && typeof item.parentId === "number"
        ? String(item.parentId)
        : "",
    );
    setTagType("type" in item && item.type === "DIET" ? "DIET" : "ALLERGEN");
    setCountry(
      "country" in item && typeof item.country === "string" ? item.country : "",
    );
    setDescription(
      "description" in item && typeof item.description === "string"
        ? item.description
        : "",
    );
    setImage(
      "image" in item && typeof item.image === "string"
        ? item.image
        : "logo" in item && typeof item.logo === "string"
          ? item.logo
          : "",
    );
    setIsActive(item.isActive);
    setError("");
    setNotice("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (name.trim().length < 2) {
      setError("نام باید دست‌کم دو نویسه باشد.");
      return;
    }
    if (kind === "breeds" && !petTypeId) {
      setError("نوع حیوان برای نژاد الزامی است.");
      return;
    }
    if (image.trim() && !safeImageUrl(image.trim())) {
      setError("نشانی تصویر معتبر نیست.");
      return;
    }
    const parsedPetType = petTypeId ? Number(petTypeId) : undefined;
    const parsedParent = parentId ? Number(parentId) : undefined;
    if (
      selectedId !== null &&
      kind === "categories" &&
      parsedParent === selectedId
    ) {
      setError("دسته‌بندی نمی‌تواند والد خودش باشد.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      let body: Record<string, unknown> = { name: name.trim() };
      if (kind === "brands") {
        body = {
          ...body,
          country: country.trim() || null,
          description: description.trim() || null,
          logo: image.trim() || null,
          isActive,
        };
      } else if (kind === "categories") {
        body = {
          ...body,
          petTypeId: parsedPetType || null,
          parentId: parsedParent || null,
          image: image.trim() || null,
          isActive,
        };
      } else if (kind === "breeds") {
        body =
          selectedId === null
            ? { ...body, petTypeId: parsedPetType, isActive }
            : { ...body, isActive };
      } else if (kind === "pet-types") {
        body = { ...body, isActive };
      } else if (selectedId === null) {
        body = { ...body, type: tagType };
      }
      if (kind === "tags" && selectedId !== null) body = { name: name.trim() };
      if (selectedId === null) {
        await request("/admin/" + kind, { method: "POST", body });
      } else {
        await request("/admin/" + kind + "/" + selectedId, {
          method: "PATCH",
          body,
        });
      }
      onChanged();
      if (selectedId === null) reset();
      setNotice(
        selectedId === null ? "مورد تازه ثبت شد." : "تغییرات ذخیره شد.",
      );
    } catch (problem) {
      setError(message(problem));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (
      selectedId === null ||
      busy ||
      !window.confirm("این مورد حذف یا در صورت استفاده غیرفعال شود؟")
    )
      return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await request("/admin/" + kind + "/" + selectedId, { method: "DELETE" });
      onChanged();
      reset();
      setNotice("حذف یا غیرفعال‌سازی انجام شد.");
    } catch (problem) {
      setError(message(problem));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="catalog-intro">
        <div>
          <span className="eyebrow">کاتالوگ / داده‌های مرجع</span>
          <h1>داده‌های مرجع</h1>
          <p>
            برند، دسته‌بندی، نوع حیوان، نژاد و برچسب‌های قابل استفاده در
            فروشگاه.
          </p>
        </div>
        <div className="catalog-intro__actions">
          <button
            type="button"
            className="button button--ghost"
            onClick={onBack}
          >
            بازگشت به محصولات
          </button>
        </div>
      </div>
      <div className="reference-layout">
        <section className="catalog-panel reference-list" aria-label={label}>
          <div
            className="catalog-filters reference-tabs"
            role="group"
            aria-label="نوع دادهٔ مرجع"
          >
            {definitions.map((item) => (
              <button
                type="button"
                key={item.kind}
                aria-pressed={kind === item.kind}
                onClick={() => {
                  setKind(item.kind);
                  reset();
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="catalog-panel__head">
            <span>{String(items.length).padStart(2, "0")}</span>
            <div>
              <h2>{label}</h2>
              <p>برای ویرایش، یک مورد را انتخاب کنید.</p>
            </div>
          </div>
          <div className="reference-items">
            {items.map((item) => (
              <button
                type="button"
                key={item.id}
                className={
                  selectedId === item.id
                    ? "reference-item reference-item--active"
                    : "reference-item"
                }
                onClick={() => select(item)}
              >
                <span>
                  <strong>{item.name}</strong>
                  <small>
                    #{item.id}
                    {"type" in item
                      ? ` · ${item.type === "ALLERGEN" ? "حساسیت‌زا" : "رژیم"}`
                      : ""}
                  </small>
                </span>
                <span
                  className={
                    item.isActive
                      ? "reference-state reference-state--active"
                      : "reference-state"
                  }
                >
                  {item.isActive ? "فعال" : "غیرفعال"}
                </span>
              </button>
            ))}
            {!items.length && <p className="empty">هنوز موردی ثبت نشده است.</p>}
          </div>
        </section>
        <section
          className="catalog-panel reference-editor"
          aria-label="ویرایش دادهٔ مرجع"
        >
          <div className="catalog-panel__head">
            <span>{selected ? "✎" : "+"}</span>
            <div>
              <h2>
                {selected ? `ویرایش ${selected.name}` : `افزودن به ${label}`}
              </h2>
              <p>تغییرات پس از پاسخ موفق API در فهرست دیده می‌شوند.</p>
            </div>
          </div>
          <form
            onSubmit={(event) => void save(event)}
            className="catalog-fields"
          >
            <label className="catalog-field catalog-field--wide">
              نام <b>*</b>
              <input
                required
                minLength={2}
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={busy}
              />
            </label>
            {(kind === "breeds" || kind === "categories") && (
              <label className="catalog-field">
                نوع حیوان {kind === "breeds" && <b>*</b>}
                <select
                  value={petTypeId}
                  required={kind === "breeds"}
                  disabled={busy || (kind === "breeds" && selectedId !== null)}
                  onChange={(event) => setPetTypeId(event.target.value)}
                >
                  <option value="">
                    {kind === "breeds" ? "انتخاب کنید" : "همه"}
                  </option>
                  {refs.petTypes
                    .filter((item) => item.isActive)
                    .map((item) => (
                      <option value={item.id} key={item.id}>
                        {item.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
            {kind === "categories" && (
              <label className="catalog-field">
                دستهٔ والد
                <select
                  value={parentId}
                  disabled={busy}
                  onChange={(event) => setParentId(event.target.value)}
                >
                  <option value="">بدون والد</option>
                  {refs.categories
                    .filter((item) => item.id !== selectedId)
                    .map((item) => (
                      <option value={item.id} key={item.id}>
                        {item.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
            {kind === "tags" && selectedId === null && (
              <label className="catalog-field">
                نوع برچسب
                <select
                  value={tagType}
                  disabled={busy}
                  onChange={(event) =>
                    setTagType(event.target.value as "ALLERGEN" | "DIET")
                  }
                >
                  <option value="ALLERGEN">حساسیت‌زا</option>
                  <option value="DIET">رژیم مناسب</option>
                </select>
              </label>
            )}
            {kind === "brands" && (
              <>
                <label className="catalog-field">
                  کشور
                  <input
                    value={country}
                    onChange={(event) => setCountry(event.target.value)}
                    disabled={busy}
                  />
                </label>
                <label className="catalog-field catalog-field--wide">
                  توضیحات
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    disabled={busy}
                  />
                </label>
              </>
            )}
            {(kind === "brands" || kind === "categories") && (
              <label className="catalog-field catalog-field--wide">
                نشانی تصویر
                <input
                  dir="ltr"
                  value={image}
                  onChange={(event) => setImage(event.target.value)}
                  disabled={busy}
                  placeholder="/uploads/image.webp یا https://…"
                />
              </label>
            )}
            {kind !== "tags" && kind !== "breeds" && (
              <label className="catalog-switch">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(event) => setIsActive(event.target.checked)}
                  disabled={busy}
                />
                فعال باشد
              </label>
            )}
            {kind === "breeds" && selectedId !== null && (
              <label className="catalog-switch">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(event) => setIsActive(event.target.checked)}
                  disabled={busy}
                />
                فعال باشد
              </label>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            {notice && (
              <p
                className="catalog-notice catalog-notice--success"
                role="status"
              >
                {notice}
              </p>
            )}
            <div className="reference-actions">
              <button
                type="submit"
                className="button button--primary"
                disabled={busy}
              >
                {busy
                  ? "در حال ذخیره…"
                  : selected
                    ? "ذخیرهٔ تغییرات"
                    : "ثبت مورد تازه"}
              </button>
              {selected && (
                <>
                  <button
                    type="button"
                    className="button button--ghost"
                    onClick={reset}
                    disabled={busy}
                  >
                    مورد تازه
                  </button>
                  <button
                    type="button"
                    className="button button--outline"
                    onClick={() => void remove()}
                    disabled={busy}
                  >
                    حذف / غیرفعال‌سازی
                  </button>
                </>
              )}
            </div>
          </form>
        </section>
      </div>
    </>
  );
}
