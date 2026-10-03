import { describe, expect, it, vi } from "vitest";
import {
  createProductWorkflow,
  emptyProductDraft,
  emptyVariantDraft,
  parseNonNegativeInteger,
  safeImageUrl,
  validateProductDraft,
  type CatalogRequest,
} from "./catalog-model";

const draft = {
  ...emptyProductDraft,
  name: "غذای سگ بالغ",
  brandId: "1",
  categoryId: "2",
  petTypeId: "3",
};
const variant = {
  ...emptyVariantDraft,
  sku: "DOG-2KG",
  weightGram: "۲۰۰۰",
  price: "۱۲۸۰۰۰۰",
  stock: "۱۰",
};

describe("admin product creation", () => {
  it("creates an inactive base, then a sellable variant and tags before publishing", async () => {
    const request = vi.fn(async (path: string, options?: unknown) => {
      void options;
      return path === "/admin/products" ? { id: 42 } : {};
    });
    const id = await createProductWorkflow(
      request as CatalogRequest,
      draft,
      variant,
      null,
      {
        contains: [4],
        suitableFor: [5],
      },
    );
    expect(id).toBe(42);
    expect(request.mock.calls.map(([path]) => path)).toEqual([
      "/admin/products",
      "/admin/products/42/variants",
      "/admin/products/42/tags",
      "/admin/products/42",
    ]);
    expect(request.mock.calls[0]?.[1]).toMatchObject({
      body: { isActive: false },
    });
    expect(request.mock.calls[1]?.[1]).toMatchObject({
      body: { weightGram: 2000, price: 1280000, stock: 10 },
    });
    expect(request.mock.calls[3]?.[1]).toMatchObject({
      body: { isActive: true },
    });
  });

  it("leaves the created product inactive when its variant fails", async () => {
    const request = vi.fn(async (path: string, options?: unknown) => {
      void options;
      if (path === "/admin/products") return { id: 42 };
      throw new Error("variant failed");
    });
    await expect(
      createProductWorkflow(request as CatalogRequest, draft, variant, null, {
        contains: [],
        suitableFor: [],
      }),
    ).rejects.toMatchObject({ productId: 42, stage: "variant" });
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[0]?.[1]).toMatchObject({
      body: { isActive: false },
    });
  });

  it("rejects invalid numbers and unsafe image schemes", () => {
    expect(parseNonNegativeInteger("۱۲۳")).toBe(123);
    expect(parseNonNegativeInteger("-1")).toBeNull();
    expect(
      validateProductDraft(draft, { ...variant, weightGram: "0" }),
    ).toMatch(/وزن/);
    expect(safeImageUrl("javascript:alert(1)")).toBeNull();
    expect(safeImageUrl("https://user:pass@example.com/photo.png")).toBeNull();
  });
});
