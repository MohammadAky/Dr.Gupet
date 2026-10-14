import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "./auth";
import type { CatalogReferences } from "./CatalogReferences";
import { confirmAction, errorMessage, formatMoney, formatNumber, markFormSaved } from "./management";
import { PRODUCT_CSV_MAX_BYTES, PRODUCT_IMPORT_MAX_BYTES, reviewProductCsv, type ProductCsvReview } from "./product-csv";
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
  const [review, setReview] = useState<ProductCsvReview | null>(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const pending = useRef(false), generation = useRef(0), mounted = useRef(true);
  const panel = useRef<HTMLElement>(null), form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    mounted.current = true; panel.current?.focus();
    return () => { mounted.current = false; generation.current += 1; };
  }, []);
  const categories = refs.categories.filter(category => category.isActive !== false && (!category.petTypeId || String(category.petTypeId) === petTypeId));
  const referencesValid = refs.brands.some(value => value.isActive !== false && String(value.id) === brandId)
    && refs.petTypes.some(value => value.isActive !== false && String(value.id) === petTypeId)
    && categories.some(value => String(value.id) === categoryId);
  const validCount = review?.rows.filter(row => row.data).length ?? 0;
  const body = { brandId: Number(brandId), categoryId: Number(categoryId), petTypeId: Number(petTypeId), rows: review?.rows.map(row => row.data!) ?? [] };
  const payloadTooLarge = new TextEncoder().encode(JSON.stringify(body)).byteLength > PRODUCT_IMPORT_MAX_BYTES;
  const canImport = !!review && !review.errors.length && review.rows.length > 0 && validCount === review.rows.length && referencesValid && !result && !payloadTooLarge;
  async function selectFile(file?: File) {
    if (pending.current) return;
    const version = ++generation.current;
    setReview(null); setResult(null); setError(""); setReading(false); setFileName(file?.name ?? "");
    if (!file) return;
    if (file.size > PRODUCT_CSV_MAX_BYTES) { setError("حجم فایل باید حداکثر یک مگابایت باشد."); return; }
    setReading(true);
    try {
      const source = await readFile(file);
      if (mounted.current && version === generation.current) setReview(reviewProductCsv(source));
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
      if (!await confirmAction(`${formatNumber(review.rows.length)} محصول با برند و دسته‌بندی انتخاب‌شده ثبت شود؟ فایل به‌صورت کامل ثبت می‌شود؛ محصول تکراری جایگزین نمی‌شود.`, "تأیید ورود محصولات")) return;
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
      <h2>قالب را تکمیل کنید</h2>
      <p>فقط ستون‌های <bdi>name</bdi> (نام) و <bdi>price</bdi> (قیمت به تومان) الزامی‌اند. قیمت صفر پذیرفته می‌شود. حداکثر ۱۰۰ محصول و یک مگابایت در هر فایل.</p>
      <p>ستون‌های اختیاری: <bdi>stock</bdi> موجودی، <bdi>weightGram</bdi> وزن به گرم، <bdi>compareAtPrice</bdi> قیمت پیش از تخفیف، <bdi>sku</bdi> شناسهٔ کالا، <bdi>slug</bdi> نشانی، <bdi>ingredientsText</bdi> ترکیبات، <bdi>description</bdi> توضیح کامل و <bdi>isActive</bdi> وضعیت.</p>
      <p>عددهای اختیاری خالی، صفر و متن‌های خالی، بدون مقدار ثبت می‌شوند. شناسه و نشانی خالی را سرور می‌سازد. وضعیت خالی یا ۰ یعنی پیش‌نویس؛ ۱ یعنی فعال و به وزن بیشتر از صفر نیاز دارد.</p>
      <p>فایل را با فرمت CSV UTF-8 ذخیره کنید. قیمت و عددها صحیح‌اند؛ برای عدد جداشده با ویرگول یا متن چندخطی، خانه را داخل نقل‌قول قرار دهید. محصولات دارای نشانی یا شناسهٔ تکراری جایگزین نمی‌شوند.</p>
      <a className="button button--ghost" href={`data:text/csv;charset=utf-8,${encodeURIComponent("\uFEFF" + csvTemplate.replace(/^\uFEFF/, ""))}`} download="product-import-template.csv">دریافت قالب CSV</a>
    </div>
    <form ref={form} data-draft-editor className="catalog-panel csv-import-form" onSubmit={event => void submit(event)}>
      <h2>مشخصات مشترک محصولات</h2>
      <fieldset disabled={busy || !!result} className="csv-import-fields">
        <label>نوع حیوان<select required value={petTypeId} onChange={event => { setPetTypeId(event.target.value); setCategoryId(""); }}><option value="">انتخاب کنید</option>{refs.petTypes.filter(value => value.isActive !== false).map(value => <option key={value.id} value={value.id}>{value.name}</option>)}</select></label>
        <label>برند<select required value={brandId} onChange={event => setBrandId(event.target.value)}><option value="">انتخاب کنید</option>{refs.brands.filter(value => value.isActive !== false).map(value => <option key={value.id} value={value.id}>{value.name}</option>)}</select></label>
        <label>دسته‌بندی<select required value={categoryId} onChange={event => setCategoryId(event.target.value)}><option value="">انتخاب کنید</option>{categories.map(value => <option key={value.id} value={value.id}>{value.name}</option>)}</select></label>
        <label className="csv-import-file">فایل محصولات<input type="file" accept=".csv,text/csv" onChange={event => void selectFile(event.target.files?.[0])} /></label>
      </fieldset>
      {fileName && <p>فایل انتخاب‌شده: <bdi>{fileName}</bdi></p>}
      {reading && <p role="status">در حال بررسی فایل…</p>}
      {error && <p className="catalog-notice catalog-notice--warning" role="alert">{error}</p>}
      {review?.errors.map(message => <p key={message} role="alert" className="catalog-notice catalog-notice--warning">{message}</p>)}
      {payloadTooLarge && <p role="alert" className="catalog-notice catalog-notice--warning">حجم اطلاعات محصولات برای یک درخواست زیاد است؛ فایل را به چند فایل کوچک‌تر تقسیم کنید یا توضیحات را کوتاه کنید.</p>}
      {review && review.rows.length > 0 && <>
        <h2>پیش‌نمایش محصولات</h2><p role="status">{formatNumber(validCount)} ردیف معتبر از {formatNumber(review.rows.length)} ردیف. {validCount !== review.rows.length ? "خطاها را در فایل اصلاح و دوباره انتخاب کنید؛ تا آن زمان چیزی ثبت نمی‌شود." : "فایل آمادهٔ ثبت است."}</p>
        <div className="csv-import-table"><table><caption className="csv-import-caption">بررسی ردیف‌های فایل</caption><thead><tr><th scope="col">ردیف CSV</th><th scope="col">نام محصول</th><th scope="col">قیمت</th><th scope="col">قیمت پیش از تخفیف</th><th scope="col">موجودی</th><th scope="col">وزن</th><th scope="col">وضعیت</th><th scope="col">شناسه و توضیحات</th><th scope="col">نتیجهٔ بررسی</th></tr></thead>
          <tbody>{review.rows.map(row => <tr key={row.number}><th scope="row">{formatNumber(row.number)}</th><td>{row.name || "—"}</td><td>{row.data ? formatMoney(row.data.price) : <bdi>{row.price || "—"}</bdi>}</td><td>{row.data ? formatMoney(row.data.compareAtPrice) : "—"}</td><td>{row.data ? formatNumber(row.data.stock) : "—"}</td><td>{row.data ? `${formatNumber(row.data.weightGram)} گرم` : "—"}</td><td>{row.data ? (row.data.isActive ? "فعال" : "پیش‌نویس") : "—"}</td><td>{row.data && <details><summary>جزئیات ردیف {formatNumber(row.number)}</summary><dl><dt>SKU</dt><dd><bdi>{row.data.sku || "ساخت خودکار"}</bdi></dd><dt>نشانی</dt><dd><bdi>{row.data.slug || "ساخت خودکار"}</bdi></dd><dt>ترکیبات</dt><dd>{row.data.ingredientsText || "—"}</dd><dt>توضیحات</dt><dd>{row.data.description || "—"}</dd></dl></details>}</td><td>{row.errors.length ? <ul>{row.errors.map(message => <li key={message}>{message}</li>)}</ul> : "معتبر"}</td></tr>)}</tbody>
        </table></div>
      </>}
      {result ? <p role="status" className="catalog-notice">{formatNumber(result.imported)} محصول ثبت شد و در فهرست محصولات قابل ویرایش است.</p>
        : <button className="button button--primary" type="submit" disabled={busy || reading || !canImport}>{busy ? "در حال ثبت…" : "بررسی و ثبت محصولات"}</button>}
    </form>
  </section>;
}
