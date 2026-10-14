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
  it("rejects active zero-weight products and non-binary active values", () => {
    const review = reviewProductCsv("name,price,isActive\nغذای سگ,0,1\nغذای گربه,2,true");
    expect(review.rows[0]!.errors.join(" ")).toContain("وزن");
    expect(review.rows[1]!.errors.join(" ")).toContain("isActive");
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
});
