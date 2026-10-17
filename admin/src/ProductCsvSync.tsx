import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "./auth";
import { confirmAction, errorMessage, formatNumber, markFormSaved } from "./management";
import { COLUMN_LABELS, isSyncTotals, parseProductSyncCsv, syncJsonTooLarge, validSyncPreview, SYNC_MAX_FILE_BYTES, type ParsedSyncCsv, type SyncAction, type SyncPreview, type SyncTotals } from "./product-csv-sync";
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
  const panel = useRef<HTMLElement>(null), form = useRef<HTMLFormElement>(null);
  const [parsed, setParsed] = useState<ParsedSyncCsv | null>(null);
  const [fileName, setFileName] = useState("");
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState<SyncPreview | null>(null);
  const [result, setResult] = useState<SyncTotals | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    mounted.current = true; panel.current?.focus();
    return () => { mounted.current = false; generation.current += 1; };
  }, []);
  const valid = !!parsed && parsed.rows.length > 0 && !parsed.errors.length && parsed.rows.every(row => !row.errors.length);
  async function selectFile(file?: File) {
    if (pending.current) return;
    const version = ++generation.current;
    setParsed(null); setReview(null); setResult(null); setError(""); setFileName(file?.name ?? ""); setReading(false);
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
    pending.current = true; setBusy(true); setReview(null); setResult(null); setError("");
    try {
      const response = await request<unknown>("/admin/products/sync/preview", { method: "POST", body: { rows: parsed.rows.map(row => row.data) }, timeoutMs: 70_000 });
      if (!mounted.current) return;
      if (!validSyncPreview(response, parsed.rows.length)) throw new Error("پاسخ بررسی معتبر نیست؛ دوباره بررسی کنید.");
      if (syncJsonTooLarge(response.rows.map(row => row.data))) throw new Error("حجم اطلاعات نهایی زیاد است؛ فایل را کوچک‌تر کنید.");
      setReview(response);
    } catch (problem) { if (mounted.current) setError(errorMessage(problem)); }
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
      if (!isSyncTotals(response) || Object.values(response).reduce((sum, count) => sum + count, 0) !== review.rows.length) throw new Error("پاسخ ثبت معتبر نیست.");
      setResult(response); setReview(null); if (form.current) markFormSaved(form.current); onSynced();
    } catch (problem) {
      if (mounted.current) { setReview(null); setError(`${errorMessage(problem)} پیش از تلاش دوباره، فهرست محصولات را بررسی کنید و پیش‌نمایش تازه بگیرید.`); }
    } finally { pending.current = false; if (mounted.current) setBusy(false); }
  }
  return <section ref={panel} tabIndex={-1} data-draft-region className="csv-sync-page" aria-labelledby="csv-sync-heading">
    <header className="csv-sync-heading"><div><span className="eyebrow">کاتالوگ / CSV</span><h1 id="csv-sync-heading">ورود و به‌روزرسانی محصولات</h1></div>
      <button type="button" className="button button--ghost" disabled={busy} onClick={onBack}>بازگشت به محصولات</button></header>
    <div className="catalog-panel csv-sync-guide">
      <p>شناسهٔ محصول و گزینه یا SKU را نگه دارید. خانهٔ خالی تغییری نمی‌دهد؛ عدد ۰، مقدار را صفر می‌کند.</p>
      <p>برای محصول جدید، نام، قیمت، شناسهٔ نوع حیوان و نام یا شناسهٔ برند و دسته‌بندی لازم است.</p>
      <p>برای پاک‌کردن توضیحات یا ترکیبات، <bdi>__CLEAR__</bdi> بنویسید. حداکثر ۵۰۰ ردیف و یک مگابایت.</p>
    </div>
    <form ref={form} data-draft-editor className="catalog-panel csv-sync-file" onSubmit={event => void prepare(event)} aria-busy={busy || reading}>
      <label>فایل CSV<input type="file" accept=".csv,text/csv" disabled={busy} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; void selectFile(file); }} /></label>
      {fileName && <p>فایل: <bdi>{fileName}</bdi></p>}
      {reading && <p role="status">در حال بررسی فایل…</p>}
      {error && <p className="catalog-notice catalog-notice--warning" role="alert">{error}</p>}
      {parsed?.errors.map(message => <p key={message} role="alert" className="form-error">{message}</p>)}
      {parsed && !review && !result && <div className="csv-sync-table"><table><caption>ردیف‌های فایل</caption><thead><tr><th>ردیف</th><th>محصول / گزینه</th><th>نتیجهٔ بررسی فایل</th></tr></thead><tbody>
        {parsed.rows.map(row => <tr key={row.line}><th scope="row">{formatNumber(row.line)}</th><td>{row.data.name ?? row.data.sku ?? `محصول ${row.data.productId ?? "—"} / گزینه ${row.data.variantId ?? "—"}`}</td><td>{row.errors.length ? <ul>{row.errors.map(message => <li key={message}>{message}</li>)}</ul> : "آمادهٔ بررسی در سامانه"}</td></tr>)}
      </tbody></table></div>}
      {!result && <button type="submit" className="button button--outline" disabled={busy || reading || !valid}>{busy ? "در حال بررسی…" : review ? "بررسی دوباره" : "بررسی تغییرات"}</button>}
      {review && <section className="csv-sync-review" aria-labelledby="csv-sync-review-heading">
        <h2 id="csv-sync-review-heading">پیش‌نمایش تغییرات</h2><Totals totals={review.totals} />
        <div className="csv-sync-table"><table><caption>تغییرات تأییدشده توسط سامانه</caption><thead><tr><th>ردیف</th><th>محصول / گزینه</th><th>عملیات</th><th>تغییرات</th></tr></thead><tbody>{review.rows.map(row => <tr key={row.line}>
          <th scope="row">{formatNumber(row.line)}</th><td>{row.data.name ?? row.data.sku ?? `محصول ${row.data.productId ?? "—"}`}<small>{row.data.variantId ? `گزینه ${row.data.variantId}` : ""}</small></td><td>{ACTIONS[row.action]}</td>
          <td>{row.changes.length ? <dl className="csv-sync-changes">{row.changes.map(change => <div key={change.field}><dt>{COLUMN_LABELS[change.field]}</dt><dd><span>{text(change.before)}</span><span aria-hidden="true">←</span><strong>{text(change.after)}</strong></dd></div>)}</dl> : "بدون تغییر"}</td>
        </tr>)}</tbody></table></div>
        <button type="button" className="button button--primary" disabled={busy} onClick={() => void apply()}>{busy ? "در حال ثبت…" : "تأیید و ثبت تغییرات"}</button>
      </section>}
      {result && <div role="status" className="catalog-notice"><p>تغییرات ثبت شد.</p><Totals totals={result} /></div>}
    </form>
  </section>;
}
