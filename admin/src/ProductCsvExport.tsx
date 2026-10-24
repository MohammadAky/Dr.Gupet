import { useEffect, useRef, useState } from "react";
import { useAuth } from "./auth";
import { errorMessage } from "./management";
import { COLUMN_LABELS, EXPORT_COLUMNS, PRICE_FILE_EXPORT_COLUMNS, productExportPath, ROUNDTRIP_COLUMNS, type ExportColumn, type ProductExportFilters } from "./product-csv-sync";
import "./product-csv-sync.css";

export function ProductCsvExport({ filters, onBack }: { filters: ProductExportFilters; onBack(): void }) {
  const { download } = useAuth();
  const mounted = useRef(true), pending = useRef(false), all = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const files = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  // Price is the most frequent bulk edit, so it starts selected next to the locked
  // round-trip columns instead of forcing every owner to find it in the list.
  const [columns, setColumns] = useState<ExportColumn[]>([...new Set<ExportColumn>([...ROUNDTRIP_COLUMNS, "price"])]);
  const [roundtrip, setRoundtrip] = useState(true);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    mounted.current = true; heading.current?.focus();
    const currentFiles = files.current;
    return () => { mounted.current = false; currentFiles.forEach((timer, url) => { clearTimeout(timer); URL.revokeObjectURL(url); }); currentFiles.clear(); };
  }, []);
  useEffect(() => { if (all.current) all.current.indeterminate = columns.length > 0 && columns.length < EXPORT_COLUMNS.length; }, [columns]);
  function toggle(column: ExportColumn) {
    if (busy || (roundtrip && ROUNDTRIP_COLUMNS.includes(column))) return;
    setColumns(current => current.includes(column) ? current.filter(value => value !== column) : [...current, column]);
  }
  async function exportFile(selected: ExportColumn[] = columns, filename = "dr-gupet-products.csv") {
    if (pending.current || !selected.length) return;
    pending.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const blob = await download(productExportPath(filters, selected), { timeoutMs: 70_000 });
      if (!mounted.current) return;
      const url = URL.createObjectURL(blob);
      const timer = setTimeout(() => { URL.revokeObjectURL(url); files.current.delete(url); }, 10000);
      files.current.set(url, timer);
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename;
      try { document.body.append(anchor); anchor.click(); } finally { anchor.remove(); }
      setNotice("فایل خروجی آماده شد.");
    } catch (problem) { if (mounted.current) setError(errorMessage(problem)); }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  }
  return <section className="csv-sync-page" aria-labelledby="csv-export-heading">
    <header className="csv-sync-heading"><div><span className="eyebrow">کاتالوگ / CSV</span><h1 id="csv-export-heading" ref={heading} tabIndex={-1}>خروجی محصولات</h1></div>
      <button type="button" className="button button--ghost" onClick={onBack}>بازگشت به محصولات</button></header>
    <div className="catalog-panel csv-export-options" aria-busy={busy}>
      <p>همهٔ نتایج فیلتر جاری، با یک ردیف برای هر گزینهٔ محصول صادر می‌شوند. حداکثر ۵۰۰ ردیف؛ برای خروجی بزرگ‌تر، فیلتر را محدود کنید.</p>
      <p>برای تغییر گروهی <bdi>قیمت</bdi>، از «فایل قیمت» استفاده کنید: فقط <bdi>sku</bdi>، نام، قیمت و قیمت پیش از تخفیف را می‌دهد؛ بدون موجودی و بدون ستون نسخه، پس ویرایش قیمت به تضاد نمی‌خورد. همین فایل را می‌توانید بی‌تغییر در صفحهٔ «ویرایش با CSV» بگذارید.</p>
      <p className="csv-export-filter">{filters.search ? `جستجو: ${filters.search} · ` : ""}{filters.isActive === undefined ? "همهٔ وضعیت‌ها" : filters.isActive ? "فعال" : "پیش‌نویس"}</p>
      <label className="csv-export-check"><input type="checkbox" checked={roundtrip} disabled={busy} onChange={event => {
        setRoundtrip(event.target.checked);
        if (event.target.checked) setColumns(current => [...new Set([...current, ...ROUNDTRIP_COLUMNS])]);
      }} />حفظ شناسه‌ها و نسخه برای ورود مجدد</label>
      {!roundtrip && <p>برای ویرایش دوباره، شناسهٔ محصول و گزینه یا SKU را نگه دارید.</p>}
      <fieldset disabled={busy}><legend>ستون‌های خروجی</legend>
        <label className="csv-export-check"><input ref={all} type="checkbox" checked={columns.length === EXPORT_COLUMNS.length} onChange={event => setColumns(event.target.checked ? [...EXPORT_COLUMNS] : roundtrip ? [...ROUNDTRIP_COLUMNS] : [])} />همهٔ ستون‌ها</label>
        <div className="csv-export-columns">{EXPORT_COLUMNS.map(column => <label className="csv-export-check" key={column}><input type="checkbox" checked={columns.includes(column)} disabled={busy || (roundtrip && ROUNDTRIP_COLUMNS.includes(column))} onChange={() => toggle(column)} />{COLUMN_LABELS[column]}</label>)}</div>
      </fieldset>
      {error && <p className="catalog-notice catalog-notice--warning" role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <div className="csv-export-actions">
        <button type="button" className="button button--primary" disabled={busy || !columns.length} onClick={() => void exportFile()}>{busy ? "در حال دریافت…" : "دریافت CSV"}</button>
        <button type="button" className="button button--outline" disabled={busy} onClick={() => void exportFile([...PRICE_FILE_EXPORT_COLUMNS], "dr-gupet-prices.csv")}>دریافت فایل قیمت</button>
      </div>
    </div>
  </section>;
}
