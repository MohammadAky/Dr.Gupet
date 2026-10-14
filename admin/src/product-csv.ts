export const PRODUCT_CSV_COLUMNS = [
  "name", "price", "stock", "weightGram", "compareAtPrice", "sku", "slug",
  "ingredientsText", "description", "isActive",
] as const;
export const PRODUCT_CSV_MAX_ROWS = 100;
export const PRODUCT_CSV_MAX_BYTES = 1024 * 1024;
export const PRODUCT_IMPORT_MAX_BYTES = 90 * 1024;
const MAX_INTEGER = 2147483647;

export interface ProductImportRow {
  name: string;
  price: number;
  stock: number;
  weightGram: number;
  compareAtPrice: number;
  sku?: string;
  slug?: string;
  ingredientsText?: string;
  description?: string;
  isActive: boolean;
}
export interface CsvReviewRow {
  number: number;
  name: string;
  price: string;
  data?: ProductImportRow;
  errors: string[];
}
export interface ProductCsvReview {
  rows: CsvReviewRow[];
  errors: string[];
}

/** RFC 4180 records, including quoted newlines and doubled quotation marks. */
function records(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false, closed = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') { cell += '"'; index += 1; }
        else { quoted = false; closed = true; }
      } else cell += char;
    } else if (char === '"') {
      if (cell || closed) throw new Error("علامت نقل‌قول باید ابتدای خانهٔ CSV باشد.");
      quoted = true;
    } else if (char === ",") {
      row.push(cell); cell = ""; closed = false;
    } else if (char === "\n" || char === "\r") {
      row.push(cell); rows.push(row); row = []; cell = ""; closed = false;
      if (char === "\r" && text[index + 1] === "\n") index += 1;
    } else {
      if (closed) throw new Error("پس از بسته‌شدن نقل‌قول، فقط جداکننده یا پایان ردیف مجاز است.");
      cell += char;
    }
  }
  if (quoted) throw new Error("نقل‌قول فایل CSV بسته نشده است.");
  if (cell || row.length || closed) { row.push(cell); rows.push(row); }
  return rows;
}

export function csvInteger(value: string, required = false): number | null {
  const normalized = value.trim()
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 1632));
  if (!normalized) return required ? null : 0;
  let digits = normalized;
  if (!/^\d+$/.test(digits)) {
    const separator = digits.includes(",") ? "," : "٬";
    const groups = digits.split(separator);
    if (!/^\d{1,3}$/.test(groups[0] ?? "") || groups.length < 2 || groups.slice(1).some(group => !/^\d{3}$/.test(group))) return null;
    digits = groups.join("");
  }
  const result = Number(digits);
  return Number.isSafeInteger(result) && result >= 0 && result <= MAX_INTEGER ? result : null;
}

/** Match the server's Persian-aware slug normalization for preview collisions. */
export function importSlug(input: string): string {
  return input.replace(/ي/g, "ی").replace(/ك/g, "ک").replace(/[ەۀ]/g, "ه")
    .replace(/ؤ/g, "و").replace(/[إأآٱ]/g, "ا")
    .replace(/\u200c|\u200d|\u200e|\u200f|\u0640/g, "")
    .toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/[\s_]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export function reviewProductCsv(source: string): ProductCsvReview {
  if (new TextEncoder().encode(source).byteLength > PRODUCT_CSV_MAX_BYTES)
    return { rows: [], errors: ["حجم فایل باید حداکثر یک مگابایت باشد."] };
  let parsed: string[][];
  try { parsed = records(source.replace(/^\uFEFF/, "")); }
  catch (error) { return { rows: [], errors: [error instanceof Error ? error.message : "ساختار CSV معتبر نیست."] }; }
  if (!parsed.length) return { rows: [], errors: ["فایل CSV خالی است."] };
  const headers = parsed[0]!.map(value => value.trim());
  const errors: string[] = [];
  if (new Set(headers).size !== headers.length) errors.push("نام ستون‌های فایل نباید تکراری باشد.");
  if (!headers.includes("name") || !headers.includes("price")) errors.push("ستون‌های name و price الزامی هستند.");
  if (headers.some(header => !(PRODUCT_CSV_COLUMNS as readonly string[]).includes(header))) errors.push("نام ستون‌ها با قالب سازگار نیست؛ قالب CSV را دریافت کنید.");
  const dataRecords = parsed.slice(1).filter(row => row.some(cell => cell.trim()));
  if (!dataRecords.length) errors.push("فایل فقط سربرگ دارد؛ دست‌کم یک محصول وارد کنید.");
  if (dataRecords.length > PRODUCT_CSV_MAX_ROWS) errors.push("در هر فایل حداکثر ۱۰۰ محصول وارد کنید.");
  if (errors.length) return { rows: [], errors };
  const rows: CsvReviewRow[] = [];
  const slugs = new Map<string, CsvReviewRow>(), skus = new Map<string, CsvReviewRow>();
  parsed.slice(1).forEach((cells, index) => {
    if (!cells.some(cell => cell.trim())) return;
    const entry: CsvReviewRow = { number: index + 2, name: "", price: "", errors: [] };
    rows.push(entry);
    if (cells.length !== headers.length) { entry.errors.push("تعداد خانه‌ها با سربرگ برابر نیست."); return; }
    const values = Object.fromEntries(headers.map((header, column) => [header, cells[column]!.trim()]));
    const name = values.name ?? "", price = values.price ?? "";
    entry.name = name; entry.price = price;
    const normalizedName = name.replace(/ي/g, "ی").replace(/ك/g, "ک").replace(/\u200c|\u200d|\u200e|\u200f|\u0640/g, "").trim();
    if (normalizedName.length < 2) entry.errors.push("نام محصول باید دست‌کم ۲ نویسه باشد.");
    const textLimits = { name: 191, sku: 191, slug: 191, ingredientsText: 5000, description: 5000 };
    const textLabels = { name: "نام", sku: "شناسهٔ کالا", slug: "نشانی", ingredientsText: "ترکیبات", description: "توضیحات" };
    for (const key of Object.keys(textLimits) as Array<keyof typeof textLimits>) {
      if ((values[key] ?? "").length > textLimits[key]) entry.errors.push(`${textLabels[key]} باید حداکثر ${textLimits[key]} نویسه باشد.`);
    }
    const numeric = {} as Record<"price" | "stock" | "weightGram" | "compareAtPrice", number>;
    const labels = { price: "قیمت", stock: "موجودی", weightGram: "وزن", compareAtPrice: "قیمت پیش از تخفیف" };
    for (const key of Object.keys(labels) as Array<keyof typeof labels>) {
      const value = csvInteger(values[key] ?? "", key === "price");
      if (value === null) entry.errors.push(`${labels[key]} باید عدد صحیح بین ۰ و ۲٬۱۴۷٬۴۸۳٬۶۴۷ باشد${key === "price" ? " و خالی نباشد" : ""}.`);
      else numeric[key] = value;
    }
    const active = values.isActive ?? "";
    const activeValue = active.replace(/[۰٠]/g, "0").replace(/[۱١]/g, "1");
    if (!["", "0", "1"].includes(activeValue)) entry.errors.push("isActive فقط ۰ (پیش‌نویس) یا ۱ (فعال) باشد.");
    const isActive = activeValue === "1";
    if (isActive && numeric.weightGram === 0) entry.errors.push("محصول فعال باید وزن بیشتر از صفر داشته باشد.");
    const slug = importSlug(values.slug || name);
    if (!slug) entry.errors.push("نام یا slug برای ساخت نشانی محصول معتبر نیست.");
    const checkDuplicate = (key: string, seen: Map<string, CsvReviewRow>, label: string) => {
      if (!key) return;
      const previous = seen.get(key);
      if (previous) {
        entry.errors.push(`${label} با ردیف ${previous.number} تکراری است.`);
        if (!previous.errors.some(error => error.startsWith(`${label} تکراری`))) previous.errors.push(`${label} تکراری در همین فایل است.`);
        delete previous.data;
      } else seen.set(key, entry);
    };
    checkDuplicate(slug, slugs, "نشانی محصول");
    checkDuplicate((values.sku ?? "").toLowerCase(), skus, "SKU");
    if (!entry.errors.length) entry.data = {
      name, ...numeric, isActive,
      ...(values.sku ? { sku: values.sku } : {}),
      ...(values.slug ? { slug: values.slug } : {}),
      ...(values.ingredientsText ? { ingredientsText: values.ingredientsText } : {}),
      ...(values.description ? { description: values.description } : {}),
    };
  });
  return { rows, errors: [] };
}
