import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ApiError, type PageResult } from "./api/client";
import { useAuth } from "./auth";
import {
  CatalogReferencesManager,
  type CatalogReferences,
} from "./CatalogReferences";
import {
  createProductWorkflow,
  emptyProductDraft,
  emptyVariantDraft,
  parseNonNegativeInteger,
  PartialProductError,
  safeImageUrl,
  validateImage,
  validateProductDraft,
  variantPayload,
  type CatalogTag,
  type NamedRef,
  type ProductDetail,
  type ProductDraft,
  type ProductRow,
  type VariantDraft,
} from "./catalog-model";

const count = new Intl.NumberFormat("fa-IR");
const toman = (value: number | null) =>
  value == null ? "بدون قیمت" : count.format(value) + " تومان";

type Section = "list" | "create" | "detail" | "references";
type RefKind = "brand" | "category" | "petType";
type References = CatalogReferences;

function errorText(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof TypeError)
    return "ارتباط با API برقرار نشد. بک‌اند را بررسی کنید.";
  if (error instanceof Error) return error.message;
  return "درخواست انجام نشد. دوباره تلاش کنید.";
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={
        "catalog-status " +
        (active ? "catalog-status--active" : "catalog-status--draft")
      }
    >
      <i aria-hidden="true" />
      {active ? "فعال" : "پیش‌نویس"}
    </span>
  );
}

function Intro({
  title,
  eyebrow,
  text,
  actions,
}: {
  title: string;
  eyebrow: string;
  text: string;
  actions?: ReactNode;
}) {
  return (
    <div className="catalog-intro">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      {actions && <div className="catalog-intro__actions">{actions}</div>}
    </div>
  );
}

function QuickReference({
  kind,
  petTypeId,
  onCreated,
}: {
  kind: RefKind;
  petTypeId: string;
  onCreated: (kind: RefKind, value: NamedRef) => void;
}) {
  const { request } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const labels: Record<RefKind, string> = {
    brand: "برند",
    category: "دسته‌بندی",
    petType: "نوع حیوان",
  };
  const paths: Record<RefKind, string> = {
    brand: "brands",
    category: "categories",
    petType: "pet-types",
  };

  async function submit() {
    if (name.trim().length < 2) {
      setError("نام باید دست‌کم دو نویسه باشد.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const body =
        kind === "category" && petTypeId
          ? { name: name.trim(), petTypeId: Number(petTypeId) }
          : { name: name.trim() };
      const value = await request<NamedRef>("/admin/" + paths[kind], {
        method: "POST",
        body,
      });
      onCreated(kind, value);
      setName("");
      setOpen(false);
    } catch (problem) {
      setError(errorText(problem));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="quick-reference">
      <button
        type="button"
        className="quick-reference__trigger"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        + افزودن {labels[kind]}
      </button>
      {open && (
        <div className="quick-reference__form">
          <label>
            نام {labels[kind]}
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void submit();
                }
              }}
              placeholder={"نام " + labels[kind]}
              disabled={busy}
            />
          </label>
          <button
            type="button"
            className="button button--primary"
            disabled={busy}
            onClick={() => void submit()}
          >
            {busy ? "در حال افزودن…" : "ثبت"}
          </button>
          {error && (
            <span role="alert" className="form-error">
              {error}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function CreateProduct({
  refs,
  onBack,
  onCreated,
  onRefCreated,
}: {
  refs: References;
  onBack: () => void;
  onCreated: (id: number) => void;
  onRefCreated: (kind: RefKind, value: NamedRef) => void;
}) {
  const { request } = useAuth();
  const [draft, setDraft] = useState<ProductDraft>(emptyProductDraft);
  const [variant, setVariant] = useState<VariantDraft>(emptyVariantDraft);
  const [image, setImage] = useState<File | null>(null);
  const [contains, setContains] = useState<number[]>([]);
  const [suitableFor, setSuitableFor] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [partialId, setPartialId] = useState<number | null>(null);

  function setProduct<K extends keyof ProductDraft>(
    key: K,
    value: ProductDraft[K],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }
  function setVariantField<K extends keyof VariantDraft>(
    key: K,
    value: VariantDraft[K],
  ) {
    setVariant((current) => ({ ...current, [key]: value }));
  }
  function toggleTag(id: number, kind: "CONTAINS" | "SUITABLE_FOR") {
    const setter = kind === "CONTAINS" ? setContains : setSuitableFor;
    setter((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || partialId !== null) return;
    const problem =
      validateProductDraft(draft, variant) || validateImage(image);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const id = await createProductWorkflow(request, draft, variant, image, {
        contains,
        suitableFor,
      });
      onCreated(id);
    } catch (problem) {
      if (problem instanceof PartialProductError) {
        setPartialId(problem.productId);
        setError(
          problem.message +
            " مرحله: " +
            problem.stage +
            "؛ دلیل: " +
            errorText(problem.cause),
        );
      } else {
        setError(errorText(problem));
      }
    } finally {
      setBusy(false);
    }
  }

  const activeCategories = refs.categories.filter(
    (item) =>
      item.isActive &&
      (!item.petTypeId ||
        !draft.petTypeId ||
        item.petTypeId === Number(draft.petTypeId)),
  );
  const activeTags = refs.tags.filter((item) => item.isActive);
  return (
    <>
      <Intro
        eyebrow="کاتالوگ / محصول تازه"
        title="ثبت محصول"
        text="اطلاعات پایه، قیمت و موجودی را یک‌جا وارد کنید. انتشار محصول بعد از ثبت موفق همهٔ مراحل انجام می‌شود."
        actions={
          <button
            type="button"
            className="button button--ghost"
            onClick={onBack}
          >
            بازگشت به فهرست
          </button>
        }
      />
      {partialId !== null && (
        <div className="catalog-notice catalog-notice--warning" role="alert">
          محصول پایه با شناسهٔ <b>{count.format(partialId)}</b> ساخته شده و
          غیرفعال مانده است. برای تکمیل آن وارد جزئیات شوید.
          <button type="button" onClick={() => onCreated(partialId)}>
            مشاهده و تکمیل محصول ←
          </button>
        </div>
      )}
      <form className="catalog-form" onSubmit={(event) => void submit(event)}>
        <div className="catalog-form__main">
          <section
            className="catalog-panel"
            aria-labelledby="product-basics-title"
          >
            <div className="catalog-panel__head">
              <span>۰۱</span>
              <div>
                <h2 id="product-basics-title">شناسنامهٔ محصول</h2>
                <p>نام و دسته‌بندی‌هایی که در فروشگاه دیده می‌شوند.</p>
              </div>
            </div>
            <div className="catalog-fields">
              <label className="catalog-field catalog-field--wide">
                نام محصول <b>*</b>
                <input
                  required
                  minLength={2}
                  value={draft.name}
                  onChange={(event) => setProduct("name", event.target.value)}
                  placeholder="مثلاً غذای خشک سگ بالغ"
                  disabled={busy}
                />
              </label>
              <label className="catalog-field catalog-field--wide">
                نامک (slug)
                <input
                  dir="ltr"
                  value={draft.slug}
                  onChange={(event) => setProduct("slug", event.target.value)}
                  placeholder="اختیاری؛ از نام محصول ساخته می‌شود"
                  disabled={busy}
                />
              </label>
              <div className="catalog-field">
                <label htmlFor="product-pet-type">
                  نوع حیوان <b>*</b>
                </label>
                <select
                  id="product-pet-type"
                  required
                  value={draft.petTypeId}
                  disabled={busy}
                  onChange={(event) => {
                    setProduct("petTypeId", event.target.value);
                    setProduct("categoryId", "");
                  }}
                >
                  <option value="">انتخاب کنید</option>
                  {refs.petTypes
                    .filter((item) => item.isActive)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                </select>
                <QuickReference
                  kind="petType"
                  petTypeId={draft.petTypeId}
                  onCreated={(kind, value) => {
                    onRefCreated(kind, value);
                    setProduct("petTypeId", String(value.id));
                  }}
                />
              </div>
              <div className="catalog-field">
                <label htmlFor="product-category">
                  دسته‌بندی <b>*</b>
                </label>
                <select
                  id="product-category"
                  required
                  value={draft.categoryId}
                  disabled={busy}
                  onChange={(event) =>
                    setProduct("categoryId", event.target.value)
                  }
                >
                  <option value="">انتخاب کنید</option>
                  {activeCategories.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <QuickReference
                  kind="category"
                  petTypeId={draft.petTypeId}
                  onCreated={(kind, value) => {
                    onRefCreated(kind, value);
                    setProduct("categoryId", String(value.id));
                  }}
                />
              </div>
              <div className="catalog-field">
                <label htmlFor="product-brand">
                  برند <b>*</b>
                </label>
                <select
                  id="product-brand"
                  required
                  value={draft.brandId}
                  disabled={busy}
                  onChange={(event) =>
                    setProduct("brandId", event.target.value)
                  }
                >
                  <option value="">انتخاب کنید</option>
                  {refs.brands
                    .filter((item) => item.isActive)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                </select>
                <QuickReference
                  kind="brand"
                  petTypeId={draft.petTypeId}
                  onCreated={(kind, value) => {
                    onRefCreated(kind, value);
                    setProduct("brandId", String(value.id));
                  }}
                />
              </div>
              <label className="catalog-field">
                مرحلهٔ زندگی
                <select
                  value={draft.lifeStage}
                  disabled={busy}
                  onChange={(event) =>
                    setProduct(
                      "lifeStage",
                      event.target.value as ProductDraft["lifeStage"],
                    )
                  }
                >
                  <option value="ALL">همه</option>
                  <option value="PUPPY_KITTEN">توله / بچه‌گربه</option>
                  <option value="ADULT">بالغ</option>
                  <option value="SENIOR">مسن</option>
                </select>
              </label>
              <label className="catalog-field">
                اندازهٔ حیوان
                <select
                  value={draft.sizeClass}
                  disabled={busy}
                  onChange={(event) =>
                    setProduct(
                      "sizeClass",
                      event.target.value as ProductDraft["sizeClass"],
                    )
                  }
                >
                  <option value="ALL">همه</option>
                  <option value="SMALL">کوچک</option>
                  <option value="MEDIUM">متوسط</option>
                  <option value="LARGE">بزرگ</option>
                </select>
              </label>
              <label className="catalog-field">
                وضعیت عقیم‌سازی
                <select
                  value={draft.neuterSuitability}
                  disabled={busy}
                  onChange={(event) =>
                    setProduct(
                      "neuterSuitability",
                      event.target.value as ProductDraft["neuterSuitability"],
                    )
                  }
                >
                  <option value="ANY">بدون محدودیت</option>
                  <option value="NEUTERED_ONLY">مخصوص عقیم‌شده</option>
                </select>
              </label>
              <label className="catalog-field catalog-field--wide">
                ترکیبات
                <textarea
                  rows={3}
                  value={draft.ingredientsText}
                  disabled={busy}
                  onChange={(event) =>
                    setProduct("ingredientsText", event.target.value)
                  }
                  placeholder="ترکیبات را با دقت و مطابق بسته‌بندی وارد کنید."
                />
              </label>
              <label className="catalog-field catalog-field--wide">
                توضیحات
                <textarea
                  rows={4}
                  value={draft.description}
                  disabled={busy}
                  onChange={(event) =>
                    setProduct("description", event.target.value)
                  }
                  placeholder="توضیح کاربردی برای انتخاب آگاهانهٔ مشتری"
                />
              </label>
            </div>
          </section>
          <section
            className="catalog-panel"
            aria-labelledby="product-variant-title"
          >
            <div className="catalog-panel__head">
              <span>۰۲</span>
              <div>
                <h2 id="product-variant-title">قیمت و موجودی</h2>
                <p>نخستین واریانت برای عرضهٔ محصول الزامی است.</p>
              </div>
            </div>
            <div className="catalog-fields">
              <label className="catalog-field">
                شناسهٔ کالا (SKU) <b>*</b>
                <input
                  dir="ltr"
                  required
                  value={variant.sku}
                  disabled={busy}
                  onChange={(event) =>
                    setVariantField("sku", event.target.value)
                  }
                  placeholder="مثلاً FOOD-DOG-2KG"
                />
              </label>
              <label className="catalog-field">
                وزن به گرم <b>*</b>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={variant.weightGram}
                  disabled={busy}
                  onChange={(event) =>
                    setVariantField("weightGram", event.target.value)
                  }
                  placeholder="۲۰۰۰"
                />
              </label>
              <label className="catalog-field">
                قیمت به تومان <b>*</b>
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={variant.price}
                  disabled={busy}
                  onChange={(event) =>
                    setVariantField("price", event.target.value)
                  }
                  placeholder="۱۲۸۰۰۰۰"
                />
              </label>
              <label className="catalog-field">
                قیمت مقایسه‌ای
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={variant.compareAtPrice}
                  disabled={busy}
                  onChange={(event) =>
                    setVariantField("compareAtPrice", event.target.value)
                  }
                />
              </label>
              <label className="catalog-field">
                موجودی <b>*</b>
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={variant.stock}
                  disabled={busy}
                  onChange={(event) =>
                    setVariantField("stock", event.target.value)
                  }
                />
              </label>
              <label className="catalog-switch">
                <input
                  type="checkbox"
                  checked={variant.isActive}
                  disabled={busy}
                  onChange={(event) =>
                    setVariantField("isActive", event.target.checked)
                  }
                />
                واریانت فعال باشد
              </label>
            </div>
          </section>
          <section
            className="catalog-panel"
            aria-labelledby="product-media-title"
          >
            <div className="catalog-panel__head">
              <span>۰۳</span>
              <div>
                <h2 id="product-media-title">تصویر و برچسب‌ها</h2>
                <p>تصویر JPEG، PNG یا WebP تا ۵ مگابایت پذیرفته می‌شود.</p>
              </div>
            </div>
            <div className="catalog-fields">
              <label className="catalog-field catalog-field--wide catalog-upload">
                تصویر محصول
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={busy}
                  onChange={(event) =>
                    setImage(event.target.files?.[0] ?? null)
                  }
                />
                <small>
                  {image ? image.name : "انتخاب تصویر اختیاری است."}
                </small>
              </label>
              <fieldset className="catalog-tagset">
                <legend>مواد حساسیت‌زا</legend>
                {activeTags.filter((tag) => tag.type === "ALLERGEN").length ? (
                  activeTags
                    .filter((tag) => tag.type === "ALLERGEN")
                    .map((tag) => (
                      <label key={tag.id}>
                        <input
                          type="checkbox"
                          checked={contains.includes(tag.id)}
                          disabled={busy}
                          onChange={() => toggleTag(tag.id, "CONTAINS")}
                        />
                        {tag.name}
                      </label>
                    ))
                ) : (
                  <small>برچسبی ثبت نشده است.</small>
                )}
              </fieldset>
              <fieldset className="catalog-tagset">
                <legend>رژیم‌های مناسب</legend>
                {activeTags.filter((tag) => tag.type === "DIET").length ? (
                  activeTags
                    .filter((tag) => tag.type === "DIET")
                    .map((tag) => (
                      <label key={tag.id}>
                        <input
                          type="checkbox"
                          checked={suitableFor.includes(tag.id)}
                          disabled={busy}
                          onChange={() => toggleTag(tag.id, "SUITABLE_FOR")}
                        />
                        {tag.name}
                      </label>
                    ))
                ) : (
                  <small>برچسبی ثبت نشده است.</small>
                )}
              </fieldset>
            </div>
          </section>
        </div>
        <aside className="catalog-form__aside">
          <div className="catalog-summary">
            <span className="eyebrow">خلاصهٔ ثبت</span>
            <div className="catalog-summary__visual" aria-hidden="true">
              ✳
            </div>
            <h2>{draft.name || "نام محصول شما"}</h2>
            <p>
              {refs.brands.find((item) => String(item.id) === draft.brandId)
                ?.name || "برند"}{" "}
              /{" "}
              {refs.categories.find(
                (item) => String(item.id) === draft.categoryId,
              )?.name || "دسته‌بندی"}
            </p>
            <strong>
              {variant.price && parseNonNegativeInteger(variant.price) !== null
                ? toman(Number(variant.price))
                : "قیمت وارد نشده"}
            </strong>
            <div className="catalog-summary__divider" />
            <label className="catalog-switch">
              <input
                type="checkbox"
                checked={draft.isActive}
                disabled={busy}
                onChange={(event) =>
                  setProduct("isActive", event.target.checked)
                }
              />
              پس از ثبت، منتشر شود
            </label>
            <small>
              محصول در طول مراحل ثبت غیرفعال می‌ماند؛ انتشار آخرین مرحله است.
            </small>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              className="button button--primary catalog-submit"
              disabled={busy || partialId !== null}
            >
              {busy ? "در حال ثبت مرحله‌ای…" : "ثبت محصول"}
            </button>
          </div>
        </aside>
      </form>
    </>
  );
}

function Detail({
  id,
  refs,
  onBack,
  onUpdated,
}: {
  id: number;
  refs: References;
  onBack: () => void;
  onUpdated: () => void;
}) {
  const { request } = useAuth();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [variant, setVariant] = useState<VariantDraft>(emptyVariantDraft);
  const [image, setImage] = useState<File | null>(null);
  const [editDraft, setEditDraft] = useState<ProductDraft | null>(null);
  const [editingVariantId, setEditingVariantId] = useState<number | null>(null);
  const [variantEdit, setVariantEdit] =
    useState<VariantDraft>(emptyVariantDraft);
  const [confirmProduct, setConfirmProduct] = useState(false);
  const [confirmVariantId, setConfirmVariantId] = useState<number | null>(null);
  const [confirmImageId, setConfirmImageId] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    void request<ProductDetail>("/admin/products/" + id)
      .then((value) => {
        if (active) {
          setProduct(value);
          setError("");
        }
      })
      .catch((problem) => {
        if (active) setError(errorText(problem));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, request]);

  async function run(
    action: () => Promise<unknown>,
    success: string,
    after?: () => void,
  ) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      const fresh = await request<ProductDetail>("/admin/products/" + id);
      setProduct(fresh);
      setNotice(success);
      after?.();
      onUpdated();
    } catch (problem) {
      setError(errorText(problem));
    } finally {
      setBusy(false);
    }
  }

  function beginEdit(product: ProductDetail) {
    setEditDraft({
      name: product.name,
      slug: product.slug,
      brandId: String(product.brand.id),
      categoryId: String(product.category.id),
      petTypeId: String(product.petType.id),
      lifeStage: product.lifeStage as ProductDraft["lifeStage"],
      sizeClass: product.sizeClass as ProductDraft["sizeClass"],
      neuterSuitability:
        product.neuterSuitability as ProductDraft["neuterSuitability"],
      ingredientsText: product.ingredientsText || "",
      description: product.description || "",
      isActive: product.isActive,
    });
  }

  function beginVariantEdit(item: ProductDetail["variants"][number]) {
    setEditingVariantId(item.id);
    setVariantEdit({
      sku: item.sku,
      weightGram: String(item.weightGram),
      price: String(item.price),
      compareAtPrice:
        item.compareAtPrice == null ? "" : String(item.compareAtPrice),
      stock: String(item.stock),
      isActive: item.isActive,
    });
  }

  function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editDraft) return;
    if (
      editDraft.name.trim().length < 2 ||
      [editDraft.brandId, editDraft.categoryId, editDraft.petTypeId].some(
        (value) => !parseNonNegativeInteger(value),
      )
    ) {
      setError("نام، برند، دسته‌بندی و نوع حیوان را درست وارد کنید.");
      return;
    }
    const body = {
      name: editDraft.name.trim(),
      brandId: Number(editDraft.brandId),
      categoryId: Number(editDraft.categoryId),
      petTypeId: Number(editDraft.petTypeId),
      lifeStage: editDraft.lifeStage,
      sizeClass: editDraft.sizeClass,
      neuterSuitability: editDraft.neuterSuitability,
      ingredientsText: editDraft.ingredientsText.trim(),
      description: editDraft.description.trim(),
      isActive: editDraft.isActive,
    };
    void run(
      () => request("/admin/products/" + id, { method: "PATCH", body }),
      "اطلاعات محصول ذخیره شد.",
      () => setEditDraft(null),
    );
  }

  function saveVariant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editingVariantId === null || !variantEdit.sku.trim()) {
      setError("شناسهٔ کالا (SKU) الزامی است.");
      return;
    }
    const weightGram = parseNonNegativeInteger(variantEdit.weightGram);
    const price = parseNonNegativeInteger(variantEdit.price);
    const stock = parseNonNegativeInteger(variantEdit.stock);
    const compareAtPrice = variantEdit.compareAtPrice.trim()
      ? parseNonNegativeInteger(variantEdit.compareAtPrice)
      : null;
    if (
      weightGram === null ||
      weightGram < 1 ||
      price === null ||
      stock === null ||
      (variantEdit.compareAtPrice.trim() && compareAtPrice === null)
    ) {
      setError(
        "وزن باید مثبت و قیمت، موجودی و قیمت مقایسه‌ای باید عدد صحیح نامنفی باشند.",
      );
      return;
    }
    void run(
      () =>
        request("/admin/products/variants/" + editingVariantId, {
          method: "PATCH",
          body: {
            sku: variantEdit.sku.trim(),
            weightGram,
            price,
            stock,
            compareAtPrice,
            isActive: variantEdit.isActive,
          },
        }),
      "واریانت ذخیره شد.",
      () => setEditingVariantId(null),
    );
  }

  async function removeProduct() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await request<{ deleted: boolean }>(
        "/admin/products/" + id,
        { method: "DELETE" },
      );
      onUpdated();
      if (result.deleted) onBack();
      else {
        const fresh = await request<ProductDetail>("/admin/products/" + id);
        setProduct(fresh);
        setNotice("محصول به‌دلیل وابستگی به سفارش، غیرفعال شد.");
        setConfirmProduct(false);
      }
    } catch (problem) {
      setError(errorText(problem));
    } finally {
      setBusy(false);
    }
  }

  if (loading)
    return (
      <p className="loading" role="status">
        در حال دریافت جزئیات محصول…
      </p>
    );
  if (error && !product)
    return (
      <div className="catalog-notice catalog-notice--warning" role="alert">
        {error}
        <button type="button" onClick={onBack}>
          بازگشت
        </button>
      </div>
    );
  if (!product) return null;
  return (
    <>
      <Intro
        eyebrow={"کاتالوگ / #" + count.format(product.id)}
        title={product.name}
        text={"نامک: " + product.slug}
        actions={
          <>
            <StatusBadge active={product.isActive} />
            <button
              type="button"
              className="button button--ghost"
              onClick={onBack}
            >
              فهرست محصولات
            </button>
          </>
        }
      />
      {notice && (
        <div className="catalog-notice catalog-notice--success" role="status">
          {notice}
        </div>
      )}
      {error && (
        <div className="catalog-notice catalog-notice--warning" role="alert">
          {error}
        </div>
      )}
      <div className="catalog-detail-grid">
        <section className="catalog-panel">
          <div className="catalog-panel__head">
            <span>۰۱</span>
            <div>
              <h2>شناسنامه و انتشار</h2>
              <p>جزئیات ثبت‌شده در API</p>
            </div>
          </div>
          <dl className="catalog-facts">
            <div>
              <dt>برند</dt>
              <dd>{product.brand?.name || "—"}</dd>
            </div>
            <div>
              <dt>دسته‌بندی</dt>
              <dd>{product.category?.name || "—"}</dd>
            </div>
            <div>
              <dt>نوع حیوان</dt>
              <dd>{product.petType?.name || "—"}</dd>
            </div>
            <div>
              <dt>مرحلهٔ زندگی</dt>
              <dd>{product.lifeStage}</dd>
            </div>
            <div>
              <dt>اندازه</dt>
              <dd>{product.sizeClass}</dd>
            </div>
            <div>
              <dt>وضعیت عقیم‌سازی</dt>
              <dd>{product.neuterSuitability}</dd>
            </div>
          </dl>
          {product.ingredientsText && (
            <p>
              <b>ترکیبات:</b> {product.ingredientsText}
            </p>
          )}
          {product.description && (
            <p>
              <b>توضیحات:</b> {product.description}
            </p>
          )}
          {!editDraft ? (
            <button
              type="button"
              className="button button--outline"
              onClick={() => beginEdit(product)}
            >
              ویرایش اطلاعات محصول
            </button>
          ) : (
            <form className="catalog-inline-form" onSubmit={saveProduct}>
              <h3>ویرایش شناسنامه</h3>
              <label>
                نام
                <input
                  required
                  minLength={2}
                  value={editDraft.name}
                  disabled={busy}
                  onChange={(event) =>
                    setEditDraft({ ...editDraft, name: event.target.value })
                  }
                />
              </label>
              <label>
                برند
                <select
                  value={editDraft.brandId}
                  disabled={busy}
                  onChange={(event) =>
                    setEditDraft({ ...editDraft, brandId: event.target.value })
                  }
                >
                  {refs.brands.map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                نوع حیوان
                <select
                  value={editDraft.petTypeId}
                  disabled={busy}
                  onChange={(event) =>
                    setEditDraft({
                      ...editDraft,
                      petTypeId: event.target.value,
                      categoryId: "",
                    })
                  }
                >
                  {refs.petTypes.map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                دسته‌بندی
                <select
                  value={editDraft.categoryId}
                  disabled={busy}
                  required
                  onChange={(event) =>
                    setEditDraft({
                      ...editDraft,
                      categoryId: event.target.value,
                    })
                  }
                >
                  <option value="">انتخاب کنید</option>
                  {refs.categories
                    .filter(
                      (item) =>
                        !item.petTypeId ||
                        item.petTypeId === Number(editDraft.petTypeId),
                    )
                    .map((item) => (
                      <option value={item.id} key={item.id}>
                        {item.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                مرحلهٔ زندگی
                <select
                  value={editDraft.lifeStage}
                  disabled={busy}
                  onChange={(event) =>
                    setEditDraft({
                      ...editDraft,
                      lifeStage: event.target
                        .value as ProductDraft["lifeStage"],
                    })
                  }
                >
                  <option value="ALL">همه</option>
                  <option value="PUPPY_KITTEN">توله / بچه‌گربه</option>
                  <option value="ADULT">بالغ</option>
                  <option value="SENIOR">مسن</option>
                </select>
              </label>
              <label>
                اندازه
                <select
                  value={editDraft.sizeClass}
                  disabled={busy}
                  onChange={(event) =>
                    setEditDraft({
                      ...editDraft,
                      sizeClass: event.target
                        .value as ProductDraft["sizeClass"],
                    })
                  }
                >
                  <option value="ALL">همه</option>
                  <option value="SMALL">کوچک</option>
                  <option value="MEDIUM">متوسط</option>
                  <option value="LARGE">بزرگ</option>
                </select>
              </label>
              <label>
                وضعیت عقیم‌سازی
                <select
                  value={editDraft.neuterSuitability}
                  disabled={busy}
                  onChange={(event) =>
                    setEditDraft({
                      ...editDraft,
                      neuterSuitability: event.target
                        .value as ProductDraft["neuterSuitability"],
                    })
                  }
                >
                  <option value="ANY">بدون محدودیت</option>
                  <option value="NEUTERED_ONLY">مخصوص عقیم‌شده</option>
                </select>
              </label>
              <label>
                ترکیبات
                <textarea
                  rows={3}
                  value={editDraft.ingredientsText}
                  disabled={busy}
                  onChange={(event) =>
                    setEditDraft({
                      ...editDraft,
                      ingredientsText: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                توضیحات
                <textarea
                  rows={3}
                  value={editDraft.description}
                  disabled={busy}
                  onChange={(event) =>
                    setEditDraft({
                      ...editDraft,
                      description: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={editDraft.isActive}
                  disabled={busy}
                  onChange={(event) =>
                    setEditDraft({
                      ...editDraft,
                      isActive: event.target.checked,
                    })
                  }
                />{" "}
                انتشار فعال
              </label>
              <div className="catalog-inline-actions">
                <button
                  type="submit"
                  className="button button--primary"
                  disabled={busy}
                >
                  ذخیرهٔ محصول
                </button>
                <button
                  type="button"
                  className="button button--text"
                  onClick={() => setEditDraft(null)}
                >
                  انصراف
                </button>
              </div>
            </form>
          )}
          <button
            type="button"
            className="button button--outline"
            disabled={
              busy ||
              (!product.isActive &&
                !product.variants.some(
                  (item) =>
                    item.isActive && item.weightGram > 0 && item.price >= 0,
                ))
            }
            onClick={() =>
              void run(
                () =>
                  request("/admin/products/" + id, {
                    method: "PATCH",
                    body: { isActive: !product.isActive },
                  }),
                product.isActive ? "محصول غیرفعال شد." : "محصول منتشر شد.",
              )
            }
          >
            {product.isActive ? "غیرفعال کردن محصول" : "انتشار محصول"}
          </button>
          {!product.isActive &&
            !product.variants.some(
              (item) => item.isActive && item.weightGram > 0 && item.price >= 0,
            ) && (
              <p className="catalog-help">
                برای انتشار، نخست یک واریانت فعال با وزن و قیمت معتبر ثبت کنید.
              </p>
            )}
          <div className="catalog-delete-confirm">
            {!confirmProduct ? (
              <button
                type="button"
                className="button button--text"
                onClick={() => setConfirmProduct(true)}
              >
                حذف محصول
              </button>
            ) : (
              <>
                <p>
                  اگر محصول در سفارش استفاده شده باشد، API آن را غیرفعال می‌کند.
                </p>
                <button
                  type="button"
                  className="button button--outline"
                  disabled={busy}
                  onClick={() => void removeProduct()}
                >
                  تأیید حذف
                </button>
                <button
                  type="button"
                  className="button button--text"
                  onClick={() => setConfirmProduct(false)}
                >
                  انصراف
                </button>
              </>
            )}
          </div>
        </section>
        <section className="catalog-panel">
          <div className="catalog-panel__head">
            <span>۰۲</span>
            <div>
              <h2>واریانت‌ها</h2>
              <p>قیمت‌ها به تومان و وزن‌ها به گرم هستند.</p>
            </div>
          </div>
          <div className="catalog-variants">
            {product.variants.length ? (
              product.variants.map((item) => (
                <div key={item.id}>
                  <strong dir="ltr">{item.sku}</strong>
                  <span>{count.format(item.weightGram)} گرم</span>
                  <span>{toman(item.price)}</span>
                  <span>{count.format(item.stock)} موجود</span>
                  <StatusBadge active={item.isActive} />
                  <button
                    type="button"
                    className="catalog-link"
                    disabled={busy}
                    onClick={() => beginVariantEdit(item)}
                  >
                    ویرایش
                  </button>
                  {confirmVariantId !== item.id ? (
                    <button
                      type="button"
                      className="catalog-link"
                      disabled={busy}
                      onClick={() => setConfirmVariantId(item.id)}
                    >
                      حذف
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="catalog-link"
                        disabled={busy}
                        onClick={() =>
                          void run(
                            () =>
                              request("/admin/products/variants/" + item.id, {
                                method: "DELETE",
                              }),
                            "واریانت حذف یا غیرفعال شد.",
                            () => setConfirmVariantId(null),
                          )
                        }
                      >
                        تأیید حذف
                      </button>
                      <button
                        type="button"
                        className="catalog-link"
                        onClick={() => setConfirmVariantId(null)}
                      >
                        انصراف
                      </button>
                    </>
                  )}
                </div>
              ))
            ) : (
              <p className="empty">هنوز واریانتی ثبت نشده است.</p>
            )}
          </div>
          {editingVariantId !== null && (
            <form className="catalog-inline-form" onSubmit={saveVariant}>
              <h3>ویرایش واریانت</h3>
              <label>
                SKU
                <input
                  dir="ltr"
                  required
                  value={variantEdit.sku}
                  disabled={busy}
                  onChange={(event) =>
                    setVariantEdit({ ...variantEdit, sku: event.target.value })
                  }
                />
              </label>
              <label>
                وزن (گرم)
                <input
                  type="number"
                  min="1"
                  required
                  value={variantEdit.weightGram}
                  disabled={busy}
                  onChange={(event) =>
                    setVariantEdit({
                      ...variantEdit,
                      weightGram: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                قیمت (تومان)
                <input
                  type="number"
                  min="0"
                  required
                  value={variantEdit.price}
                  disabled={busy}
                  onChange={(event) =>
                    setVariantEdit({
                      ...variantEdit,
                      price: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                قیمت مقایسه‌ای
                <input
                  type="number"
                  min="0"
                  value={variantEdit.compareAtPrice}
                  disabled={busy}
                  onChange={(event) =>
                    setVariantEdit({
                      ...variantEdit,
                      compareAtPrice: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                موجودی
                <input
                  type="number"
                  min="0"
                  required
                  value={variantEdit.stock}
                  disabled={busy}
                  onChange={(event) =>
                    setVariantEdit({
                      ...variantEdit,
                      stock: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={variantEdit.isActive}
                  disabled={busy}
                  onChange={(event) =>
                    setVariantEdit({
                      ...variantEdit,
                      isActive: event.target.checked,
                    })
                  }
                />{" "}
                فعال
              </label>
              <div className="catalog-inline-actions">
                <button
                  type="submit"
                  className="button button--primary"
                  disabled={busy}
                >
                  ذخیرهٔ واریانت
                </button>
                <button
                  type="button"
                  className="button button--text"
                  onClick={() => setEditingVariantId(null)}
                >
                  انصراف
                </button>
              </div>
            </form>
          )}
          <form
            className="catalog-inline-form"
            onSubmit={(event) => {
              event.preventDefault();
              const problem = validateProductDraft(
                {
                  ...emptyProductDraft,
                  name: product.name,
                  brandId: String(product.brand.id),
                  categoryId: String(product.category.id),
                  petTypeId: String(product.petType.id),
                },
                variant,
              );
              if (problem) {
                setError(problem);
                return;
              }
              void run(
                () =>
                  request("/admin/products/" + id + "/variants", {
                    method: "POST",
                    body: variantPayload(variant),
                  }),
                "واریانت افزوده شد.",
              );
            }}
          >
            <h3>افزودن واریانت</h3>
            <label>
              SKU
              <input
                dir="ltr"
                required
                value={variant.sku}
                disabled={busy}
                onChange={(event) =>
                  setVariant({ ...variant, sku: event.target.value })
                }
              />
            </label>
            <label>
              وزن (گرم)
              <input
                type="number"
                min="1"
                required
                value={variant.weightGram}
                disabled={busy}
                onChange={(event) =>
                  setVariant({ ...variant, weightGram: event.target.value })
                }
              />
            </label>
            <label>
              قیمت (تومان)
              <input
                type="number"
                min="0"
                required
                value={variant.price}
                disabled={busy}
                onChange={(event) =>
                  setVariant({ ...variant, price: event.target.value })
                }
              />
            </label>
            <label>
              موجودی
              <input
                type="number"
                min="0"
                required
                value={variant.stock}
                disabled={busy}
                onChange={(event) =>
                  setVariant({ ...variant, stock: event.target.value })
                }
              />
            </label>
            <button
              type="submit"
              className="button button--outline"
              disabled={busy}
            >
              افزودن واریانت
            </button>
          </form>
        </section>
        <section className="catalog-panel">
          <div className="catalog-panel__head">
            <span>۰۳</span>
            <div>
              <h2>تصاویر</h2>
              <p>تصاویر به ترتیب ثبت نمایش داده می‌شوند.</p>
            </div>
          </div>
          <div className="catalog-images">
            {product.images.map((item) => {
              const src = safeImageUrl(item.url);
              return (
                <div key={item.id} className="catalog-image-item">
                  {src ? (
                    <a
                      href={src}
                      target="_blank"
                      rel="noopener noreferrer"
                      referrerPolicy="no-referrer"
                    >
                      <img
                        src={src}
                        alt={"تصویر " + product.name}
                        referrerPolicy="no-referrer"
                        loading="lazy"
                      />
                    </a>
                  ) : (
                    <span>نشانی تصویر نامعتبر</span>
                  )}
                  {confirmImageId !== item.id ? (
                    <button
                      type="button"
                      className="catalog-link"
                      disabled={busy}
                      onClick={() => setConfirmImageId(item.id)}
                    >
                      حذف تصویر
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="catalog-link"
                        disabled={busy}
                        onClick={() =>
                          void run(
                            () =>
                              request("/admin/products/images/" + item.id, {
                                method: "DELETE",
                              }),
                            "تصویر حذف شد.",
                            () => setConfirmImageId(null),
                          )
                        }
                      >
                        تأیید حذف
                      </button>
                      <button
                        type="button"
                        className="catalog-link"
                        onClick={() => setConfirmImageId(null)}
                      >
                        انصراف
                      </button>
                    </>
                  )}
                </div>
              );
            })}
            {!product.images.length && (
              <p className="empty">تصویری ثبت نشده است.</p>
            )}
          </div>
          <form
            className="catalog-inline-form"
            onSubmit={(event) => {
              event.preventDefault();
              const problem = validateImage(image);
              if (problem || !image) {
                setError(problem || "یک تصویر انتخاب کنید.");
                return;
              }
              void run(async () => {
                const formData = new FormData();
                formData.append("file", image);
                const uploaded = await request<{ url: string }>(
                  "/upload/image",
                  { method: "POST", formData },
                );
                if (!safeImageUrl(uploaded.url))
                  throw new Error("نشانی تصویر دریافتی معتبر نیست.");
                await request("/admin/products/" + id + "/images", {
                  method: "POST",
                  body: { url: uploaded.url, sortOrder: product.images.length },
                });
              }, "تصویر افزوده شد.");
            }}
          >
            <label>
              افزودن تصویر
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={busy}
                onChange={(event) => setImage(event.target.files?.[0] ?? null)}
              />
            </label>
            <button
              type="submit"
              className="button button--outline"
              disabled={busy}
            >
              آپلود و ثبت تصویر
            </button>
          </form>
        </section>
        <section className="catalog-panel">
          <div className="catalog-panel__head">
            <span>۰۴</span>
            <div>
              <h2>برچسب‌ها</h2>
              <p>مواد حساسیت‌زا و رژیم‌های مناسب محصول</p>
            </div>
          </div>
          <div className="catalog-tags">
            {product.tags.map((item) => (
              <span key={item.tagId}>{item.tag.name}</span>
            ))}
            {!product.tags.length && (
              <p className="empty">برچسبی ثبت نشده است.</p>
            )}
          </div>
          <TagEditor
            product={product}
            tags={refs.tags}
            busy={busy}
            onSave={(body) =>
              void run(
                () =>
                  request("/admin/products/" + id + "/tags", {
                    method: "PUT",
                    body,
                  }),
                "برچسب‌ها ذخیره شدند.",
              )
            }
          />
        </section>
      </div>
    </>
  );
}

function TagEditor({
  product,
  tags,
  busy,
  onSave,
}: {
  product: ProductDetail;
  tags: CatalogTag[];
  busy: boolean;
  onSave: (body: { contains: number[]; suitableFor: number[] }) => void;
}) {
  const [contains, setContains] = useState<number[]>(
    product.tags
      .filter((item) => item.kind === "CONTAINS")
      .map((item) => item.tagId),
  );
  const [suitableFor, setSuitableFor] = useState<number[]>(
    product.tags
      .filter((item) => item.kind === "SUITABLE_FOR")
      .map((item) => item.tagId),
  );
  return (
    <div className="catalog-tag-editor">
      {tags
        .filter((item) => item.isActive)
        .map((tag) => {
          const selected = tag.type === "ALLERGEN" ? contains : suitableFor;
          const setter = tag.type === "ALLERGEN" ? setContains : setSuitableFor;
          return (
            <label key={tag.id}>
              <input
                type="checkbox"
                checked={selected.includes(tag.id)}
                disabled={busy}
                onChange={() =>
                  setter((value) =>
                    value.includes(tag.id)
                      ? value.filter((id) => id !== tag.id)
                      : [...value, tag.id],
                  )
                }
              />
              {tag.name}{" "}
              <small>{tag.type === "ALLERGEN" ? "حساسیت‌زا" : "رژیم"}</small>
            </label>
          );
        })}
      <button
        type="button"
        className="button button--outline"
        disabled={busy}
        onClick={() => onSave({ contains, suitableFor })}
      >
        ذخیرهٔ برچسب‌ها
      </button>
    </div>
  );
}

export function Catalog() {
  const { request } = useAuth();
  const [section, setSection] = useState<Section>("list");
  const [refs, setRefs] = useState<References>({
    brands: [],
    categories: [],
    petTypes: [],
    breeds: [],
    tags: [],
  });
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [meta, setMeta] = useState({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 1,
  });
  const [page, setPage] = useState(1);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refsError, setRefsError] = useState("");
  const [refsRevision, setRefsRevision] = useState(0);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    void Promise.all([
      request<NamedRef[]>("/admin/brands"),
      request<NamedRef[]>("/admin/categories"),
      request<NamedRef[]>("/admin/pet-types"),
      request<NamedRef[]>("/admin/breeds"),
      request<CatalogTag[]>("/admin/tags"),
    ])
      .then(([brands, categories, petTypes, breeds, tags]) => {
        if (active) {
          setRefs({ brands, categories, petTypes, breeds, tags });
          setRefsError("");
        }
      })
      .catch((problem) => {
        if (active) setRefsError(errorText(problem));
      });
    return () => {
      active = false;
    };
  }, [request, refsRevision]);

  useEffect(() => {
    let active = true;
    const query = new URLSearchParams({ page: String(page), limit: "12" });
    if (search) query.set("search", search);
    if (activeFilter !== "all") query.set("isActive", activeFilter);
    void request<PageResult<ProductRow>>(
      "/admin/products?" + query.toString(),
      { withMeta: true },
    )
      .then((result) => {
        if (active) {
          setRows(result.data);
          setMeta(result.meta);
          setError("");
        }
      })
      .catch((problem) => {
        if (active) setError(errorText(problem));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [request, page, search, activeFilter, refresh]);

  function showDetail(id: number) {
    setSelectedId(id);
    setSection("detail");
  }
  function refCreated(kind: RefKind, value: NamedRef) {
    const key: keyof References =
      kind === "brand"
        ? "brands"
        : kind === "category"
          ? "categories"
          : "petTypes";
    setRefs((current) => ({ ...current, [key]: [...current[key], value] }));
  }

  if (section === "create")
    return (
      <CreateProduct
        refs={refs}
        onBack={() => setSection("list")}
        onCreated={(id) => {
          setRefresh((value) => value + 1);
          showDetail(id);
        }}
        onRefCreated={refCreated}
      />
    );
  if (section === "detail" && selectedId !== null)
    return (
      <Detail
        key={selectedId}
        id={selectedId}
        refs={refs}
        onBack={() => setSection("list")}
        onUpdated={() => setRefresh((value) => value + 1)}
      />
    );
  if (section === "references")
    return (
      <CatalogReferencesManager
        refs={refs}
        onBack={() => setSection("list")}
        onChanged={() => setRefsRevision((value) => value + 1)}
      />
    );
  return (
    <>
      <Intro
        eyebrow="کاتالوگ / مدیریت"
        title="محصولات"
        text="محصولات منتشرشده و پیش‌نویس‌ها را یک‌جا ببینید و محصول تازه ثبت کنید."
        actions={
          <>
            <button
              type="button"
              className="button button--ghost"
              onClick={() => setSection("references")}
            >
              داده‌های مرجع
            </button>
            <button
              type="button"
              className="button button--primary"
              onClick={() => setSection("create")}
            >
              + ثبت محصول
            </button>
          </>
        }
      />
      {refsError && (
        <div className="catalog-notice catalog-notice--warning" role="alert">
          دریافت داده‌های مرجع انجام نشد: {refsError}
          <button
            type="button"
            onClick={() => setRefsRevision((value) => value + 1)}
          >
            تلاش دوباره
          </button>
        </div>
      )}
      <section
        className="catalog-panel catalog-list"
        aria-label="فهرست محصولات"
      >
        <div className="catalog-toolbar">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setPage(1);
              setSearch(searchDraft.trim());
            }}
          >
            <label className="sr-only" htmlFor="product-search">
              جستجوی محصول
            </label>
            <input
              id="product-search"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="جستجو با نام یا نامک…"
            />
            <button type="submit" className="button button--outline">
              جستجو
            </button>
          </form>
          <div
            className="catalog-filters"
            role="group"
            aria-label="وضعیت محصول"
          >
            {(
              [
                ["all", "همه"],
                ["true", "فعال"],
                ["false", "پیش‌نویس"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={activeFilter === value}
                onClick={() => {
                  setActiveFilter(value);
                  setPage(1);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {error && (
          <div className="catalog-notice catalog-notice--warning" role="alert">
            {error}
            <button
              type="button"
              onClick={() => {
                setError("");
                setRefresh((value) => value + 1);
              }}
            >
              تلاش دوباره
            </button>
          </div>
        )}
        {loading && (
          <p className="loading" role="status">
            در حال دریافت محصولات…
          </p>
        )}
        {!loading && !error && (
          <div className="catalog-table-wrap">
            <table className="catalog-table">
              <thead>
                <tr>
                  <th scope="col">محصول</th>
                  <th scope="col">دسته‌بندی</th>
                  <th scope="col">قیمت پایه</th>
                  <th scope="col">موجودی</th>
                  <th scope="col">وضعیت</th>
                  <th scope="col">جزئیات</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.name}</strong>
                      <small dir="ltr">{row.slug}</small>
                    </td>
                    <td>
                      {row.category?.name || "—"}
                      <small>{row.petType?.name || "—"}</small>
                    </td>
                    <td>{toman(row.minPrice)}</td>
                    <td>{count.format(row.totalStock || 0)}</td>
                    <td>
                      <StatusBadge active={row.isActive} />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="catalog-link"
                        onClick={() => showDetail(row.id)}
                      >
                        مشاهده ←
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && (
              <p className="empty">محصولی برای این جستجو پیدا نشد.</p>
            )}
          </div>
        )}
        {meta.totalPages > 1 && (
          <div className="catalog-pagination">
            <span>
              {count.format(meta.total)} محصول / صفحهٔ {count.format(meta.page)}{" "}
              از {count.format(meta.totalPages)}
            </span>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              قبلی
            </button>
            <button
              type="button"
              disabled={page >= meta.totalPages}
              onClick={() => setPage(page + 1)}
            >
              بعدی
            </button>
          </div>
        )}
      </section>
    </>
  );
}
