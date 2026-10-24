import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "./auth";
import { ApiError, type ApiErrorDetail } from "./api/client";
import { confirmAction, errorMessage, formatNumber, markFormSaved } from "./management";
import { COLUMN_LABELS, isSyncNotes, isSyncTotals, parseProductSyncCsv, syncErrorMessage, syncJsonTooLarge, validSyncPreview, SYNC_MAX_FILE_BYTES, type ParsedSyncCsv, type SyncAction, type SyncNote, type SyncPreview, type SyncTotals } from "./product-csv-sync";
import "./product-csv-sync.css";

const ACTIONS: Record<SyncAction, string> = { create: "محصول جدید", update: "به‌روزرسانی", unchanged: "بدون تغییر", "add-variant": "گزینهٔ جدید" };
function text(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "منتشرشده" : "منتشرنشده";
  return typeof value === "number" ? formatNumber(value) : String(value);
}
function Totals({ totals }: { totals: SyncTotals }) {
  return <dl className="csv-sync-totals">{([
    ["created", "محصول جدید"], ["updated", "به‌روزرسانی"], ["variantsAdded", "گزینهٔ جدید"], ["unchanged", "بدون تغییر"],
  ] as const).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{formatNumber(totals[key])}</dd></div>)}</dl>;
}
async function read(file: File): Promise<string> {
  if (typeof file.text === "function") return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("خواندن فایل انجام نشد.")); reader.readAsText(file, "UTF-8");
  });
}

export function ProductCsvSync({ onBack, onSynced }: { onBack(): void; onSynced(): void }) {
  const { request } = useAuth();
  const mounted = useRef(true), pending = useRef(false), generation = useRef(0);
  const sent = useRef<Array<{ sku?: string; name?: string }>>([]);
  const panel = useRef<HTMLElement>(null), form = useRef<HTMLFormElement>(null);
  const [parsed, setParsed] = useState<ParsedSyncCsv | null>(null);
  const [fileName, setFileName] = useState("");
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState<SyncPreview | null>(null);
  const [result, setResult] = useState<SyncTotals | null>(null);
  const [notes, setNotes] = useState<SyncNote[]>([]);
  const [conflicts, setConflicts] = useState<ApiErrorDetail[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    mounted.current = true; panel.current?.focus();
    return () => { mounted.current = false; generation.current += 1; };
  }, []);
  const valid = !!parsed && parsed.rows.length > 0 && !parsed.errors.length && parsed.rows.every(row => !row.errors.length);
  async function selectFile(file?: File) {
    if (pending.current) return;
    const version = ++generation.current;
    setParsed(null); setReview(null); setResult(null); setNotes([]); setConflicts([]); setError(""); setFileName(file?.name ?? ""); setReading(false);
    if (!file) return;
    if (file.size > SYNC_MAX_FILE_BYTES) { setError("حجم فایل باید حداکثر یک مگابایت باشد."); return; }
    setReading(true);
    try {
      const source = await read(file);
      if (mounted.current && version === generation.current) setParsed(parseProductSyncCsv(source));
    } catch (problem) {
      if (mounted.current && version === generation.current) setError(errorMessage(problem));
    } finally { if (mounted.current && version === generation.current) setReading(false); }
  }
  async function prepare(event: FormEvent) {
    event.preventDefault();
    if (pending.current || reading || result || !valid || !parsed) return;
    pending.current = true; setBusy(true); setReview(null); setResult(null); setNotes([]); setConflicts([]); setError("");
    try {
      const payload = parsed.rows.map(row => row.data);
      sent.current = parsed.rows.map(row => ({ sku: row.data.sku, name: row.reference }));
      const response = await request<unknown>("/admin/products/sync/preview", { method: "POST", body: { rows: payload }, timeoutMs: 70_000 });
      if (!mounted.current) return;
      if (!validSyncPreview(response, parsed.rows.length)) throw new Error("پاسخ بررسی معتبر نیست؛ دوباره بررسی کنید.");
      if (syncJsonTooLarge(response.rows.map(row => row.data))) throw new Error("حجم اطلاعات نهایی زیاد است؛ فایل را کوچک‌تر کنید.");
      setReview(response); setNotes(response.notes ?? []);
    } catch (problem) {
      if (mounted.current) { setError(syncErrorMessage(errorMessage(problem), sent.current)); if (problem instanceof ApiError && problem.details?.length) setConflicts(problem.details); }
    }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  }
  async function apply() {
    if (pending.current || !review || result) return;
    pending.current = true; setBusy(true); setError("");
    try {
      const { created, updated, variantsAdded } = review.totals;
      if (!await confirmAction(`${formatNumber(created)} محصول جدید، ${formatNumber(updated)} به‌روزرسانی و ${formatNumber(variantsAdded)} گزینهٔ جدید مطابق پیش‌نمایش ثبت شود؟`, "ثبت تغییرات CSV")) return;
      if (!mounted.current) return;
      const response = await request<unknown>("/admin/products/sync", { method: "POST", body: { rows: review.rows.map(row => row.data) }, timeoutMs: 70_000 });
      if (!mounted.current) return;
      if (!isSyncTotals(response) || response.created + response.updated + response.unchanged + response.variantsAdded !== review.rows.length) throw new Error("پاسخ ثبت معتبر نیست.");
      const returned = (response as { notes?: unknown }).notes;
      setResult(response); setNotes(isSyncNotes(returned) ? returned : []);
      setReview(null); if (form.current) markFormSaved(form.current); onSynced();
    } catch (problem) {
      if (mounted.current) {
        setReview(null);
        setError(`${syncErrorMessage(errorMessage(problem), sent.current)} پیش از تلاش دوباره، فهرست محصولات را بررسی کنید و پیش‌نمایش تازه بگیرید.`);
        if (problem instanceof ApiError && problem.details?.length) setConflicts(problem.details);
      }
    } finally { pending.current = false; if (mounted.current) setBusy(false); }
  }
  return <section ref={panel} tabIndex={-1} data-draft-region className="csv-sync-page" aria-labelledby="csv-sync-heading">
    <header className="csv-sync-heading"><div><span className="eyebrow">کاتالوگ / CSV</span><h1 id="csv-sync-heading">ویرایش محصولات با CSV</h1></div>
      <button type="button" className="button button--ghost" disabled={busy} onClick={onBack}>بازگشت به محصولات</button></header>
    <div className="catalog-panel csv-sync-guide">
      <p>این صفحه هم برای <bdi>تغییر قیمت</bdi> است و هم برای ویرایش نام، دسته‌بندی، انتشار، موجودی و گزینه‌ها. فهرست را از «خروجی CSV» بگیر؛ برای قیمت، خروجی «فایل قیمت» را انتخاب کن.</p>
      <p>اگر همهٔ ستون‌های فایل فقط قیمت باشند (<bdi>sku</bdi>، <bdi>name</bdi>، <bdi>price</bdi>، <bdi>compareAtPrice</bdi>)، فایل «قیمت‌محور» شناخته می‌شود: قیمت اعمال می‌شود و ستون «نام محصول» فقط برچسب است، نه تغییر نام.</p>
      <p><strong>ثبت همه یا هیچ است:</strong> یا همهٔ ردیف‌ها با هم ثبت می‌شوند یا اگر یک ردیف ایراد داشته باشد هیچ‌کدام. تعداد ردیف‌های ایراددار پیش از ارسال نمایش داده می‌شود.</p>
      <p>شناسهٔ محصول و گزینه یا SKU را نگه دارید. خانهٔ خالی تغییری نمی‌دهد؛ عدد ۰، مقدار را صفر می‌کند.</p>
      <p>برای محصول جدید، نام، قیمت، شناسهٔ نوع حیوان و نام یا شناسهٔ برند و دسته‌بندی لازم است.</p>
      <p>برای پاک‌کردن توضیحات یا ترکیبات، <bdi>__CLEAR__</bdi> بنویسید. حداکثر ۵۰۰ ردیف و یک مگابایت.</p>
      <p>ستون‌های «موجودی هنگام خروجی» و «زمان نسخهٔ محصول» نسخهٔ فایل را نگه می‌دارند؛ آن‌ها را ویرایش نکنید تا فروش یا ویرایش هم‌زمان بازنویسی نشود.</p>
    </div>
    <form ref={form} data-draft-editor className="catalog-panel csv-sync-file" onSubmit={event => void prepare(event)} aria-busy={busy || reading}>
      <label>فایل CSV<input type="file" accept=".csv,text/csv" disabled={busy} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; void selectFile(file); }} /></label>
      {fileName && <p>فایل: <bdi>{fileName}</bdi></p>}
      {reading && <p role="status">در حال بررسی فایل…</p>}
      {error && <p className="catalog-notice catalog-notice--warning" role="alert">{error}</p>}
      {conflicts.length > 0 && <section className="csv-sync-conflicts" aria-labelledby="csv-sync-conflicts-heading">
        <h2 id="csv-sync-conflicts-heading">هیچ تغییری ثبت نشد — ردیف‌های مانع</h2>
        <p><strong>هیچ تغییری اعمال نشد.</strong> ثبت همه‌یا‌هیچ است؛ تا رفع همین ردیف‌ها هیچ محصولی تغییر نمی‌کند.</p>
        <ul>{conflicts.slice(0, 12).map((conflict, index) => <li key={`${conflict.line}-${conflict.field}-${index}`}>
          ردیف {formatNumber(Number(conflict.line ?? 0))}{conflict.variant ? <> / <bdi>{String(conflict.variant)}</bdi></> : null}{conflict.product ? ` «${conflict.product}»` : ""}: {String(conflict.message ?? "")}
        </li>)}</ul>
        {conflicts.length > 12 && <p>و {formatNumber(conflicts.length - 12)} ردیف دیگر.</p>}
        <p>خروجی تازه بگیرید و همان ویرایش را دوباره اعمال کنید. ستون‌های شناسه، «موجودی هنگام خروجی» و «زمان نسخهٔ محصول» را در فایل تغییر ندهید.</p>
      </section>}
      {notes.length > 0 && <section className="catalog-notice csv-sync-notes" role="status" aria-labelledby="csv-sync-notes-heading">
        <h2 id="csv-sync-notes-heading">مقدارهایی که بازنویسی نشدند</h2>
        <ul>{notes.slice(0, 12).map((note, index) => <li key={`${note.line}-${note.field}-${index}`}>
          ردیف {formatNumber(note.line)}{note.variant ? <> / <bdi>{note.variant}</bdi></> : null}: {note.message}
        </li>)}</ul>
      </section>}
      {parsed?.errors.map(message => <p key={message} role="alert" className="form-error">{message}</p>)}
      {parsed?.priceFile && !parsed.errors.length && (
        <p className="catalog-notice" role="status">این فایل قیمت‌محور است: فقط ستون‌های قیمت اعمال می‌شوند، موجودی و نام محصول دست‌نخورده می‌مانند.</p>
      )}
      {!!parsed?.ignored && (
        <p role="status">{formatNumber(parsed.ignored)} ردیف بدون گزینه و بدون قیمت نادیده گرفته شد؛ آن محصول فقط از صفحهٔ ویرایش خودش قیمت می‌گیرد.</p>
      )}
      {parsed && !review && !result && <div className="csv-sync-table"><table><caption>ردیف‌های فایل</caption><thead><tr><th>ردیف</th><th>محصول / گزینه</th><th>نتیجهٔ بررسی فایل</th></tr></thead><tbody>
        {parsed.rows.map(row => <tr key={row.line}><th scope="row">{formatNumber(row.line)}</th><td>{row.data.name ?? row.data.sku ?? `محصول ${row.data.productId ?? "—"} / گزینه ${row.data.variantId ?? "—"}`}</td><td>{row.errors.length ? <ul>{row.errors.map(message => <li key={message}>{message}</li>)}</ul> : "آمادهٔ بررسی در سامانه"}</td></tr>)}
      </tbody></table></div>}
      {parsed && !review && !result && parsed.rows.some(row => row.errors.length) && (
        <p className="catalog-notice catalog-notice--warning" role="status">{
          `${formatNumber(parsed.rows.filter(row => row.errors.length).length)} ردیف ایراد دارد؛ تا اصلاح همهٔ آن‌ها هیچ محصولی تغییر نمی‌کند (همه یا هیچ).`
        }</p>
      )}
      {!result && <button type="submit" className="button button--outline" disabled={busy || reading || !valid}>{busy ? "در حال بررسی…" : review ? "بررسی دوباره" : "بررسی تغییرات"}</button>}
      {review && <section className="csv-sync-review" aria-labelledby="csv-sync-review-heading">
        <h2 id="csv-sync-review-heading">پیش‌نمایش تغییرات</h2><Totals totals={review.totals} />
        <div className="csv-sync-table"><table><caption>تغییرات تأییدشده توسط سامانه</caption><thead><tr><th>ردیف</th><th>محصول / گزینه</th><th>عملیات</th><th>تغییرات</th></tr></thead><tbody>{review.rows.map((row, index) => <tr key={row.line}>
          <th scope="row">{formatNumber(row.line)}</th><td>{row.data.name ?? parsed?.rows[index]?.reference ?? row.data.sku ?? `محصول ${row.data.productId ?? "—"}`}<small>{row.data.variantId ? `گزینه ${row.data.variantId}` : ""}</small></td><td>{ACTIONS[row.action]}</td>
          <td>{row.changes.length ? <dl className="csv-sync-changes">{row.changes.map(change => <div key={change.field}><dt>{COLUMN_LABELS[change.field]}</dt><dd><span>{text(change.before)}</span><span aria-hidden="true">←</span><strong>{text(change.after)}</strong></dd></div>)}</dl> : "بدون تغییر"}</td>
        </tr>)}</tbody></table></div>
        <p>ثبت همه‌یا‌هیچ است: یا همهٔ این {formatNumber(review.rows.length)} ردیف با هم اعمال می‌شود یا هیچ‌کدام.</p>
        <button type="button" className="button button--primary" disabled={busy} onClick={() => void apply()}>{busy ? "در حال ثبت…" : "تأیید و ثبت تغییرات"}</button>
      </section>}
      {result && <div role="status" className="catalog-notice"><p>تغییرات ثبت شد.</p><Totals totals={result} /></div>}
    </form>
  </section>;
}
