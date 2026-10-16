import { describe, expect, it } from "vitest";
import { csvInteger, importSlug, PRODUCT_CSV_COLUMNS, reviewProductCsv } from "./product-csv";

describe("product CSV review", () => {
  it("accepts the minimal name/price columns, genuine zero and empty optional numbers without scaling", () => {
    const result = reviewProductCsv("\uFEFFname,price\r\nغذای گربه,۰\r\nغذای سگ,٢٥٠٠٠٠\r\n");
    expect(result.errors).toEqual([]);
    expect(result.rows.map(row => row.data)).toEqual([
      { name: "غذای گربه", price: 0, stock: 0, weightGram: 0, compareAtPrice: 0, isActive: false },
      { name: "غذای سگ", price: 250000, stock: 0, weightGram: 0, compareAtPrice: 0, isActive: false },
    ]);
  });
  it("parses escaped quotations, quoted commas and multiline ingredients/descriptions", () => {
    const result = reviewProductCsv('name,price,description,ingredientsText,stock,weightGram,compareAtPrice,sku,slug,isActive\n"غذا، ویژه","۱,۲۵۰,۰۰۰","توضیح ""کامل""\nخط دوم","مرغ, برنج",۲,۵۰۰,, CAT-01 , cat-food ,۱');
    expect(result.rows[0]!.data).toEqual({ name: "غذا، ویژه", price: 1250000, stock: 2, weightGram: 500, compareAtPrice: 0, sku: "CAT-01", slug: "cat-food", ingredientsText: "مرغ, برنج", description: 'توضیح "کامل"\nخط دوم', isActive: true });
  });
  it.each(["", "-1", "1.5", "1e3", "1,5", "1,23", "1,234٬567", "2147483648", "۹۰۰۷۱۹۹۲۵۴۷۴۰۹۹۳"])("rejects invalid required integer %j without silently changing the amount", value => {
    expect(csvInteger(value, true)).toBeNull();
  });
  it.each(["", "۰", "٠", " 000 ", "0,000"])("defaults only optional empty/zero %j to zero", value => {
    expect(csvInteger(value)).toBe(0);
  });
  it("accepts exact SQL maximum and properly grouped Persian/Arabic digits", () => {
    expect(csvInteger("۲٬۱۴۷٬۴۸۳٬۶۴۷", true)).toBe(2147483647);
    expect(csvInteger("١٢٣,٤٥٦", true)).toBe(123456);
  });
  it.each([
    ['name\nغذا', "price"], ['name,name,price\nغذا,غذا,10', "تکراری"],
    ['name,price,unknown\nغذا,10,', "قالب"], ['name,price\n"غذا,10', "بسته"],
    ['name,price\n"غذا"x,10', "نقل‌قول"], ['name,price', "سربرگ"],
  ])("reports unusable structure before any row is submitted", (source, message) => {
    const review = reviewProductCsv(source); expect(review.rows).toEqual([]); expect(review.errors.join(" ")).toContain(message);
  });
  it("reports missing price and wrong cell count with the original spreadsheet row number", () => {
    const review = reviewProductCsv("name,price,stock\n\nغذای گربه,,\nغذای سگ,100");
    expect(review.rows[0]!.number).toBe(3); expect(review.rows[0]!.errors.join(" ")).toContain("خالی");
    expect(review.rows[1]!.number).toBe(4); expect(review.rows[1]!.errors.join(" ")).toContain("تعداد");
    expect(review.rows.every(row => !row.data)).toBe(true);
  });
  it("rejects active zero-weight products and unrecognized publication values", () => {
    const review = reviewProductCsv("name,price,isActive\nغذای سگ,0,1\nغذای گربه,2,yes");
    expect(review.rows[0]!.errors.join(" ")).toContain("وزن");
    expect(review.rows[1]!.errors.join(" ")).toContain("isActive");
  });
  it.each(["T", "t", "True", "TRUE", "1", "۱"])("publishes exact true from نمایش value %s", value => {
    const result = reviewProductCsv(`name,price,weightGram,نمایش\nغذای گربه,100,500,${value}`);
    expect(result.errors).toEqual([]);
    expect(result.rows[0]?.errors).toEqual([]);
    expect(result.rows[0]?.data?.isActive).toBe(true);
  });
  it.each(["F", "f", "False", "FALSE", "0", "۰", ""])("keeps نمایش value %s unpublished with zero optional weight", value => {
    const result = reviewProductCsv(`name,price,نمایش\nغذای گربه,100,${value}`);
    expect(result.rows[0]?.errors).toEqual([]);
    expect(result.rows[0]?.data?.isActive).toBe(false);
  });
  it("retains isActive header support and rejects simultaneous publication aliases", () => {
    const legacy = reviewProductCsv("name,price,weightGram,isActive\nغذا,20,200,t");
    expect(legacy.rows[0]?.data?.isActive).toBe(true);
    const duplicate = reviewProductCsv("name,price,isActive,نمایش\nغذا,20,F,T");
    expect(duplicate.rows).toEqual([]);
    expect(duplicate.errors.join(" ")).toContain("تکراری");
  });
  it("keeps positive-weight publication validation for T and does not treat arbitrary nonempty text as true", () => {
    const result = reviewProductCsv("name,price,نمایش\nغذای سگ,0,T\nغذای گربه,0,انتشار\nغذای پرنده,0,F");
    expect(result.rows[0]?.errors.join(" ")).toContain("وزن");
    expect(result.rows[1]?.errors.join(" ")).toContain("نمایش");
    expect(result.rows[2]?.data?.isActive).toBe(false);
  });
  it("marks both rows for Persian-normalized slug and case-insensitive SKU collisions", () => {
    const review = reviewProductCsv("name,price,sku\nغذاي سگ,100,DOG\nغذای سگ,200,dog");
    expect(review.rows.every(row => !row.data && row.errors.length === 2)).toBe(true);
    expect(importSlug(" آبي‌ کُنج! ")).toBe("ابی-کنج");
  });
  it("enforces row and UTF-8 file bounds", () => {
    expect(reviewProductCsv("name,price\n" + Array.from({ length: 101 }, (_, index) => `غذا ${index},10`).join("\n")).errors[0]).toContain("۱۰۰");
    expect(reviewProductCsv("ی".repeat(524289)).errors[0]).toContain("مگابایت");
  });
  it("omits empty text cells while retaining supported ingredient and description fields", () => {
    const review = reviewProductCsv(PRODUCT_CSV_COLUMNS.join(",") + "\nغذا,20,,,,,,مرغ,توضیح,");
    expect(review.rows[0]!.data).toEqual({ name: "غذا", price: 20, stock: 0, weightGram: 0, compareAtPrice: 0, ingredientsText: "مرغ", description: "توضیح", isActive: false });
  });
  it("matches API text limits and rejects names that only meet minimum length through invisible characters", () => {
    const result = reviewProductCsv("name,price,description\n" + "ی".repeat(192) + ",10,\nی‌ ,0,\nغذا,20," + "ی".repeat(5001));
    expect(result.rows.every(row => !row.data)).toBe(true);
    expect(result.rows[0]!.errors.join(" ")).toContain("191");
    expect(result.rows[1]!.errors.join(" ")).toContain("۲ نویسه");
    expect(result.rows[2]!.errors.join(" ")).toContain("5000");
  });
  it("accepts optional row reference IDs and Persian/name aliases, without adding empty references", () => {
    const ids = reviewProductCsv("name,price,brandId,categoryId,petTypeId\nغذا,1,۲,۳,۴");
    expect(ids.rows[0]?.data).toMatchObject({ brandId: 2, categoryId: 3, petTypeId: 4 });
    const names = reviewProductCsv("name,price,برند,دسته‌بندی,نوع حیوان\nغذا,1,برند تازه,مکمل,گربه");
    expect(names.rows[0]?.data).toMatchObject({ brandName: "برند تازه", categoryName: "مکمل" });
    expect(names.rows[0]?.values?.petType).toBe("گربه");
    expect(names.rows[0]?.data).not.toHaveProperty("petType");
  });
  it("rejects ID/name conflicts, invalid IDs, overlong reference names and alias collisions", () => {
    for (const source of ["name,price,brandId,brand\nغذا,1,2,برند", "name,price,categoryId,category\nغذا,1,2,غذا", "name,price,brandId\nغذا,1,-1", "name,price,brand\nغذا,1," + "ی".repeat(192)]) {
      expect(reviewProductCsv(source).rows[0]?.data).toBeUndefined();
    }
    expect(reviewProductCsv("name,price,brand,brandName\nغذا,1,الف,ب").errors.join(" ")).toContain("تکراری");
  });
  it("revalidates explicit preview edits against original row numbers without silently altering other fields", () => {
    const source = "name,price,isActive\n\nغذا,1,T";
    const first = reviewProductCsv(source);
    expect(first.rows[0]?.number).toBe(3); expect(first.rows[0]?.data).toBeUndefined();
    const edited = reviewProductCsv(source, { 3: { weightGram: "250", brandName: "برند" } });
    expect(edited.rows[0]?.data).toMatchObject({ weightGram: 250, isActive: true, brandName: "برند", price: 1 });
  });
});
