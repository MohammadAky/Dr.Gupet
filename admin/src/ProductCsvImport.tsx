import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { useAuth } from "./auth";
import type { CatalogReferences } from "./CatalogReferences";
import { confirmAction, errorMessage, formatMoney, formatNumber, markFormSaved } from "./management";
import { PRODUCT_CSV_MAX_BYTES, PRODUCT_IMPORT_MAX_BYTES, reviewProductCsv } from "./product-csv";
import { resolveCsvReferences, suggestCsvReferences } from "./product-csv-references";
import "./product-csv.css";
import csvTemplate from "../public/product-import-template.csv?raw";

type ImportResult = { imported: number; products: Array<{ id: number; name: string; slug: string }> };
function readFile(file: File): Promise<string> {
  if (typeof file.text === "function") return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("خواندن فایل انجام نشد."));
    reader.readAsText(file, "UTF-8");
  });
}

export function ProductCsvImport({ refs, onBack, onImported }: {
  refs: CatalogReferences; onBack: () => void; onImported: () => void;
}) {
  const { request } = useAuth();
  const [brandId, setBrandId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [petTypeId, setPetTypeId] = useState("");
  const [source, setSource] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<number, Record<string, string>>>({});
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const pending = useRef(false), generation = useRef(0), mounted = useRef(true);
  const panel = useRef<HTMLElement>(null), form = useRef<HTMLFormElement>(null);
  const listId = useId();
  useEffect(() => {
    mounted.current = true; panel.current?.focus();
    return () => { mounted.current = false; generation.current += 1; };
  }, []);
  const categories = refs.categories.filter(category => category.isActive !== false && (!category.petTypeId || String(category.petTypeId) === petTypeId));
  const review = useMemo(() => source === null ? null : reviewProductCsv(source, edits), [source, edits]);
  const rows = review?.rows.map(row => resolveCsvReferences(row, refs, { brandId, categoryId, petTypeId })) ?? [];
  const validCount = rows.filter(row => row.data).length;
  const body = { ...(brandId ? { brandId: Number(brandId) } : {}), ...(categoryId ? { categoryId: Number(categoryId) } : {}), ...(petTypeId ? { petTypeId: Number(petTypeId) } : {}), rows: rows.map(row => row.data!) };
  const payloadTooLarge = new TextEncoder().encode(JSON.stringify(body)).byteLength > PRODUCT_IMPORT_MAX_BYTES;
  const canImport = !!review && !review.errors.length && rows.length > 0 && validCount === rows.length && !result && !payloadTooLarge;
  function editRow(number: number, patch: Record<string, string>) {
    if (pending.current) return;
    setEdits(current => ({ ...current, [number]: { ...current[number], ...patch } }));
    setError("");
    if (form.current) form.current.dataset.dirty = "true";
  }
  async function selectFile(file?: File) {
    if (pending.current) return;
    const version = ++generation.current;
    setSource(null); setEdits({}); setResult(null); setError(""); setReading(false); setFileName(file?.name ?? "");
    if (!file) return;
    if (file.size > PRODUCT_CSV_MAX_BYTES) { setError("حجم فایل باید حداکثر یک مگابایت باشد."); return; }
    setReading(true);
    try {
      const nextSource = await readFile(file);
      if (mounted.current && version === generation.current) {
        const parsed = reviewProductCsv(nextSource);
        setEdits(Object.fromEntries(parsed.rows.map(row => [row.number, suggestCsvReferences(row, refs)])));
        setSource(nextSource);
      }
    } catch (problem) {
      if (mounted.current && version === generation.current) setError(errorMessage(problem));
    } finally {
      if (mounted.current && version === generation.current) setReading(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || reading || !canImport || !review) return;
    pending.current = true; setBusy(true); setError("");
    try {
      if (!await confirmAction(`${formatNumber(review.rows.length)} محصول با مشخصات پیش‌نمایش ثبت شود؟ برندها و دسته‌بندی‌های جدید هم ساخته می‌شوند. فایل کامل و یک‌جا ثبت می‌شود.`, "تأیید ورود محصولات")) return;
      if (!mounted.current) return;
      const response = await request<ImportResult>("/admin/products/import", {
        method: "POST", body,
      });
      if (!mounted.current) return;
      if (response.imported !== review.rows.length || !Array.isArray(response.products) || response.products.length !== response.imported) {
        throw new Error("پاسخ ثبت نامعتبر است؛ پیش از ارسال دوباره، فهرست محصولات را بررسی کنید.");
      }
      setResult(response); if (form.current) markFormSaved(form.current); onImported();
    } catch (problem) {
      if (mounted.current) setError(`${errorMessage(problem)} اگر پاسخ سرور نرسیده است، پیش از ارسال دوباره فهرست محصولات را بررسی کنید.`);
    } finally {
      pending.current = false; if (mounted.current) setBusy(false);
    }
  }
  return <section ref={panel} tabIndex={-1} data-draft-region className="csv-import" aria-labelledby="csv-import-title">
    <div className="csv-import-heading"><div><p>کاتالوگ / ورود گروهی</p><h1 id="csv-import-title">ورود محصولات از CSV</h1></div>
      <button type="button" className="button button--ghost" disabled={busy} onClick={onBack}>بازگشت به محصولات</button></div>
    <div className="catalog-panel csv-import-guide">
      <h2>فایل را انتخاب و پیشنهادها را بررسی کنید</h2>
      <p>نام (<bdi>name</bdi>) و قیمت به تومان (<bdi>price</bdi>) الزامی‌اند. حداکثر ۱۰۰ محصول و یک مگابایت؛ قیمت صفر پذیرفته می‌شود.</p>
      <p>برند، دسته‌بندی و نوع حیوان از ستون‌های فایل یا نام و توضیحات پیشنهاد می‌شوند و در پیش‌نمایش قابل ویرایش‌اند. موارد نامشخص را انتخاب کنید.</p>
      <p>ستون‌های مرجع: <bdi>brand</bdi>، <bdi>category</bdi>، <bdi>petType</bdi> یا شناسه‌های <bdi>brandId</bdi>، <bdi>categoryId</bdi> و <bdi>petTypeId</bdi>.</p>
      <p>نمایش: <bdi>T</bdi> منتشرشده، <bdi>F</bdi> منتشرنشده. مقدار خالی منتشرنشده است؛ انتشار به وزن بیشتر از صفر نیاز دارد.</p>
      <p>عددهای اختیاری خالی، صفر و متن‌های خالی، بدون مقدار ثبت می‌شوند. شناسه و نشانی خالی را سرور می‌سازد.</p>
      <p>فایل CSV UTF-8 باشد. برای ویرگول یا متن چندخطی از نقل‌قول استفاده کنید. محصول تکراری جایگزین نمی‌شود.</p>
      <a className="button button--ghost" href={`data:text/csv;charset=utf-8,${encodeURIComponent("\uFEFF" + csvTemplate.replace(/^\uFEFF/, ""))}`} download="product-import-template.csv">دریافت قالب CSV</a>
    </div>
    <form ref={form} data-draft-editor className="catalog-panel csv-import-form" onSubmit={event => void submit(event)}>
      <label className="csv-import-file">فایل محصولات<input type="file" accept=".csv,text/csv" disabled={busy || !!result} onChange={event => void selectFile(event.target.files?.[0])} /></label>
      <details className="csv-import-defaults"><summary>مشخصات مشترک اختیاری</summary><p>فقط برای ردیف‌هایی که مشخصهٔ مربوط را ندارند.</p>
        <fieldset disabled={busy || reading || !!result} className="csv-import-fields">
          <label>نوع حیوان<select value={petTypeId} onChange={event => { setPetTypeId(event.target.value); setCategoryId(""); }}><option value="">بدون پیش‌فرض</option>{refs.petTypes.filter(value => value.isActive !== false).map(value => <option key={value.id} value={value.id}>{value.name}</option>)}</select></label>
          <label>برند<select value={brandId} onChange={event => setBrandId(event.target.value)}><option value="">بدون پیش‌فرض</option>{refs.brands.filter(value => value.isActive !== false).map(value => <option key={value.id} value={value.id}>{value.name}</option>)}</select></label>
          <label>دسته‌بندی<select value={categoryId} onChange={event => setCategoryId(event.target.value)}><option value="">بدون پیش‌فرض</option>{categories.map(value => <option key={value.id} value={value.id}>{value.name}</option>)}</select></label>
        </fieldset>
      </details>
      <datalist id={`${listId}-brands`}>{refs.brands.filter(value => value.isActive !== false).map(value => <option key={value.id} value={value.name} />)}</datalist>
      {fileName && <p>فایل انتخاب‌شده: <bdi>{fileName}</bdi></p>}
      {reading && <p role="status">در حال بررسی فایل…</p>}
      {error && <p className="catalog-notice catalog-notice--warning" role="alert">{error}</p>}
      {review?.errors.map(message => <p key={message} role="alert" className="catalog-notice catalog-notice--warning">{message}</p>)}
      {payloadTooLarge && <p role="alert" className="catalog-notice catalog-notice--warning">حجم اطلاعات محصولات برای یک درخواست زیاد است؛ فایل را به چند فایل کوچک‌تر تقسیم کنید یا توضیحات را کوتاه کنید.</p>}
      {review && rows.length > 0 && <>
        <h2>پیش‌نمایش محصولات</h2><p role="status">{formatNumber(validCount)} ردیف معتبر از {formatNumber(rows.length)} ردیف. {validCount !== rows.length ? "موارد مشخص‌شده را اصلاح کنید." : "آمادهٔ ثبت."}</p>
        <div className="csv-import-table"><table><caption className="csv-import-caption">پیشنهادها را بررسی کنید؛ برند و دسته‌بندی جدید فقط پس از تأیید ثبت ساخته می‌شوند.</caption><thead><tr><th scope="col">ردیف CSV</th><th scope="col">نام محصول</th><th scope="col">برند</th><th scope="col">دسته‌بندی</th><th scope="col">نوع حیوان</th><th scope="col">قیمت</th><th scope="col">قیمت پیش از تخفیف</th><th scope="col">موجودی</th><th scope="col">وزن</th><th scope="col">نمایش</th><th scope="col">شناسه و توضیحات</th><th scope="col">نتیجهٔ بررسی</th></tr></thead>
          <tbody>{rows.map(row => {
            const number = formatNumber(row.number);
            const active = (row.values?.isActive ?? "").trim().toLowerCase();
            const published = ["t", "true", "1", "۱", "١"].includes(active);
            const publication = published ? "T" : ["", "f", "false", "0", "۰", "٠"].includes(active) ? "F" : "";
            return <tr key={row.number}><th scope="row">{number}</th><td>{row.name || "—"}</td>
              <td><input aria-label={`برند ردیف ${number}`} list={`${listId}-brands`} maxLength={191} value={row.brandLabel} disabled={busy || !!result} onChange={event => editRow(row.number, { brandId: "", brandName: event.target.value })} /><small>{row.brandStatus}</small></td>
              <td><input aria-label={`دسته‌بندی ردیف ${number}`} list={`${listId}-category-${row.number}`} maxLength={191} value={row.categoryLabel} disabled={busy || !!result} onChange={event => editRow(row.number, { categoryId: "", categoryName: event.target.value })} /><small>{row.categoryStatus}</small><datalist id={`${listId}-category-${row.number}`}>{refs.categories.filter(value => value.isActive !== false && (!value.petTypeId || String(value.petTypeId) === row.petTypeValue)).map(value => <option key={value.id} value={value.name} />)}</datalist></td>
              <td><select aria-label={`نوع حیوان ردیف ${number}`} value={row.petTypeValue} disabled={busy || !!result} onChange={event => editRow(row.number, { petTypeId: event.target.value, petType: "" })}><option value="">انتخاب کنید</option>{refs.petTypes.filter(value => value.isActive !== false).map(value => <option key={value.id} value={value.id}>{value.name}</option>)}</select></td>
              <td>{row.data ? formatMoney(row.data.price) : <bdi>{row.price || "—"}</bdi>}</td><td>{row.data ? formatMoney(row.data.compareAtPrice) : "—"}</td><td>{row.data ? formatNumber(row.data.stock) : "—"}</td>
              <td><input aria-label={`وزن ردیف ${number} (گرم)`} inputMode="numeric" value={row.values?.weightGram ?? ""} disabled={busy || !!result} onChange={event => editRow(row.number, { weightGram: event.target.value })} /></td>
              <td><select aria-label={`نمایش ردیف ${number}`} value={publication} disabled={busy || !!result} onChange={event => editRow(row.number, { isActive: event.target.value })}><option value="">انتخاب کنید</option><option value="T">منتشرشده</option><option value="F">منتشرنشده</option></select></td>
              <td>{row.values && <details><summary>جزئیات ردیف {number}</summary><dl><dt>SKU</dt><dd><bdi>{row.values.sku || "ساخت خودکار"}</bdi></dd><dt>نشانی</dt><dd><bdi>{row.values.slug || "ساخت خودکار"}</bdi></dd><dt>ترکیبات</dt><dd>{row.values.ingredientsText || "—"}</dd><dt>توضیحات</dt><dd>{row.values.description || "—"}</dd></dl></details>}</td><td>{row.errors.length ? <ul>{row.errors.map(message => <li key={message}>{message}</li>)}</ul> : "معتبر"}</td></tr>;
          })}</tbody>
        </table></div>
      </>}
      {result ? <p role="status" className="catalog-notice">{formatNumber(result.imported)} محصول ثبت شد و در فهرست محصولات قابل ویرایش است.</p>
        : <button className="button button--primary" type="submit" disabled={busy || reading || !canImport}>{busy ? "در حال ثبت…" : "بررسی و ثبت محصولات"}</button>}
    </form>
  </section>;
}
