import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError, type PageMeta, type PageResult } from "./api/client";
import { useAuth } from "./auth";
import { safeImageUrl, validateImage } from "./catalog-model";
import "./care.css";

type Kind = "medicines" | "pharmacies" | "clinics";
type Field = {
  key: string;
  label: string;
  required?: boolean;
  type?: "text" | "textarea" | "number" | "checkbox";
};
type Row = {
  id: number;
  name: string;
  isActive: boolean;
  isVerified?: boolean;
  onDuty?: boolean;
  city?: string;
  province?: string;
  requiresPrescription?: boolean;
  _count?: { pharmacies?: number; medicines?: number };
};
type MedicineLink = {
  medicineId: number;
  note: string | null;
  lastConfirmedAt: string | null;
  medicine: { id: number; name: string; isActive: boolean };
};
type Detail = Row & {
  [key: string]: unknown;
  petTypes?: { id: number; name: string }[];
  medicines?: MedicineLink[];
  image?: string | null;
};
type PetType = { id: number; name: string; isActive: boolean };
type FormState = Record<string, string | boolean>;

const labels: Record<
  Kind,
  { title: string; singular: string; description: string }
> = {
  medicines: {
    title: "داروها",
    singular: "دارو",
    description: "اطلاعات دارویی برای آگاهی مخاطب، بدون فروش آنلاین دارو.",
  },
  pharmacies: {
    title: "داروخانه‌ها",
    singular: "داروخانه",
    description: "نشانی، وضعیت تأیید و فهرست داروهای ثبت‌شده در هر مرکز.",
  },
  clinics: {
    title: "کلینیک‌ها",
    singular: "کلینیک",
    description: "اطلاعات تماس و وضعیت نمایش مراکز درمانی.",
  },
};

const commonPlace: Field[] = [
  { key: "name", label: "نام مرکز", required: true },
  { key: "province", label: "استان", required: true },
  { key: "city", label: "شهر", required: true },
  { key: "address", label: "نشانی", required: true, type: "textarea" },
  { key: "phone", label: "شماره تماس" },
  { key: "workingHours", label: "ساعت کاری" },
  { key: "lat", label: "عرض جغرافیایی", type: "number" },
  { key: "lng", label: "طول جغرافیایی", type: "number" },
  { key: "is24h", label: "شبانه‌روزی", type: "checkbox" },
  { key: "isVerified", label: "تأییدشده", type: "checkbox" },
  { key: "isActive", label: "نمایش عمومی فعال", type: "checkbox" },
];
const fields: Record<Kind, Field[]> = {
  medicines: [
    { key: "name", label: "نام دارو", required: true },
    { key: "activeIngredient", label: "مادهٔ مؤثره" },
    { key: "type", label: "نوع دارو" },
    { key: "brand", label: "برند" },
    { key: "usage", label: "نحوهٔ مصرف", type: "textarea" },
    { key: "notes", label: "یادداشت", type: "textarea" },
    { key: "requiresPrescription", label: "نیازمند نسخه", type: "checkbox" },
    { key: "isActive", label: "نمایش عمومی فعال", type: "checkbox" },
  ],
  pharmacies: commonPlace,
  clinics: commonPlace,
};

function message(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof TypeError)
    return "ارتباط با API برقرار نشد. اتصال بک‌اند را بررسی کنید.";
  return "درخواست انجام نشد. دوباره تلاش کنید.";
}

function initialForm(kind: Kind, detail?: Detail): FormState {
  const result: FormState = {};
  for (const field of fields[kind]) {
    const value = detail?.[field.key];
    result[field.key] =
      field.type === "checkbox"
        ? typeof value === "boolean"
          ? value
          : field.key === "isActive"
        : value == null
          ? ""
          : String(value);
  }
  return result;
}

export function carePayload(kind: Kind, form: FormState, petTypeIds: number[]) {
  const result: Record<string, unknown> = {};
  for (const field of fields[kind]) {
    const value = form[field.key];
    if (field.type === "checkbox") {
      result[field.key] = value === true;
      continue;
    }
    const text = typeof value === "string" ? value.trim() : "";
    if (field.required && text.length < 2)
      throw new Error(`${field.label} باید دست‌کم دو نویسه داشته باشد.`);
    if (field.type === "number") {
      if (!text) {
        result[field.key] = null;
        continue;
      }
      const coordinate = Number(text);
      const limit = field.key === "lat" ? 90 : 180;
      if (!Number.isFinite(coordinate) || Math.abs(coordinate) > limit)
        throw new Error(
          `${field.label} باید عددی بین ${-limit} و ${limit} باشد.`,
        );
      result[field.key] = coordinate;
    } else {
      result[field.key] = text;
    }
  }
  if (kind === "medicines") result.petTypeIds = petTypeIds;
  return result;
}

export function Care() {
  const { request } = useAuth();
  const editorRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const detailGeneration = useRef(0);
  const kindRef = useRef<Kind>("medicines");
  const savingRef = useRef(false);
  const [kind, setKind] = useState<Kind>("medicines");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Row[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<Detail | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(() => initialForm("medicines"));
  const [petTypes, setPetTypes] = useState<PetType[]>([]);
  const [petTypeIds, setPetTypeIds] = useState<number[]>([]);
  const [image, setImage] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [medicineSearch, setMedicineSearch] = useState("");
  const [medicineOptions, setMedicineOptions] = useState<Row[]>([]);
  const [linkId, setLinkId] = useState("");
  const [linkNote, setLinkNote] = useState("");

  useEffect(() => {
    savingRef.current = saving;
  }, [saving]);

  useEffect(() => () => {
    detailGeneration.current += 1;
  }, []);

  const closeEditor = useCallback(() => {
    if (savingRef.current) return;
    detailGeneration.current += 1;
    setFormOpen(false);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!formOpen) return;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    closeRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeEditor();
        return;
      }
      if (event.key !== "Tab" || !editorRef.current) return;
      const controls = Array.from(
        editorRef.current.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]",
        ),
      );
      const first = controls[0];
      const last = controls.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus();
    };
  }, [formOpen, closeEditor]);

  useEffect(() => {
    let current = true;
    const parameters = new URLSearchParams({ page: String(page), limit: "20" });
    if (search) parameters.set("q", search);
    if (activeFilter) parameters.set("isActive", activeFilter);
    queueMicrotask(() => {
      if (!current) return;
      setLoading(true);
      setError("");
      void request<PageResult<Row>>(`/admin/${kind}?${parameters}`, {
        withMeta: true,
      })
        .then((result) => {
          if (!current) return;
          setRows(result.data);
          setMeta(result.meta);
        })
        .catch((problem) => {
          if (current) setError(message(problem));
        })
        .finally(() => {
          if (current) setLoading(false);
        });
    });
    return () => {
      current = false;
    };
  }, [request, kind, page, search, activeFilter, revision]);

  useEffect(() => {
    if (kind !== "medicines") return;
    let current = true;
    void request<PetType[]>("/admin/pet-types")
      .then((result) => {
        if (current) setPetTypes(result);
      })
      .catch((problem) => {
        if (current) setError(message(problem));
      });
    return () => {
      current = false;
    };
  }, [request, kind]);

  function switchKind(next: Kind) {
    if (saving) return;
    detailGeneration.current += 1;
    kindRef.current = next;
    setKind(next);
    setPage(1);
    setQuery("");
    setSearch("");
    setActiveFilter("");
    setSelected(null);
    setFormOpen(false);
    setError("");
    setNotice("");
  }

  function startNew() {
    if (saving) return;
    detailGeneration.current += 1;
    setSelected(null);
    setForm(initialForm(kind));
    setPetTypeIds([]);
    setImage(null);
    setConfirmDelete(false);
    setError("");
    setLoading(false);
    setFormOpen(true);
  }

  async function openDetail(id: number) {
    const requestedKind = kindRef.current;
    const generation = ++detailGeneration.current;
    const isCurrent = () =>
      detailGeneration.current === generation && kindRef.current === requestedKind;
    setError("");
    setLoading(true);
    try {
      const detail = await request<Detail>(`/admin/${requestedKind}/${id}`);
      if (!isCurrent()) return;
      setSelected(detail);
      setForm(initialForm(requestedKind, detail));
      setPetTypeIds(detail.petTypes?.map((petType) => petType.id) ?? []);
      setImage(null);
      setConfirmDelete(false);
      setFormOpen(true);
    } catch (problem) {
      if (isCurrent()) setError(message(problem));
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setError("");
    setNotice("");
    let payload: Record<string, unknown>;
    try {
      payload = carePayload(kind, form, petTypeIds);
      if (kind === "clinics" && !selected) {
        delete payload.isVerified;
        delete payload.isActive;
      }
      const imageProblem = validateImage(image);
      if (imageProblem) throw new Error(imageProblem);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : message(problem));
      return;
    }
    setSaving(true);
    try {
      if (kind === "medicines" && image) {
        const formData = new FormData();
        formData.append("file", image);
        const uploaded = await request<{ url: string }>("/upload/image", {
          method: "POST",
          formData,
        });
        if (!safeImageUrl(uploaded.url))
          throw new Error("نشانی تصویر دریافتی معتبر نیست.");
        payload.image = uploaded.url;
      }
      const result = await request<Detail>(
        `/admin/${kind}${selected ? `/${selected.id}` : ""}`,
        {
          method: selected ? "PATCH" : "POST",
          body: payload,
        },
      );
      setNotice(`${labels[kind].singular} ذخیره شد.`);
      setRevision((value) => value + 1);
      setImage(null);
      await openDetail(result.id);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : message(problem));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!selected || saving) return;
    setSaving(true);
    setError("");
    try {
      await request(`/admin/${kind}/${selected.id}`, { method: "DELETE" });
      detailGeneration.current += 1;
      setFormOpen(false);
      setSelected(null);
      setConfirmDelete(false);
      setNotice(`${labels[kind].singular} حذف شد.`);
      setRevision((value) => value + 1);
    } catch (problem) {
      setError(message(problem));
    } finally {
      setSaving(false);
    }
  }

  async function findMedicines(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      const parameters = new URLSearchParams({ page: "1", limit: "20" });
      if (medicineSearch.trim()) parameters.set("q", medicineSearch.trim());
      const result = await request<PageResult<Row>>(
        `/admin/medicines?${parameters}`,
        { withMeta: true },
      );
      setMedicineOptions(result.data);
    } catch (problem) {
      setError(message(problem));
    }
  }

  async function changeLink(unlink: number | null) {
    if (!selected || saving) return;
    const medicineId = unlink ?? Number(linkId);
    if (!Number.isInteger(medicineId) || medicineId < 1) {
      setError("ابتدا یک دارو انتخاب کنید.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await request(
        `/admin/pharmacies/${selected.id}/medicines/${medicineId}`,
        {
          method: unlink === null ? "POST" : "DELETE",
          ...(unlink === null
            ? { body: { note: linkNote.trim() || undefined } }
            : {}),
        },
      );
      setNotice(
        unlink === null ? "دارو به داروخانه پیوند خورد." : "پیوند دارو حذف شد.",
      );
      setLinkId("");
      setLinkNote("");
      await openDetail(selected.id);
    } catch (problem) {
      setError(message(problem));
    } finally {
      setSaving(false);
    }
  }

  const title = labels[kind];
  const imageUrl = selected?.image ? safeImageUrl(selected.image) : null;
  return (
    <section className="care-page" aria-labelledby="care-title">
      <div className="care-head">
        <div>
          <span className="eyebrow">داده و مراکز / API زنده</span>
          <h1 id="care-title">{title.title}</h1>
          <p>{title.description}</p>
        </div>
        <button
          type="button"
          className="button button--primary"
          onClick={startNew}
          disabled={saving}
        >
          + افزودن {title.singular}
        </button>
      </div>
      <div className="care-tabs" role="group" aria-label="گروه داده">
        {(Object.keys(labels) as Kind[]).map((item) => (
          <button
            type="button"
            key={item}
            className={kind === item ? "care-tab care-tab--active" : "care-tab"}
            aria-pressed={kind === item}
            onClick={() => switchKind(item)}
            disabled={saving}
          >
            {labels[item].title}
          </button>
        ))}
      </div>
      <form
        className="care-filter"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setSearch(query.trim());
        }}
      >
        <label>
          جست‌وجو{" "}
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`نام ${title.singular}`}
          />
        </label>
        <label>
          وضعیت{" "}
          <select
            value={activeFilter}
            onChange={(event) => {
              setPage(1);
              setActiveFilter(event.target.value);
            }}
          >
            <option value="">همه</option>
            <option value="true">فعال</option>
            <option value="false">غیرفعال</option>
          </select>
        </label>
        <button type="submit" className="button button--primary">
          جست‌وجو
        </button>
      </form>
      {notice && (
        <p className="care-notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="form-error care-error" role="alert">
          {error}
        </p>
      )}
      {loading && (
        <p className="care-state" role="status">
          در حال دریافت داده‌ها…
        </p>
      )}
      {!loading && !error && rows.length === 0 && (
        <p className="care-state">موردی با این فیلتر پیدا نشد.</p>
      )}
      {!loading && rows.length > 0 && (
        <div className="care-list">
          {rows.map((row) => (
            <article className="care-row" key={row.id}>
              <div>
                <strong>{row.name}</strong>
                <span>
                  {kind === "medicines"
                    ? row.requiresPrescription
                      ? "نیازمند نسخه"
                      : "بدون الزام نسخه"
                    : `${row.province ?? ""}، ${row.city ?? ""}`}
                </span>
              </div>
              <div className="care-row__meta">
                <span
                  className={
                    row.isActive ? "care-badge" : "care-badge care-badge--off"
                  }
                >
                  {row.isActive ? "فعال" : "غیرفعال"}
                </span>
                {kind !== "medicines" && row.isVerified && (
                  <span className="care-badge">تأییدشده</span>
                )}
                {kind === "pharmacies" && row.onDuty && (
                  <span className="care-badge">کشیک</span>
                )}
                <button
                  type="button"
                  className="button button--text"
                  onClick={() => void openDetail(row.id)}
                >
                  جزئیات و ویرایش
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {meta && meta.totalPages > 1 && (
        <div className="care-pagination">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage(page - 1)}
          >
            صفحهٔ قبل
          </button>
          <span>
            صفحهٔ {page} از {meta.totalPages} · {meta.total} مورد
          </span>
          <button
            type="button"
            disabled={page >= meta.totalPages || loading}
            onClick={() => setPage(page + 1)}
          >
            صفحهٔ بعد
          </button>
        </div>
      )}
      {formOpen && (
        <div
          className="care-editor-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeEditor();
          }}
        >
          <section
            ref={editorRef}
            className="care-editor"
            role="dialog"
            aria-modal="true"
            aria-label={`${selected ? "ویرایش" : "افزودن"} ${title.singular}`}
          >
            <div className="care-editor__head">
              <div>
                <span className="eyebrow">
                  {selected ? `شناسهٔ ${selected.id}` : "ثبت تازه"}
                </span>
                <h2>
                  {selected ? "ویرایش" : "افزودن"} {title.singular}
                </h2>
              </div>
              <button
                ref={closeRef}
                type="button"
                className="care-editor__close"
                onClick={closeEditor}
                disabled={saving}
                aria-label="بستن"
              >
                ×
              </button>
            </div>
            {error && (
              <p className="form-error care-error" role="alert">
                {error}
              </p>
            )}
            {notice && (
              <p className="care-notice" role="status">
                {notice}
              </p>
            )}
            <form onSubmit={(event) => void save(event)} className="care-form">
              {fields[kind].map((field) =>
                field.type === "checkbox" ? (
                  <label className="care-check" key={field.key}>
                    <input
                      type="checkbox"
                      checked={form[field.key] === true}
                      disabled={saving}
                      onChange={(event) =>
                        setForm((value) => ({
                          ...value,
                          [field.key]: event.target.checked,
                        }))
                      }
                    />
                    {field.label}
                  </label>
                ) : (
                  <label key={field.key}>
                    {field.label}
                    {field.required && " *"}
                    {field.type === "textarea" ? (
                      <textarea
                        rows={3}
                        value={String(form[field.key] ?? "")}
                        disabled={saving}
                        onChange={(event) =>
                          setForm((value) => ({
                            ...value,
                            [field.key]: event.target.value,
                          }))
                        }
                      />
                    ) : (
                      <input
                        type={field.type === "number" ? "number" : "text"}
                        step={field.type === "number" ? "any" : undefined}
                        required={field.required}
                        value={String(form[field.key] ?? "")}
                        disabled={saving}
                        onChange={(event) =>
                          setForm((value) => ({
                            ...value,
                            [field.key]: event.target.value,
                          }))
                        }
                      />
                    )}
                  </label>
                ),
              )}
              {kind === "medicines" && (
                <>
                  <fieldset className="care-pet-types">
                    <legend>نوع حیوان</legend>
                    {petTypes
                      .filter(
                        (item) => item.isActive || petTypeIds.includes(item.id),
                      )
                      .map((item) => (
                        <label key={item.id} className="care-check">
                          <input
                            type="checkbox"
                            checked={petTypeIds.includes(item.id)}
                            disabled={saving}
                            onChange={() =>
                              setPetTypeIds((current) =>
                                current.includes(item.id)
                                  ? current.filter((id) => id !== item.id)
                                  : [...current, item.id],
                              )
                            }
                          />
                          {item.name}
                        </label>
                      ))}
                  </fieldset>
                  <label>
                    تصویر دارو{" "}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={saving}
                      onChange={(event) =>
                        setImage(event.target.files?.[0] ?? null)
                      }
                    />
                  </label>
                  {imageUrl && (
                    <a
                      href={imageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      مشاهدهٔ تصویر فعلی
                    </a>
                  )}
                </>
              )}
              {kind === "pharmacies" && (
                <p className="care-hint">
                  وضعیت کشیک فعلاً از API مدیریت قابل ویرایش نیست؛ گزارش آن در
                  پوشهٔ .issue ثبت شده است.
                </p>
              )}
              <div className="care-actions">
                <button
                  type="submit"
                  className="button button--primary"
                  disabled={saving}
                >
                  {saving ? "در حال ذخیره…" : "ذخیره"}
                </button>
                <button
                  type="button"
                  className="button button--text"
                  onClick={closeEditor}
                  disabled={saving}
                >
                  انصراف
                </button>
              </div>
            </form>
            {kind === "pharmacies" && selected && (
              <section className="care-links" aria-label="داروهای داروخانه">
                <h3>داروهای ثبت‌شده</h3>
                {selected.medicines?.length ? (
                  <ul>
                    {selected.medicines.map((link) => (
                      <li key={link.medicineId}>
                        <span>
                          {link.medicine.name}
                          {link.note ? ` · ${link.note}` : ""}
                        </span>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void changeLink(link.medicineId)}
                        >
                          حذف پیوند
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>هنوز دارویی برای این داروخانه ثبت نشده است.</p>
                )}
                <form
                  onSubmit={(event) => void findMedicines(event)}
                  className="care-link-search"
                >
                  <label>
                    جست‌وجوی دارو{" "}
                    <input
                      value={medicineSearch}
                      onChange={(event) =>
                        setMedicineSearch(event.target.value)
                      }
                    />
                  </label>
                  <button type="submit" className="button button--text">
                    جست‌وجو
                  </button>
                </form>
                {medicineOptions.length > 0 && (
                  <label>
                    داروی انتخابی{" "}
                    <select
                      value={linkId}
                      onChange={(event) => setLinkId(event.target.value)}
                    >
                      <option value="">انتخاب کنید</option>
                      {medicineOptions.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label>
                  یادداشت موجودی / تأیید{" "}
                  <input
                    value={linkNote}
                    onChange={(event) => setLinkNote(event.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="button button--primary"
                  disabled={saving || !linkId}
                  onClick={() => void changeLink(null)}
                >
                  ثبت یا تازه‌سازی پیوند
                </button>
              </section>
            )}
            {selected && (
              <section className="care-danger">
                <h3>حذف {title.singular}</h3>
                <p>
                  این عملیات داده را از بک‌اند حذف می‌کند و ممکن است وابستگی‌های
                  مرتبط را نیز از بین ببرد.
                </p>
                {!confirmDelete ? (
                  <button
                    type="button"
                    className="button button--text"
                    onClick={() => setConfirmDelete(true)}
                  >
                    درخواست حذف
                  </button>
                ) : (
                  <div>
                    <button
                      type="button"
                      className="button care-delete"
                      disabled={saving}
                      onClick={() => void remove()}
                    >
                      تأیید حذف {title.singular}
                    </button>
                    <button
                      type="button"
                      className="button button--text"
                      onClick={() => setConfirmDelete(false)}
                    >
                      انصراف
                    </button>
                  </div>
                )}
              </section>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
