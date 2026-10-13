import { request, requestData } from './client';
import { safePaymentUrl } from '../lib/security';
import type {
  AddressSnapshot,
  Brand,
  CartView,
  Category,
  Clinic,
  ClinicDetail,
  CouponPreview,
  Medicine,
  MedicineDetail,
  OrderDetail,
  OrderSummary,
  PageInfo,
  Pharmacy,
  PharmacyDetail,
  ProductCard,
  ProductDetail,
  RecommendationItem,
} from './types';

/** GET /products filters (README Phase 6). `inStock` is only sent when true — BE-REQ-03. */
export interface ProductFilters {
  sampleOnly?: boolean;
  page?: number;
  limit?: number;
  q?: string;
  petTypeId?: number;
  categorySlug?: string;
  brandId?: number;
  lifeStage?: string;
  sizeClass?: string;
  tagIds?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sort?: string;
}

export interface Page<T> {
  data: T[];
  meta?: PageInfo;
}

export interface MedicineFilters {
  sampleOnly?: boolean;
  page?: number;
  limit?: number;
  q?: string;
  petTypeId?: number;
  requiresPrescription?: boolean;
}

export interface PharmacyFilters {
  sampleOnly?: boolean;
  page?: number;
  limit?: number;
  city?: string;
  province?: string;
  is24h?: boolean;
  onDuty?: boolean;
}

export type ClinicFilters = Omit<PharmacyFilters, 'onDuty' | 'sampleOnly'>;

export interface NearbyFilters {
  lat: number;
  lng: number;
  page?: number;
  limit?: number;
}

export interface CreateOrderInput {
  addressId: number;
  couponCode?: string;
  note?: string;
}

type OrderResponse = Omit<OrderDetail, 'addressSnapshot'> & { addressSnapshot: unknown };

/** MySQL currently returns this Text column as JSON; accept the object contract too. */
function normalizeOrder(order: OrderResponse): OrderDetail {
  let value = order.addressSnapshot;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value) as unknown;
    } catch {
      value = null;
    }
  }
  let addressSnapshot: AddressSnapshot | null = null;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const fields = [
      'title',
      'receiverName',
      'receiverPhone',
      'province',
      'city',
      'fullAddress',
    ] as const;
    if (
      fields.every((field) => typeof record[field] === 'string' && record[field].trim() !== '') &&
      (record.postalCode == null || typeof record.postalCode === 'string')
    ) {
      addressSnapshot = {
        title: record.title as string,
        receiverName: record.receiverName as string,
        receiverPhone: record.receiverPhone as string,
        province: record.province as string,
        city: record.city as string,
        fullAddress: record.fullAddress as string,
        postalCode: (record.postalCode as string | null | undefined) ?? null,
      };
    }
  }
  return { ...order, addressSnapshot };
}

function productQuery(filters: ProductFilters): Record<string, string | number | undefined> {
  return {
    page: filters.page,
    limit: filters.limit,
    q: filters.q,
    petTypeId: filters.petTypeId,
    categorySlug: filters.categorySlug,
    brandId: filters.brandId,
    lifeStage: filters.lifeStage,
    sizeClass: filters.sizeClass,
    tagIds: filters.tagIds,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    // BE-REQ-03: `inStock=false` would be coerced to true server-side.
    inStock: filters.inStock ? 'true' : undefined,
    sort: filters.sort,
    sampleOnly: filters.sampleOnly ? 'true' : undefined,
  };
}

/** Catalog, favorites, cart, coupons, orders, payments, medicines and pharmacies. */
export const shopApi = {
  brands: () => requestData<Brand[]>('/brands'),

  categories: (petTypeId?: number) =>
    requestData<Category[]>('/categories', { query: { petTypeId } }),

  products: async (filters: ProductFilters): Promise<Page<ProductCard>> => {
    const { data, meta } = await request<ProductCard[]>('/products', {
      query: productQuery(filters),
    });
    return { data, meta };
  },

  product: (slug: string) => requestData<ProductDetail>(`/products/${slug}`),

  recommendations: async (
    petId: number,
    page = 1,
    limit = 20,
  ): Promise<Page<RecommendationItem>> => {
    const { data, meta } = await request<RecommendationItem[]>('/products/recommendations', {
      query: { petId, page, limit },
    });
    return { data, meta };
  },

  favorites: async (page = 1, limit = 20): Promise<Page<ProductCard>> => {
    const { data, meta } = await request<ProductCard[]>('/favorites', { query: { page, limit } });
    return { data, meta };
  },

  addFavorite: (productId: number) =>
    requestData<void>(`/favorites/${productId}`, { method: 'PUT' }),

  removeFavorite: (productId: number) =>
    requestData<void>(`/favorites/${productId}`, { method: 'DELETE' }),

  cart: () => requestData<CartView>('/cart'),

  addCartItem: (variantId: number, quantity: number) =>
    requestData<CartView>('/cart/items', { method: 'POST', body: { variantId, quantity } }),

  updateCartItem: (itemId: number, quantity: number) =>
    requestData<CartView>(`/cart/items/${itemId}`, { method: 'PATCH', body: { quantity } }),

  removeCartItem: (itemId: number) =>
    requestData<CartView>(`/cart/items/${itemId}`, { method: 'DELETE' }),

  clearCart: () => requestData<CartView>('/cart', { method: 'DELETE' }),

  validateCoupon: (code: string) =>
    requestData<CouponPreview>('/coupons/validate', { method: 'POST', body: { code } }),

  orders: async (page = 1, limit = 20): Promise<Page<OrderSummary>> => {
    const { data, meta } = await request<OrderSummary[]>('/orders', { query: { page, limit } });
    return { data, meta };
  },

  order: async (id: number) => normalizeOrder(await requestData<OrderResponse>(`/orders/${id}`)),

  createOrder: async (body: CreateOrderInput) =>
    normalizeOrder(await requestData<OrderResponse>('/orders', { method: 'POST', body })),

  cancelOrder: async (id: number) =>
    normalizeOrder(await requestData<OrderResponse>(`/orders/${id}/cancel`, { method: 'POST' })),

  startPayment: async (orderId: number) => {
    const result = await requestData<{ paymentUrl: string }>('/payments/start', {
      method: 'POST',
      body: { orderId },
    });
    const paymentUrl = safePaymentUrl(result.paymentUrl);
    if (!paymentUrl)
      throw new Error('آدرس درگاه پرداخت معتبر نیست. پرداخت را از بخش سفارش‌ها دوباره بررسی کنید.');
    return { paymentUrl };
  },

  medicines: async (filters: MedicineFilters): Promise<Page<Medicine>> => {
    const { data, meta } = await request<Medicine[]>('/medicines', { query: { ...filters } });
    return { data, meta };
  },

  medicine: (id: number, city?: string) =>
    requestData<MedicineDetail>(`/medicines/${id}`, { query: { city } }),

  pharmacies: async (filters: PharmacyFilters): Promise<Page<Pharmacy>> => {
    const { data, meta } = await request<Pharmacy[]>('/pharmacies', { query: { ...filters } });
    return { data, meta };
  },

  pharmacy: (id: number) => requestData<PharmacyDetail>(`/pharmacies/${id}`),

  clinics: async (filters: ClinicFilters): Promise<Page<Clinic>> => {
    const { data, meta } = await request<Clinic[]>('/clinics', { query: { ...filters } });
    return { data, meta };
  },

  clinic: (id: number) => requestData<ClinicDetail>(`/clinics/${id}`),

  nearbyClinics: async (body: NearbyFilters): Promise<Page<Clinic>> => {
    const { data, meta } = await request<Clinic[]>('/clinics/nearby', {
      method: 'POST',
      body,
      auth: false,
    });
    return { data, meta };
  },

  nearbyPharmacies: async (body: NearbyFilters): Promise<Page<Pharmacy>> => {
    const { data, meta } = await request<Pharmacy[]>('/pharmacies/nearby', {
      method: 'POST',
      body,
      auth: false,
    });
    return { data, meta };
  },
};
