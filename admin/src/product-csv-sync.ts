import { csvInteger, parseCsvRecords } from "./product-csv";

export const SYNC_MAX_ROWS = 500;
export const SYNC_MAX_FILE_BYTES = 1024 * 1024;
export const SYNC_MAX_JSON_BYTES = 900 * 1024;
export const CSV_ENCODING = "drgupet-text-v1";
export const EXPORT_COLUMNS = ["productId", "variantId", "sku", "name", "slug", "brandId", "categoryId", "petTypeId", "price", "stock", "weightGram", "compareAtPrice", "isActive", "ingredientsText", "description", "expectedStock", "expectedUpdatedAt"] as const;
export type ExportColumn = typeof EXPORT_COLUMNS[number];
export const ROUNDTRIP_COLUMNS: ExportColumn[] = ["productId", "variantId", "sku", "stock", "expectedStock", "expectedUpdatedAt"];
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
export type SyncPreview = { rows: SyncPreviewRow[]; totals: SyncTotals };
export type ParsedSyncRow = { line: number; data: SyncInput; errors: string[] };
export type ParsedSyncCsv = { rows: ParsedSyncRow[]; errors: string[] };
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
  const recordsWithValues = records.slice(1).filter(row => row.some(value => value.trim()));
  if (!recordsWithValues.length) return fail("فایل ردیف محصول ندارد.");
  if (recordsWithValues.length > SYNC_MAX_ROWS) return fail("در هر فایل حداکثر ۵۰۰ ردیف وارد کنید.");
  const rows = recordsWithValues.map((cells, index): ParsedSyncRow => {
    const errors: string[] = [], data: SyncInput = {};
    if (cells.length !== headers.length) return { line: index + 2, data, errors: ["تعداد خانه‌ها با سربرگ برابر نیست."] };
    const values = Object.fromEntries(headers.map((header, column) => [header, cells[column]!]));
    const encoded = headers.includes("csvEncoding");
    if (encoded && values.csvEncoding !== CSV_ENCODING) errors.push("نسخهٔ کدگذاری فایل معتبر نیست.");
    for (const key of TEXT_COLUMNS) {
      let value = values[key];
      if (value === undefined) continue;
      // This reversal belongs only to our explicitly marked export, never arbitrary source CSV.
      if (encoded && values.csvEncoding === CSV_ENCODING && value.startsWith("'")) value = value.slice(1);
      value = value.trim();
      if (!value) continue;
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
      if (!/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value))) errors.push("زمان نسخهٔ محصول معتبر نیست.");
      else data.expectedUpdatedAt = value;
    }
    if (!Object.keys(data).length) errors.push("ردیف مقدار قابل بررسی ندارد.");
    return { line: index + 2, data, errors };
  });
  const errors = syncJsonTooLarge(rows.map(row => row.data)) ? ["حجم اطلاعات زیاد است؛ فایل را کوچک‌تر کنید."] : [];
  return { rows, errors };
}

export function isSyncTotals(value: unknown): value is SyncTotals {
  if (!value || typeof value !== "object") return false;
  return ["created", "updated", "unchanged", "variantsAdded"].every(key => {
    const count = (value as Record<string, unknown>)[key];
    return typeof count === "number" && Number.isSafeInteger(count) && count >= 0;
  });
}
export function validSyncPreview(value: unknown, count: number): value is SyncPreview {
  if (!value || typeof value !== "object") return false;
  const result = value as SyncPreview;
  if (!Array.isArray(result.rows) || result.rows.length !== count || !isSyncTotals(result.totals)) return false;
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
