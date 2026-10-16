import type { CatalogReferences } from "./CatalogReferences";
import { csvInteger, type CsvReviewRow, type ProductImportRow } from "./product-csv";

export interface ImportDefaults { brandId: string; categoryId: string; petTypeId: string }
export const referenceName = (value: string) => value.replace(/ي/g, "ی").replace(/ك/g, "ک").replace(/\u200c|\u200d|\u200e|\u200f|\u0640/g, "").trim();
const comparable = (value: string) => referenceName(value).toLowerCase();
const referenceId = (value: string) => value ? String(csvInteger(value, true) ?? value) : "";
const brands: Array<[string, RegExp]> = [
  ["رویال کنین", /رویال\s*کنین|\broyal\s*canin\b/i], ["جوسرا", /جوسرا|\bjosera\b/i],
  ["مونلو", /مونلو|\bmonello\b/i], ["بیفار", /بیفار|\bbeaphar\b/i],
  ["ونپی", /ونپی|\bwanpy\b/i], ["فنبی", /فنبی|\bfanbi\b/i],
  ["فیلیکس", /فیلیکس|\bfelix\b/i], ["وینستون", /وینستون|\bwinston\b/i],
  ["کوکوپت", /کوکوپت|\bcocopet\b/i], ["یوس‌پت", /یوس\s*پت|یوسپت|\buspet\b/i],
  ["مانچی", /مانچی|\bmunchy\b/i], ["بی‌تی‌آی", /بی\s*تی\s*آی|بیتیآی|\bbta\b/i],
  ["شاتوت", /شاتوت/],
];
const categories: Array<[string, RegExp]> = [
  ["غذای خشک", /غذای\s*خشک|\bdry\s*(?:food|feed)\b/i],
  ["غذای تر", /کنسرو|پوچ|\bwet\s*food\b|\bpouch\b/i],
  ["مکمل", /مولتی|مینرال|مکمل|مالت|پنتامیکس/],
  ["تشویقی", /تشویقی|بستنی/], ["خاک و بستر", /خاک\s*بستر/],
  ["گردنبند محافظ", /گردنبند\s*محافظ|الیزابت/], ["پد آموزشی", /پد\s*(?:جاذب|آموزشی)/],
  ["پاپوش", /پاپوش/], ["دستکش پرزگیر", /دستکش\s*پرزگیر/],
];
const species: Array<[string, RegExp]> = [
  ["cat", /گربه|\bcats?\b|\bkitten\b/i],
  ["dog", /سگ|\bdogs?\b|\bpuppy\b/i],
  ["bird", /پرنده|پرندگان|\bbirds?\b/i],
];
function speciesId(kind: string, refs: CatalogReferences) {
  const expression = species.find(([key]) => key === kind)?.[1];
  const matches = refs.petTypes.filter(row => row.isActive !== false && expression?.test(comparable(row.name)));
  return matches.length === 1 ? String(matches[0]!.id) : "";
}

/** Suggestions are editable candidates, never inferred prices, weights or publication. */
export function suggestCsvReferences(row: CsvReviewRow, refs: CatalogReferences): Record<string, string> {
  const values = row.values;
  if (!values) return {};
  const text = comparable(`${values.name ?? ""} ${values.description ?? ""}`);
  const patch: Record<string, string> = {};
  if (!values.brandId && !values.brandName) {
    const matches = brands.filter(([, pattern]) => pattern.test(text));
    if (matches.length === 1) {
      const existing = refs.brands.filter(item => matches[0]![1].test(comparable(item.name)));
      if (existing.length === 1) patch.brandId = String(existing[0]!.id);
      else if (!existing.length) patch.brandName = matches[0]![0];
    }
  }
  if (!values.categoryId && !values.categoryName) {
    // First explicit product-kind rule wins; e.g. a malt supplement is not dry food.
    const match = categories.find(([, pattern]) => pattern.test(text));
    if (match) patch.categoryName = match[0];
  }
  if (!values.petTypeId && !values.petType) {
    const matches = species.filter(([, pattern]) => pattern.test(text));
    if (matches.length === 1) {
      const id = speciesId(matches[0]![0], refs);
      if (id) patch.petTypeId = id;
    }
  }
  return patch;
}

export interface ResolvedCsvRow extends CsvReviewRow {
  brandLabel: string;
  categoryLabel: string;
  petTypeValue: string;
  brandStatus: string;
  categoryStatus: string;
}
export function resolveCsvReferences(row: CsvReviewRow, refs: CatalogReferences, defaults: ImportDefaults): ResolvedCsvRow {
  const values = row.values ?? {};
  const errors = [...row.errors];
  const fields: Partial<ProductImportRow> = {};
  const text = comparable(`${values.name ?? ""} ${values.description ?? ""}`);
  const ambiguousSpecies = !values.petTypeId && !values.petType && species.filter(([, pattern]) => pattern.test(text)).length > 1;
  let petTypeValue = referenceId(values.petTypeId ?? "");
  if (!petTypeValue && values.petType) {
    const token = comparable(referenceId(values.petType));
    const mappedId = speciesId(token, refs);
    const matches = refs.petTypes.filter(item => item.isActive !== false && [String(item.id), comparable(item.name)].includes(token));
    if (!matches.length && mappedId) petTypeValue = mappedId;
    else if (matches.length === 1) petTypeValue = String(matches[0]!.id);
    else errors.push("نوع حیوان فایل مشخص نیست؛ انتخاب کنید.");
  }
  if (!ambiguousSpecies) petTypeValue ||= defaults.petTypeId;
  else errors.push("چند نوع حیوان در متن آمده؛ نوع حیوان ردیف را انتخاب کنید.");
  const pet = refs.petTypes.find(item => item.isActive !== false && String(item.id) === petTypeValue);
  if (!pet) errors.push("نوع حیوان را انتخاب کنید.");
  else if (petTypeValue !== defaults.petTypeId) fields.petTypeId = pet.id;

  function resolve(kind: "brand" | "category") {
    const idKey = kind === "brand" ? "brandId" : "categoryId";
    const nameKey = kind === "brand" ? "brandName" : "categoryName";
    const label = kind === "brand" ? "برند" : "دسته‌بندی";
    const all = kind === "brand" ? refs.brands : refs.categories;
    const candidates = all.filter(item => kind === "brand" || !item.petTypeId || String(item.petTypeId) === petTypeValue);
    const explicitName = referenceName(values[nameKey] ?? "");
    const id = referenceId(values[idKey] ?? "") || (!explicitName ? defaults[idKey] : "");
    if (id) {
      const match = candidates.find(item => String(item.id) === id);
      if (!match || match.isActive === false) errors.push(`${label} ثبت‌شده و فعال انتخاب کنید.`);
      else if (id !== defaults[idKey]) fields[idKey] = match.id;
      return { label: all.find(item => String(item.id) === id)?.name ?? id, status: match && match.isActive !== false ? "موجود" : "نیاز به اصلاح" };
    }
    if (!explicitName) { errors.push(`${label} را وارد یا انتخاب کنید.`); return { label: "", status: "نیاز به انتخاب" }; }
    const matches = candidates.filter(item => referenceName(item.name) === explicitName);
    if (matches.length > 1 || matches.some(item => item.isActive === false)) {
      errors.push(`${label} هم‌نام یا غیرفعال است؛ مرجع دیگری انتخاب کنید.`);
      return { label: explicitName, status: "نیاز به اصلاح" };
    }
    if (matches.length === 1) {
      if (String(matches[0]!.id) !== defaults[idKey]) fields[idKey] = matches[0]!.id;
      return { label: explicitName, status: "موجود" };
    }
    if (explicitName.length > 191) errors.push(`${label} باید حداکثر ۱۹۱ نویسه باشد.`);
    fields[nameKey] = explicitName;
    return { label: explicitName, status: "جدید؛ هنگام ثبت ساخته می‌شود" };
  }
  const brand = resolve("brand"), category = resolve("category");
  let data: ProductImportRow | undefined;
  if (row.data && !errors.length) {
    // Never send a name and ID for the same reference. Matching fallback IDs may
    // be omitted; differing row assignments always override the shared fallback.
    const { brandId, brandName, categoryId, categoryName, petTypeId, ...product } = row.data;
    void brandId; void brandName; void categoryId; void categoryName; void petTypeId;
    data = { ...product, ...fields };
  }
  return { ...row, data, errors, brandLabel: brand.label, categoryLabel: category.label, petTypeValue, brandStatus: brand.status, categoryStatus: category.status };
}
