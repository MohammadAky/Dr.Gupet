import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { ApiError, type PageMeta, type PageResult } from "./api/client";
import { useAuth } from "./auth";
import { discardDrafts, markFormSaved, normalizeDigits, showFieldErrors } from "./management";
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
  pharmacies: [
    ...commonPlace,
    { key: "onDuty", label: "کشیک", type: "checkbox" },
  ],
  clinics: commonPlace,
};

function message(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof TypeError)
    return "اتصال برقرار نشد. ارتباط اینترنت را بررسی کنید و دوباره تلاش کنید.";
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
      const normalized = normalizeDigits(text).replace(/٫/g, ".");
      const coordinate = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized) ? Number(normalized) : NaN;
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
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const detailGeneration = useRef(0);
  const kindRef = useRef<Kind>("medicines");
  const savingRef = useRef(false);
  const mounted = useRef(true);
  const medicineSearchVersion = useRef(0);
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
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false; detailGeneration.current += 1;
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const closeEditor = useCallback(async () => {
    if (savingRef.current) return;
    if (editorRef.current?.querySelector("[data-dirty='true']") && !await discardDrafts(editorRef.current)) return;
    detailGeneration.current += 1;
    setLoading(false);
    if (typeof matchMedia === "function" && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setClosing(true);
      closeTimer.current = setTimeout(() => { setFormOpen(false); setClosing(false); closeTimer.current = null; }, 180);
    } else setFormOpen(false);
  }, []);

  useEffect(() => {
    if (!formOpen) return;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    const background = Array.from(document.body.children).filter(
      (element): element is HTMLElement =>
        element instanceof HTMLElement && element !== backdropRef.current,
    );
    const priorInert = background.map((element) => element.hasAttribute("inert"));
    background.forEach((element) => element.setAttribute("inert", ""));
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (document.querySelector(".admin-confirm")) return;
      if (event.key === "Escape") {
        event.preventDefault();
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
      if (!first || !last) {
        event.preventDefault();
        editorRef.current.focus();
        return;
      }
      if (!editorRef.current.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
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
      background.forEach((element, index) => {
        if (!priorInert[index]) element.removeAttribute("inert");
      });
      document.body.style.overflow = previousOverflow;
      if (previous?.isConnected) previous.focus();
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
  }, [request, kind, revision]);

  function switchKind(next: Kind) {
    if (savingRef.current) return;
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
    if (savingRef.current) return;
    detailGeneration.current += 1;
    setSelected(null);
    setForm(initialForm(kind));
    setPetTypeIds([]);
    setImage(null);
    setConfirmDelete(false);
    setError("");
    setLoading(false);
    setFormOpen(true);
    setClosing(false);
    setMedicineOptions([]); setLinkId(""); setLinkNote(""); setMedicineSearch("");
  }

  async function openDetail(id: number) {
    const requestedKind = kindRef.current;
    const generation = ++detailGeneration.current;
    setMedicineOptions([]); setLinkId(""); setLinkNote(""); setMedicineSearch("");
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
    const formElement = event.currentTarget;
    if (savingRef.current || closeTimer.current) return;
    setError("");
    setNotice("");
    let payload: Record<string, unknown>;
    const invalid: Record<string, string> = {};
    for (const field of fields[kind]) {
      const value = String(form[field.key] ?? "").trim();
      if (field.required && value.length < 2) invalid[field.key] = `${field.label} باید دست‌کم دو نویسه داشته باشد.`;
      if (field.type === "number" && value) {
        const normalized = normalizeDigits(value).replace(/٫/g, ".");
        const coordinate = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized) ? Number(normalized) : NaN; const limit = field.key === "lat" ? 90 : 180;
        if (!Number.isFinite(coordinate) || Math.abs(coordinate) > limit) invalid[field.key] = `عدد معتبر بین ${-limit} و ${limit} وارد کنید.`;
      }
    }
    showFieldErrors(formElement, invalid);
    if (Object.keys(invalid).length) { setError("فیلدهای مشخص‌شده را اصلاح کنید."); return; }
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
    const linksDraft = editorRef.current?.querySelector(".care-links") ?? null;
    if (!await discardDrafts(linksDraft) || !mounted.current || savingRef.current) return;
    savingRef.current = true; setSaving(true);
    try {
      if (kind === "medicines" && image) {
        const formData = new FormData();
        formData.append("file", image);
        const uploaded = await request<{ url: string }>("/upload/image", {
          method: "POST",
          formData,
        });
        if (!mounted.current) return;
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
      if (!mounted.current) return;
      setSelected(result);
      markFormSaved(formElement);
      if (linksDraft instanceof HTMLElement) markFormSaved(linksDraft);
      setNotice(`${labels[kind].singular} ذخیره شد.`);
      setRevision((value) => value + 1);
      setImage(null);
      await openDetail(result.id);
    } catch (problem) {
      if (mounted.current) setError(problem instanceof Error ? problem.message : message(problem));
    } finally {
      savingRef.current = false; if (mounted.current) setSaving(false);
    }
  }

  async function remove() {
    if (!selected || savingRef.current || closeTimer.current) return;
    savingRef.current = true; setSaving(true);
    setError("");
    try {
      await request(`/admin/${kind}/${selected.id}`, { method: "DELETE" });
      if (!mounted.current) return;
      detailGeneration.current += 1;
      setFormOpen(false);
      setSelected(null);
      setConfirmDelete(false);
      setNotice(`${labels[kind].singular} حذف شد.`);
      setRevision((value) => value + 1);
    } catch (problem) {
      if (mounted.current) setError(message(problem));
    } finally {
      savingRef.current = false; if (mounted.current) setSaving(false);
    }
  }

  async function findMedicines(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const generation = detailGeneration.current;
    const version = ++medicineSearchVersion.current;
    setError("");
    try {
      const parameters = new URLSearchParams({ page: "1", limit: "20" });
      if (medicineSearch.trim()) parameters.set("q", medicineSearch.trim());
      const result = await request<PageResult<Row>>(
        `/admin/medicines?${parameters}`,
        { withMeta: true },
      );
      if (generation === detailGeneration.current && version === medicineSearchVersion.current) setMedicineOptions(result.data);
    } catch (problem) {
      if (generation === detailGeneration.current && version === medicineSearchVersion.current) setError(message(problem));
    }
  }

  async function changeLink(unlink: number | null) {
    if (!selected || savingRef.current || closeTimer.current) return;
    const medicineId = unlink ?? Number(linkId);
    if (!Number.isSafeInteger(medicineId) || medicineId < 1) {
      setError("ابتدا یک دارو انتخاب کنید.");
      return;
    }
    const abandonedDraft = unlink === null ? editorRef.current?.querySelector(".care-form") : editorRef.current;
    if (!await discardDrafts(abandonedDraft ?? null)) return;
    if (savingRef.current || !mounted.current) return;
    savingRef.current = true; setSaving(true);
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
      if (!mounted.current) return;
      editorRef.current?.querySelectorAll<HTMLElement>("[data-dirty='true']").forEach(markFormSaved);
      setNotice(
        unlink === null ? "دارو به داروخانه پیوند خورد." : "پیوند دارو حذف شد.",
      );
      setLinkId("");
      setLinkNote("");
      await openDetail(selected.id);
    } catch (problem) {
      if (mounted.current) setError(message(problem));
    } finally {
      savingRef.current = false; if (mounted.current) setSaving(false);
    }
  }

  const title = labels[kind];
  const imageUrl = selected?.image ? safeImageUrl(selected.image) : null;
  return (
    <section className="care-page" aria-labelledby="care-title">
      <div className="care-head">
        <div>
          <span className="eyebrow">راهنمای سلامت و مراکز</span>
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
      {notice && !formOpen && (
        <p className="care-notice" role="status">
          {notice}
        </p>
      )}
      {error && !formOpen && (
        <div className="form-error care-error" role="alert">
          {error}
          <button
            type="button"
            className="button button--text"
            disabled={loading || saving}
            onClick={() => {
              setError("");
              setRevision((value) => value + 1);
            }}
          >
            تلاش دوباره
          </button>
        </div>
      )}
      {loading && (
        <p className="care-state" role="status">
          در حال دریافت داده‌ها…
        </p>
      )}
      {!loading && !error && rows.length === 0 && (
        <p className="care-state">موردی با این فیلتر پیدا نشد.</p>
      )}
      {!loading && !error && rows.length > 0 && (
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
      {formOpen && createPortal(
        <div
          ref={backdropRef}
          className={`care-editor-backdrop${closing ? " care-editor-backdrop--closing" : ""}`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeEditor();
          }}
        >
          <section
            ref={editorRef}
            className="care-editor"
            role="dialog"
            tabIndex={-1}
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
            <form onSubmit={(event) => void save(event)} className="care-form" noValidate>
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
                        name={field.key}
                        required={field.required}
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
                        type="text"
                        inputMode={field.type === "number" ? "decimal" : undefined}
                        name={field.key}
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
              <section className="care-links" aria-label="داروهای داروخانه" data-draft-editor>
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
                      disabled={saving}
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
                    disabled={saving}
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
                  این عملیات اطلاعات را حذف می‌کند و ممکن است وابستگی‌های
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
        </div>,
        document.body,
      )}
    </section>
  );
}
