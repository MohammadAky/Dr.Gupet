import { expect, it } from "vitest";
import { CSV_ENCODING, EXPORT_COLUMNS, parseProductSyncCsv, productExportPath, validSyncPreview } from "./product-csv-sync";

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
