import type { Options } from "./api/client";

export interface NamedRef {
  id: number;
  name: string;
  isActive: boolean;
  petTypeId?: number | null;
}

export interface CatalogTag extends NamedRef {
  type: "ALLERGEN" | "DIET";
}

export interface ProductRow {
  id: number;
  name: string;
  slug: string;
  isActive: boolean;
  minPrice: number | null;
  totalStock: number;
  brand: NamedRef;
  category: NamedRef;
  petType: NamedRef;
  _count?: { variants: number; images: number };
}

export interface ProductDetail extends ProductRow {
  lifeStage: string;
  sizeClass: string;
  neuterSuitability: string;
  ingredientsText: string | null;
  description: string | null;
  variants: Array<{
    id: number;
    sku: string;
    weightGram: number;
    price: number;
    compareAtPrice: number | null;
    stock: number;
    isActive: boolean;
  }>;
  images: Array<{ id: number; url: string; sortOrder: number }>;
  tags: Array<{
    tagId: number;
    kind: "CONTAINS" | "SUITABLE_FOR";
    tag: CatalogTag;
  }>;
}

export interface ProductDraft {
  name: string;
  slug: string;
  brandId: string;
  categoryId: string;
  petTypeId: string;
  lifeStage: "PUPPY_KITTEN" | "ADULT" | "SENIOR" | "ALL";
  sizeClass: "SMALL" | "MEDIUM" | "LARGE" | "ALL";
  neuterSuitability: "ANY" | "NEUTERED_ONLY";
  ingredientsText: string;
  description: string;
  isActive: boolean;
}

export interface VariantDraft {
  sku: string;
  weightGram: string;
  price: string;
  compareAtPrice: string;
  stock: string;
  isActive: boolean;
}

export const emptyProductDraft: ProductDraft = {
  name: "",
  slug: "",
  brandId: "",
  categoryId: "",
  petTypeId: "",
  lifeStage: "ALL",
  sizeClass: "ALL",
  neuterSuitability: "ANY",
  ingredientsText: "",
  description: "",
  isActive: true,
};

export const emptyVariantDraft: VariantDraft = {
  sku: "",
  weightGram: "",
  price: "",
  compareAtPrice: "",
  stock: "0",
  isActive: true,
};

export function parseNonNegativeInteger(raw: string): number | null {
  const normalized = raw
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632));
  if (!/^\d+$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isSafeInteger(value) ? value : null;
}

export function validateProductDraft(
  product: ProductDraft,
  variant: VariantDraft,
): string | null {
  if (product.name.trim().length < 2)
    return "نام محصول باید دست‌کم دو نویسه باشد.";
  if (
    [product.brandId, product.categoryId, product.petTypeId].some((id) => {
      const value = parseNonNegativeInteger(id);
      return value === null || value < 1;
    })
  )
    return "برند، دسته‌بندی و نوع حیوان را انتخاب کنید.";
  if (!variant.sku.trim()) return "شناسهٔ کالا (SKU) الزامی است.";
  const weight = parseNonNegativeInteger(variant.weightGram);
  const price = parseNonNegativeInteger(variant.price);
  const stock = parseNonNegativeInteger(variant.stock);
  const compare = variant.compareAtPrice.trim()
    ? parseNonNegativeInteger(variant.compareAtPrice)
    : 0;
  if (weight === null || weight < 1)
    return "وزن را به گرم و بزرگ‌تر از صفر وارد کنید.";
  if (price === null || stock === null || compare === null)
    return "قیمت، قیمت مقایسه‌ای و موجودی باید عدد صحیح نامنفی باشند.";
  if (product.isActive && !variant.isActive)
    return "برای انتشار محصول، نخستین واریانت باید فعال باشد.";
  return null;
}

export function productPayload(draft: ProductDraft, isActive: boolean) {
  return {
    name: draft.name.trim(),
    ...(draft.slug.trim() ? { slug: draft.slug.trim() } : {}),
    brandId: Number(draft.brandId),
    categoryId: Number(draft.categoryId),
    petTypeId: Number(draft.petTypeId),
    lifeStage: draft.lifeStage,
    sizeClass: draft.sizeClass,
    neuterSuitability: draft.neuterSuitability,
    ...(draft.ingredientsText.trim()
      ? { ingredientsText: draft.ingredientsText.trim() }
      : {}),
    ...(draft.description.trim()
      ? { description: draft.description.trim() }
      : {}),
    isActive,
  };
}

export function variantPayload(draft: VariantDraft) {
  return {
    sku: draft.sku.trim(),
    weightGram: parseNonNegativeInteger(draft.weightGram),
    price: parseNonNegativeInteger(draft.price),
    ...(draft.compareAtPrice.trim()
      ? { compareAtPrice: parseNonNegativeInteger(draft.compareAtPrice) }
      : {}),
    stock: parseNonNegativeInteger(draft.stock),
    isActive: draft.isActive,
  };
}

export function validateImage(file: File | null): string | null {
  if (!file) return null;
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    return "فقط تصویر JPEG، PNG یا WebP مجاز است.";
  if (file.size > 5 * 1024 * 1024)
    return "حجم تصویر نباید بیشتر از ۵ مگابایت باشد.";
  return null;
}

export function safeImageUrl(value: string): string | null {
  try {
    const url = new URL(value, window.location.origin);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

export type CatalogRequest = <T>(
  path: string,
  options?: Omit<Options, "token">,
) => Promise<T>;

export class PartialProductError extends Error {
  constructor(
    readonly productId: number,
    readonly stage: "variant" | "upload" | "image" | "tags" | "activate",
    readonly cause: unknown,
  ) {
    super("محصول پایه ساخته شد، اما تکمیل آن در مرحلهٔ بعد انجام نشد.");
  }
}

export async function createProductWorkflow(
  request: CatalogRequest,
  draft: ProductDraft,
  variant: VariantDraft,
  image: File | null,
  tags: { contains: number[]; suitableFor: number[] },
): Promise<number> {
  const validationError =
    validateProductDraft(draft, variant) || validateImage(image);
  if (validationError) throw new Error(validationError);
  const base = await request<{ id: number }>("/admin/products", {
    method: "POST",
    // Never publish a product before its sellable variant and optional
    // attachments have been accepted by the API.
    body: productPayload(draft, false),
  });
  const id = base.id;
  if (!Number.isSafeInteger(id) || id < 1)
    throw new Error(
      "شناسهٔ محصول ساخته‌شده از سرور معتبر نیست؛ وضعیت ثبت را در فهرست بررسی کنید.",
    );
  let stage: PartialProductError["stage"] = "variant";
  try {
    await request("/admin/products/" + id + "/variants", {
      method: "POST",
      body: variantPayload(variant),
    });
    if (image) {
      stage = "upload";
      const formData = new FormData();
      formData.append("file", image);
      const uploaded = await request<{ url: string }>("/upload/image", {
        method: "POST",
        formData,
      });
      if (!safeImageUrl(uploaded.url))
        throw new Error("نشانی تصویر دریافتی معتبر نیست.");
      stage = "image";
      await request("/admin/products/" + id + "/images", {
        method: "POST",
        body: { url: uploaded.url, sortOrder: 0 },
      });
    }
    if (tags.contains.length || tags.suitableFor.length) {
      stage = "tags";
      await request("/admin/products/" + id + "/tags", {
        method: "PUT",
        body: tags,
      });
    }
    if (draft.isActive) {
      stage = "activate";
      await request("/admin/products/" + id, {
        method: "PATCH",
        body: { isActive: true },
      });
    }
  } catch (cause) {
    throw new PartialProductError(id, stage, cause);
  }
  return id;
}
