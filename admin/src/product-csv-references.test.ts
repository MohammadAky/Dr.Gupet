import { expect, it } from "vitest";
import { reviewProductCsv } from "./product-csv";
import { resolveCsvReferences, suggestCsvReferences, type ImportDefaults } from "./product-csv-references";
import type { CatalogReferences } from "./CatalogReferences";

const refs: CatalogReferences = {
  brands: [{ id: 2, name: "Royal Canin", isActive: true }, { id: 8, name: "غیرفعال", isActive: false }],
  categories: [{ id: 5, name: "غذای خشک", isActive: true, petTypeId: 3 }, { id: 6, name: "غذای خشک", isActive: true, petTypeId: 4 }],
  petTypes: [{ id: 3, name: "گربه", isActive: true }, { id: 4, name: "سگ", isActive: true }, { id: 9, name: "پرنده", isActive: true }], breeds: [], tags: [],
};
const defaults: ImportDefaults = { brandId: "", categoryId: "", petTypeId: "" };
function row(source: string) { return reviewProductCsv(source).rows[0]!; }

it("suggests known brand aliases from plain text and an existing species, without guessing weights or publication", () => {
  const item = row("name,price,description,isActive\nغذای خشک گربه رویال کنین,1,بسته غذا,true");
  const patch = suggestCsvReferences(item, refs);
  expect(patch).toEqual({ brandId: "2", categoryName: "غذای خشک", petTypeId: "3" });
  expect(patch).not.toHaveProperty("weightGram"); expect(patch).not.toHaveProperty("isActive");
  expect(item.errors.join(" ")).toContain("وزن");
});
it("leaves unknown brands and absent/multiple species for explicit selection", () => {
  const unknown = row("name,price\nدستکش پرزگیر سگ و گربه,1");
  expect(suggestCsvReferences(unknown, refs)).toEqual({ categoryName: "دستکش پرزگیر" });
  const absent = row("name,price\nبسته خوراک بدون مشخصه,1");
  expect(suggestCsvReferences(absent, refs)).toEqual({});
});
it("supports mixed sample-shaped food, supplements and accessories with no guessed missing facts", () => {
  const review = reviewProductCsv("name,price,description,isActive\nغذای خشک گربه جوسرا,1,بسته,T\nمالت سگ ونپی,2,مکمل,T\nگردنبند محافظ کوکوپت,3,لوازم,F\nپودر مینرال پرندگان,4,مکمل,F");
  const suggestions = review.rows.map(item => suggestCsvReferences(item, refs));
  expect(suggestions[0]).toEqual({ brandName: "جوسرا", categoryName: "غذای خشک", petTypeId: "3" });
  expect(suggestions[1]).toEqual({ brandName: "ونپی", categoryName: "مکمل", petTypeId: "4" });
  expect(suggestions[2]).toEqual({ brandName: "کوکوپت", categoryName: "گردنبند محافظ" });
  expect(suggestions[3]).toEqual({ categoryName: "مکمل", petTypeId: "9" });
});
it("resolves complete per-row IDs without shared defaults, preserving exact publication", () => {
  const item = row("name,price,brandId,categoryId,petTypeId,نمایش\nغذا,1,۲,۵,۳,F");
  const resolved = resolveCsvReferences(item, refs, defaults);
  expect(resolved.errors).toEqual([]);
  expect(resolved.data).toMatchObject({ brandId: 2, categoryId: 5, petTypeId: 3, isActive: false });
  expect(resolved.data).not.toHaveProperty("brandName");
});
it("sends unknown reviewed names with an existing species and never a duplicate ID/name pair", () => {
  const item = row("name,price,brand,category,petType\nغذا,1,برند تازه,مکمل,bird");
  const resolved = resolveCsvReferences(item, refs, defaults);
  expect(resolved.errors).toEqual([]);
  expect(resolved.data).toMatchObject({ brandName: "برند تازه", categoryName: "مکمل", petTypeId: 9 });
  expect(resolved.data).not.toHaveProperty("brandId"); expect(resolved.brandStatus).toContain("جدید");
});
it("normalizes Persian reference names, scopes categories by species and rejects ambiguous/inactive matches", () => {
  const item = row("name,price,brand,category,petTypeId\nغذا,1,رويـال,غذای خشک,3");
  const normalized = { ...refs, brands: [{ id: 10, name: "رویال", isActive: true }] };
  expect(resolveCsvReferences(item, normalized, defaults).data).toMatchObject({ brandId: 10, categoryId: 5, petTypeId: 3 });
  const duplicate = { ...normalized, categories: [...refs.categories, { id: 11, name: "غذای خشک", isActive: true, petTypeId: null }] };
  expect(resolveCsvReferences(item, duplicate, defaults).errors.join(" ")).toContain("هم‌نام");
  const inactive = row("name,price,brand,categoryId,petTypeId\nغذا,1,غیرفعال,5,3");
  expect(resolveCsvReferences(inactive, refs, defaults).errors.join(" ")).toContain("غیرفعال");
});
it("keeps exact case for stored name matching and rejects unknown species without creating it", () => {
  const item = row("name,price,brand,category,petType\nغذا,1,royal canin,مکمل,unknown");
  const resolved = resolveCsvReferences(item, refs, defaults);
  expect(resolved.brandStatus).toContain("جدید");
  expect(resolved.errors.join(" ")).toContain("نوع حیوان"); expect(resolved.data).toBeUndefined();
});
it("uses optional shared defaults only for missing fields and lets complete row references override them", () => {
  const shared = { brandId: "2", categoryId: "5", petTypeId: "3" };
  const minimal = row("name,price\nغذای گربه,1");
  expect(suggestCsvReferences(minimal, refs)).toEqual({ petTypeId: "3" });
  expect(resolveCsvReferences(minimal, refs, shared).data).toEqual(minimal.data);
  const own = row("name,price,brand,categoryId,petTypeId\nغذای سگ,1,برند مستقل,6,4");
  expect(resolveCsvReferences(own, refs, shared).data).toMatchObject({ brandName: "برند مستقل", categoryId: 6, petTypeId: 4 });
});
