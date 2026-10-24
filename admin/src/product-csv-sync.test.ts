import { expect, it } from "vitest";
import { CSV_ENCODING, EXPORT_COLUMNS, PRICE_FILE_EXPORT_COLUMNS, lineFromMessage, parseProductSyncCsv, productExportPath, syncErrorMessage, validSyncPreview } from "./product-csv-sync";

it("preserves omitted and blank update fields while retaining explicit numeric zero and false", () => {
  const review = parseProductSyncCsv("productId,variantId,stock,price,description,isActive,expectedStock,expectedUpdatedAt\n۱,٢,۰,,,F,۱۲,2026-10-17T12:00:00.123Z");
  expect(review.errors).toEqual([]); expect(review.rows[0]?.errors).toEqual([]);
  expect(review.rows[0]?.data).toEqual({ productId: 1, variantId: 2, stock: 0, isActive: false, expectedStock: 12, expectedUpdatedAt: "2026-10-17T12:00:00.123Z" });
});
it("leaves target classification and new-row required fields to the authoritative preview", () => {
  const review = parseProductSyncCsv("sku,stock\nKNOWN-SKU,5\nNEW-SKU,10");
  expect(review.rows.map(row => row.data)).toEqual([{ sku: "KNOWN-SKU", stock: 5 }, { sku: "NEW-SKU", stock: 10 }]);
  expect(review.rows.every(row => !row.errors.length)).toBe(true);
});
it("allows repeated product identities for distinct variants without changing identifiers or inventing references", () => {
  const review = parseProductSyncCsv("productId,variantId,slug,name,brandName,categoryName,petTypeId,price\n1,2,cat,گربه,,,,\n1,3,cat,گربه,,,,\n,,,محصول جدید,برند تازه,دسته تازه,3,0");
  expect(review.rows.every(row => !row.errors.length)).toBe(true);
  expect(review.rows[2]?.data).toEqual({ name: "محصول جدید", brandName: "برند تازه", categoryName: "دسته تازه", petTypeId: 3, price: 0 });
});
it("reverses exactly one export escape only for marked text and retains raw-source apostrophes", () => {
  const encoded = parseProductSyncCsv(`csvEncoding,name,description,sku,expectedUpdatedAt\n${CSV_ENCODING},'=name,''literal,'+sku,2026-10-17T12:00:00Z`);
  expect(encoded.rows[0]?.data).toEqual({ name: "=name", description: "'literal", sku: "+sku", expectedUpdatedAt: "2026-10-17T12:00:00Z" });
  const raw = parseProductSyncCsv("name,description\n'=name,''literal");
  expect(raw.rows[0]?.data).toEqual({ name: "'=name", description: "''literal" });
  expect(parseProductSyncCsv("csvEncoding,name\nunknown,'=name").rows[0]?.errors.join()).toContain("کدگذاری");
});
it("does not decode snapshots or numeric cells and only allows explicit clears in optional text", () => {
  const review = parseProductSyncCsv(`csvEncoding,stock,expectedUpdatedAt,description,name\n${CSV_ENCODING},'0,'2026-10-17T12:00:00Z,__CLEAR__,__CLEAR__`);
  expect(review.rows[0]?.data.description).toBe("__CLEAR__");
  expect(review.rows[0]?.errors).toHaveLength(3);
});
it("handles BOM, quotes, literal newlines and comma-separated numbers without losing contents", () => {
  const review = parseProductSyncCsv('\uFEFFsku,description,price\r\n"SKU-1","یک ""متن""\nدو خطی","۱٬۲۳۴"\r\n');
  expect(review.rows[0]?.errors).toEqual([]);
  expect(review.rows[0]?.data).toEqual({ sku: "SKU-1", description: 'یک "متن"\nدو خطی', price: 1234 });
});
it("rejects unknown/duplicate headers, malformed records, invalid amounts, negative IDs and invalid activation", () => {
  expect(parseProductSyncCsv("name,unknown\nname,x").errors.join()).toContain("ناشناخته");
  expect(parseProductSyncCsv("isActive,نمایش\nT,T").errors.join()).toContain("تکراری");
  expect(parseProductSyncCsv('name\n"open').errors).not.toEqual([]);
  expect(parseProductSyncCsv("sku,price\nx,1,2").rows[0]?.errors).not.toEqual([]);
  for (const value of ["-1", "1e3", "1.5", "2147483648"]) expect(parseProductSyncCsv(`sku,stock\nx,${value}`).rows[0]?.errors).not.toEqual([]);
  const invalid = parseProductSyncCsv("productId,isActive\n0,yes").rows[0]?.errors.join(" ");
  expect(invalid).toContain("شناسهٔ محصول"); expect(invalid).toContain("T یا F");
});
it("rejects a version column rewritten by a spreadsheet before the server sees a stale snapshot", () => {
  for (const value of ["2026-10-17 12:00:00", "2026-10-17T12:00:00", "10/17/2026 12:00"]) {
    const review = parseProductSyncCsv(`sku,expectedUpdatedAt\nSKU-1,${value}`);
    expect(review.rows[0]?.errors.join(" ")).toContain("Excel");
    expect(review.rows[0]?.data.expectedUpdatedAt).toBeUndefined();
  }
  for (const value of ["2026-10-17T12:00:00Z", "2026-10-17T12:00:00.123Z", "2026-10-17T12:00:00+03:30"])
    expect(parseProductSyncCsv(`sku,expectedUpdatedAt\nSKU-1,${value}`).rows[0]?.errors).toEqual([]);
});
it("accepts 500 rows, rejects 501, and distinguishes the file and request size bounds", () => {
  const rows = Array.from({ length: 500 }, (_, index) => `${index + 1},0`);
  expect(parseProductSyncCsv("variantId,stock\n" + rows.join("\n")).rows).toHaveLength(500);
  expect(parseProductSyncCsv("variantId,stock\n" + [...rows, "501,0"].join("\n")).errors.join()).toContain("۵۰۰");
  expect(parseProductSyncCsv("name\n" + "x".repeat(1024 * 1024)).errors.join()).toContain("مگابایت");
  const jsonHeavy = "name,description\n" + Array.from({ length: 185 }, () => "aa," + "x".repeat(5000)).join("\n");
  expect(parseProductSyncCsv(jsonHeavy).errors.join()).toContain("حجم اطلاعات");
});
it("exports all matching rows by retaining applied filters and omitting pagination from the download path", () => {
  const query = new URLSearchParams(productExportPath({ search: "غذا", isActive: false, brandId: 2, categoryId: 3, petTypeId: 4 }, ["stock", "sku"]).split("?")[1]);
  expect(query.get("columns")).toBe("sku,stock"); expect(query.get("search")).toBe("غذا"); expect(query.get("isActive")).toBe("false");
  expect(query.get("brandId")).toBe("2"); expect(query.has("page")).toBe(false); expect(query.has("limit")).toBe(false);
  expect(new URLSearchParams(productExportPath({}, [...EXPORT_COLUMNS]).split("?")[1]).get("columns")?.split(",")).toEqual(EXPORT_COLUMNS);
});
it("rejects malformed preview rows/counts rather than enabling an unreviewed apply", () => {
  const preview = { rows: [{ line: 2, action: "update", data: { variantId: 1, stock: 0 }, changes: [{ field: "stock", before: 5, after: 0 }] }], totals: { created: 0, updated: 1, unchanged: 0, variantsAdded: 0 } };
  expect(validSyncPreview(preview, 1)).toBe(true);
  expect(validSyncPreview({ ...preview, totals: { ...preview.totals, updated: 2 } }, 1)).toBe(false);
  expect(validSyncPreview({ ...preview, rows: [{ ...preview.rows[0], action: "__proto__" }] }, 1)).toBe(false);
  expect(validSyncPreview({ ...preview, rows: [{ ...preview.rows[0], data: { arbitrary: true } }] }, 1)).toBe(false);
});
it("only accepts well-formed preservation notes from the server", () => {
  const preview = { rows: [{ line: 2, action: "unchanged", data: { variantId: 1, stock: 0 }, changes: [] }], totals: { created: 0, updated: 0, unchanged: 1, variantsAdded: 0 } };
  expect(validSyncPreview(preview, 1)).toBe(true);
  expect(validSyncPreview({ ...preview, notes: [{ line: 2, field: "stock", message: "موجودی حفظ شد" }] }, 1)).toBe(true);
  expect(validSyncPreview({ ...preview, notes: [{ line: "۲", field: "stock", message: "x" }] }, 1)).toBe(false);
  expect(validSyncPreview({ ...preview, notes: { line: 2 } }, 1)).toBe(false);
});

it("treats a price-only file as prices: the name is a label and never becomes a product rename", () => {
  const file = `csvEncoding,sku,name,price,compareAtPrice\n${CSV_ENCODING},RC-MAXI-2KG,رویال کنین ۲ کیلو,850000,900000`;
  const parsed = parseProductSyncCsv(file);
  expect(parsed.priceFile).toBe(true);
  expect(parsed.rows[0]?.data).toEqual({ sku: "RC-MAXI-2KG", price: 850000, compareAtPrice: 900000 });
  expect(parsed.rows[0]?.reference).toBe("رویال کنین ۲ کیلو");
  // The full flow keeps the price payload free of name/stock/version columns.
  expect(parseProductSyncCsv("sku,price\nSKU-1,1200").rows[0]?.data).toEqual({ sku: "SKU-1", price: 1200 });
});

it("does not flip to price mode when any non-price column is present", () => {
  for (const extra of ["stock", "weightGram", "isActive", "description", "expectedUpdatedAt"]) {
    const parsed = parseProductSyncCsv(`sku,name,price,${extra}\nSKU-1,نام,100,`);
    expect(parsed.priceFile).toBe(false);
    expect(parsed.rows[0]?.data.name).toBe("نام");
  }
});

it("skips variant-less export rows instead of blocking the whole price file", () => {
  const parsed = parseProductSyncCsv("sku,name,price\nSKU-1,غذا,100\n,محصول بدون گزینه,\nSKU-2,غذای دوم,200");
  expect(parsed.errors).toEqual([]);
  expect(parsed.ignored).toBe(1);
  expect(parsed.rows.map(row => row.data)).toEqual([{ sku: "SKU-1", price: 100 }, { sku: "SKU-2", price: 200 }]);
});

it("reports price rows that lack an identity or a value, and keeps zero valid", () => {
  const parsed = parseProductSyncCsv("sku,price\n,100\nSKU-2,\nSKU-3,0");
  expect(parsed.rows[0]?.errors.join(" ")).toContain("sku");
  expect(parsed.rows[1]?.errors.join(" ")).toContain("قیمتی وارد نشده");
  expect(parsed.rows[2]?.errors).toEqual([]);
  expect(parsed.rows[2]?.data.price).toBe(0);
});

it("explains an unknown SKU from a price file and names the row", () => {
  const parsed = parseProductSyncCsv("sku,name,price\nSKU-OK,غذا,10\nUNKNOWN,غذای تازه,20");
  const message = syncErrorMessage(
    "ردیف ۳: محصول جدید به نام، قیمت، برند، دسته‌بندی و نوع حیوان نیاز دارد",
    parsed.rows.map(row => ({ sku: row.data.sku, name: row.reference })),
  );
  expect(message).toContain("در کاتالوگ پیدا نشد");
  expect(message).toContain("UNKNOWN");
  expect(message).toContain("ردیف ۳");
  expect(syncErrorMessage("قیمت باید عدد صحیح باشد")).toBe("قیمت باید عدد صحیح باشد");
  expect(lineFromMessage("ردیف ۱۴ خطا دارد")).toBe(14);
  expect(lineFromMessage("بدون شماره")).toBeNull();
});

it("builds the price export path without stock or version columns", () => {
  const query = new URLSearchParams(productExportPath({ isActive: true }, [...PRICE_FILE_EXPORT_COLUMNS]).split("?")[1]);
  expect(query.get("columns")).toBe("sku,name,price,compareAtPrice");
  expect(query.get("columns")).not.toContain("stock");
  expect(query.get("columns")).not.toContain("expectedUpdatedAt");
});
