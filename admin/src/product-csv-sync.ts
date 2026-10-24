import { csvInteger, parseCsvRecords } from "./product-csv";

export const SYNC_MAX_ROWS = 500;
export const SYNC_MAX_FILE_BYTES = 1024 * 1024;
export const SYNC_MAX_JSON_BYTES = 900 * 1024;
export const CSV_ENCODING = "drgupet-text-v1";
export const EXPORT_COLUMNS = ["productId", "variantId", "sku", "name", "slug", "brandId", "categoryId", "petTypeId", "price", "stock", "weightGram", "compareAtPrice", "isActive", "ingredientsText", "description", "expectedStock", "expectedUpdatedAt"] as const;
export type ExportColumn = typeof EXPORT_COLUMNS[number];
export const ROUNDTRIP_COLUMNS: ExportColumn[] = ["productId", "variantId", "sku", "stock", "expectedStock", "expectedUpdatedAt"];
/**
 * «فایل قیمت»: نسخهٔ سبک خروجی برای تغییر گروهی قیمت — بدون ستون موجودی و بدون
 * ستون نسخه، چون همان دو ستون باعث می‌شد یک تغییر سادهٔ قیمت به تضاد بخورد.
 * اگر همهٔ ستون‌های یک فایل از این مجموعه باشند، فایل «قیمت‌محور» شناخته می‌شود.
 */
export const PRICE_FILE_COLUMNS = ["sku", "variantId", "name", "price", "compareAtPrice"] as const;
export const PRICE_FILE_EXPORT_COLUMNS: ExportColumn[] = ["sku", "name", "price", "compareAtPrice"];
export const COLUMN_LABELS: Record<string, string> = {
  productId: "شناسهٔ محصول", variantId: "شناسهٔ گزینه", sku: "شناسهٔ کالا (SKU)", name: "نام محصول", slug: "نامک",
  brandId: "شناسهٔ برند", categoryId: "شناسهٔ دسته‌بندی", petTypeId: "شناسهٔ نوع حیوان", brandName: "نام برند", categoryName: "نام دسته‌بندی",
  price: "قیمت (تومان)", stock: "موجودی", weightGram: "وزن (گرم)", compareAtPrice: "قیمت پیش از تخفیف (تومان)",
  isActive: "انتشار محصول", ingredientsText: "ترکیبات", description: "توضیحات", expectedStock: "موجودی هنگام خروجی", expectedUpdatedAt: "زمان نسخهٔ محصول",
};
const TEXT_COLUMNS = ["sku", "name", "slug", "brandName", "categoryName", "ingredientsText", "description"] as const;
const ID_COLUMNS = ["productId", "variantId", "brandId", "categoryId", "petTypeId"] as const;
const NUMBER_COLUMNS = ["price", "stock", "weightGram", "compareAtPrice", "expectedStock"] as const;
const ALLOWED = new Set<string>([...EXPORT_COLUMNS, "brandName", "categoryName"]);
const aliases: Record<string, string> = { "نمایش": "isActive", brand: "brandName", category: "categoryName", "برند": "brandName", "دسته‌بندی": "categoryName", "دسته بندی": "categoryName" };
export type SyncInput = Partial<Record<typeof TEXT_COLUMNS[number] | "expectedUpdatedAt", string>> & Partial<Record<typeof ID_COLUMNS[number] | typeof NUMBER_COLUMNS[number], number>> & { isActive?: boolean };
export type SyncTotals = { created: number; updated: number; unchanged: number; variantsAdded: number };
export type SyncAction = "create" | "update" | "unchanged" | "add-variant";
export type SyncPreviewRow = { line: number; action: SyncAction; data: SyncInput; changes: Array<{ field: string; before: unknown; after: unknown }> };
export type SyncNote = { line: number; productId?: number; product?: string; variant?: string | null; field: string; message: string };
export type SyncPreview = { rows: SyncPreviewRow[]; totals: SyncTotals; notes?: SyncNote[] };
export type ParsedSyncRow = { line: number; data: SyncInput; errors: string[]; reference?: string };
export type ParsedSyncCsv = { rows: ParsedSyncRow[]; errors: string[]; priceFile?: boolean; ignored?: number };
export const syncJsonTooLarge = (rows: SyncInput[]) => new TextEncoder().encode(JSON.stringify({ rows })).byteLength > SYNC_MAX_JSON_BYTES;

/** Partial rows deliberately preserve absent/blank values. Only the server resolves targets. */
export function parseProductSyncCsv(source: string): ParsedSyncCsv {
  const fail = (message: string): ParsedSyncCsv => ({ rows: [], errors: [message] });
  if (new TextEncoder().encode(source).byteLength > SYNC_MAX_FILE_BYTES) return fail("حجم فایل باید حداکثر یک مگابایت باشد.");
  let records: string[][];
  try { records = parseCsvRecords(source.replace(/^\uFEFF/, "")); }
  catch (problem) { return fail(problem instanceof Error ? problem.message : "ساختار CSV معتبر نیست."); }
  if (!records.length) return fail("فایل CSV خالی است.");
  const headers = records[0]!.map(header => aliases[header.trim()] ?? header.trim());
  if (new Set(headers).size !== headers.length) return fail("ستون‌های فایل تکراری هستند.");
  if (headers.some(header => !ALLOWED.has(header) && header !== "csvEncoding")) return fail("ستون ناشناخته در فایل وجود دارد.");
  if (!headers.some(header => ALLOWED.has(header))) return fail("فایل ستون محصول ندارد.");
  // A file whose every column belongs to the short price set is a price file: the
  // `name` column is then a human label only and never becomes a product rename.
  const contentHeaders = headers.filter(header => header !== "csvEncoding");
  const priceFile = contentHeaders.length > 0 && contentHeaders.every(header => (PRICE_FILE_COLUMNS as readonly string[]).includes(header));
  const recordsWithValues = records.slice(1).filter(row => row.some(value => value.trim()));
  if (!recordsWithValues.length) return fail("فایل ردیف محصول ندارد.");
  if (recordsWithValues.length > SYNC_MAX_ROWS) return fail("در هر فایل حداکثر ۵۰۰ ردیف وارد کنید.");
  const rows: ParsedSyncRow[] = [];
  let ignored = 0;
  recordsWithValues.forEach((cells, index) => {
    const line = index + 2;
    const errors: string[] = [], data: SyncInput = {};
    if (cells.length !== headers.length) {
      rows.push({ line, data, errors: ["تعداد خانه‌ها با سربرگ برابر نیست."] });
      return;
    }
    const values = Object.fromEntries(headers.map((header, column) => [header, cells[column]!]));
    const encoded = headers.includes("csvEncoding");
    if (encoded && values.csvEncoding !== CSV_ENCODING) errors.push("نسخهٔ کدگذاری فایل معتبر نیست.");
    let reference: string | undefined;
    for (const key of TEXT_COLUMNS) {
      let value = values[key];
      if (value === undefined) continue;
      // This reversal belongs only to our explicitly marked export, never arbitrary source CSV.
      if (encoded && values.csvEncoding === CSV_ENCODING && value.startsWith("'")) value = value.slice(1);
      value = value.trim();
      if (!value) continue;
      // In a price file the product name is a label for the person editing the file.
      if (priceFile && key === "name") { reference = value; continue; }
      if (value === "__CLEAR__" && key !== "ingredientsText" && key !== "description") errors.push(`${COLUMN_LABELS[key]} قابل پاک‌کردن نیست.`);
      const maximum = key === "ingredientsText" || key === "description" ? 5000 : 191;
      if (value.length > maximum || (key === "name" && value.length < 2)) errors.push(`${COLUMN_LABELS[key]} طول معتبر ندارد.`);
      data[key] = value;
    }
    for (const key of [...ID_COLUMNS, ...NUMBER_COLUMNS]) {
      const raw = values[key]?.trim();
      if (!raw) continue;
      const value = csvInteger(raw, true);
      if (value === null || (ID_COLUMNS.includes(key as typeof ID_COLUMNS[number]) && value < 1)) errors.push(`${COLUMN_LABELS[key]} باید عدد صحیح ${ID_COLUMNS.includes(key as typeof ID_COLUMNS[number]) ? "مثبت" : "نامنفی"} باشد.`);
      else data[key] = value;
    }
    const active = values.isActive?.trim().replace(/[۰٠]/g, "0").replace(/[۱١]/g, "1").toLowerCase();
    if (active) {
      if (!["t", "f", "true", "false", "1", "0"].includes(active)) errors.push("انتشار محصول باید T یا F باشد.");
      else data.isActive = ["t", "true", "1"].includes(active);
    }
    if (values.expectedUpdatedAt?.trim()) {
      const value = values.expectedUpdatedAt.trim();
      // The export always writes an ISO timestamp with a UTC marker. Spreadsheets that
      // parse the cell rewrite it as local time, which would silently become a stale
      // snapshot, so the file is rejected with an actionable message instead.
      if (!/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value)) || !/(Z|[+-]\d{2}:?\d{2})$/.test(value))
        errors.push("زمان نسخهٔ محصول معتبر نیست یا هنگام ذخیره در Excel/LibreOffice تغییر کرده است؛ این ستون را ویرایش نکنید و خروجی تازه بگیرید.");
      else data.expectedUpdatedAt = value;
    }
    if (priceFile) {
      const identity = data.sku !== undefined || data.variantId !== undefined;
      const priced = data.price !== undefined || data.compareAtPrice !== undefined;
      // An exported product without any variant has no identity and no price; it
      // cannot be priced from a file, so it is skipped instead of blocking the rest.
      if (!identity && !priced && !errors.length) { ignored += 1; return; }
      if (!identity) errors.push("هر ردیف قیمت باید «sku» یا «variantId» داشته باشد.");
      if (!priced) errors.push("قیمتی وارد نشده است؛ دست‌کم یکی از ستون‌های قیمت را پر کنید.");
    } else if (!Object.keys(data).length) errors.push("ردیف مقدار قابل بررسی ندارد.");
    rows.push({ line, data, errors, ...(reference ? { reference } : {}) });
  });
  const errors = syncJsonTooLarge(rows.map(row => row.data)) ? ["حجم اطلاعات زیاد است؛ فایل را کوچک‌تر کنید."] : [];
  return { rows, errors, priceFile, ignored };
}

export function isSyncTotals(value: unknown): value is SyncTotals {
  if (!value || typeof value !== "object") return false;
  return ["created", "updated", "unchanged", "variantsAdded"].every(key => {
    const count = (value as Record<string, unknown>)[key];
    return typeof count === "number" && Number.isSafeInteger(count) && count >= 0;
  });
}
export function isSyncNotes(value: unknown): value is SyncNote[] {
  if (!Array.isArray(value) || value.length > SYNC_MAX_ROWS) return false;
  return value.every(note => !!note && typeof note === "object" && Number.isSafeInteger((note as SyncNote).line) &&
    typeof (note as SyncNote).field === "string" && typeof (note as SyncNote).message === "string");
}
export function validSyncPreview(value: unknown, count: number): value is SyncPreview {
  if (!value || typeof value !== "object") return false;
  const result = value as SyncPreview;
  if (!Array.isArray(result.rows) || result.rows.length !== count || !isSyncTotals(result.totals)) return false;
  if (result.notes !== undefined && !isSyncNotes(result.notes)) return false;
  const tally: SyncTotals = { created: 0, updated: 0, unchanged: 0, variantsAdded: 0 };
  const counters = { create: "created", update: "updated", unchanged: "unchanged", "add-variant": "variantsAdded" } as const;
  for (const row of result.rows) {
    if (!row || !Object.hasOwn(counters, row.action) || !Number.isSafeInteger(row.line) || row.line < 2 || !row.data || typeof row.data !== "object" || Array.isArray(row.data) || Object.keys(row.data).some(key => !ALLOWED.has(key)) || !Array.isArray(row.changes)) return false;
    if (row.changes.some(change => !change || !ALLOWED.has(change.field))) return false;
    tally[counters[row.action]] += 1;
  }
  return Object.keys(tally).every(key => tally[key as keyof SyncTotals] === result.totals[key as keyof SyncTotals]);
}

export interface ProductExportFilters { search?: string; isActive?: boolean; brandId?: number; categoryId?: number; petTypeId?: number }
export function productExportPath(filters: ProductExportFilters, columns: ExportColumn[]): string {
  const params = new URLSearchParams({ columns: EXPORT_COLUMNS.filter(column => columns.includes(column)).join(",") });
  for (const key of ["search", "isActive", "brandId", "categoryId", "petTypeId"] as const) if (filters[key] !== undefined && filters[key] !== "") params.set(key, String(filters[key]));
  return `/admin/products/export.csv?${params}`;
}

/**
 * A price file is not a creation file: when an SKU is unknown the server answers with
 * the create-row requirement, which reads like nonsense on a price screen. Translate
 * it and name the row/SKU that stopped the (all-or-nothing) batch.
 */
export function syncErrorMessage(message: string, sent: Array<{ sku?: string; name?: string }> = []): string {
  const line = lineFromMessage(message);
  const row = line === null ? undefined : sent[line - 2];
  const where = line === null ? "" : row?.sku
    ? ` (ردیف ${formatFa(line)}، SKU «${row.sku}»)`
    : row?.name
      ? ` (ردیف ${formatFa(line)}، «${row.name}»)`
      : ` (ردیف ${formatFa(line)})`;
  if (/محصول جدید به نام/.test(message))
    return `این SKU در کاتالوگ پیدا نشد${where}. افزودن محصول تازه از مسیر «افزودن محصول از CSV» انجام می‌شود؛ ردیف مربوط را حذف یا SKU را اصلاح کنید.`;
  return where && (row?.sku || row?.name) ? `${message}${where}` : message;
}

/** Row number from a server message, accepting Persian or Latin digits. */
export function lineFromMessage(message: string): number | null {
  const match = /ردیف\s+([0-9\u06F0-\u06F9]+)/.exec(message);
  if (!match) return null;
  const value = Number(match[1]!.replace(/[\u06F0-\u06F9]/g, digit => String(digit.charCodeAt(0) - 1776)));
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

const formatFa = (value: number) => value.toLocaleString("fa-IR", { useGrouping: false });
