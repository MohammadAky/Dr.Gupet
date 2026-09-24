import { request, requestData } from './client';
import type {
  Brand,
  CartView,
  Category,
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
  page?: number;
  limit?: number;
  q?: string;
  petTypeId?: number;
  requiresPrescription?: boolean;
}

export interface PharmacyFilters {
  page?: number;
  limit?: number;
  city?: string;
  province?: string;
  is24h?: boolean;
}

export interface CreateOrderInput {
  addressId: number;
  couponCode?: string;
  note?: string;
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
  };
}

/** Catalog, favorites, cart, coupons, orders, payments, medicines and pharmacies. */
export const shopApi = {
  brands: () => requestData<Brand[]>('/brands'),

  categories: (petTypeId?: number) => requestData<Category[]>('/categories', { query: { petTypeId } }),

  products: async (filters: ProductFilters): Promise<Page<ProductCard>> => {
    const { data, meta } = await request<ProductCard[]>('/products', { query: productQuery(filters) });
    return { data, meta };
  },

  product: (slug: string) => requestData<ProductDetail>(`/products/${slug}`),

  recommendations: async (petId: number, page = 1, limit = 20): Promise<Page<RecommendationItem>> => {
    const { data, meta } = await request<RecommendationItem[]>('/products/recommendations', {
      query: { petId, page, limit },
    });
    return { data, meta };
  },

  favorites: async (page = 1, limit = 20): Promise<Page<ProductCard>> => {
    const { data, meta } = await request<ProductCard[]>('/favorites', { query: { page, limit } });
    return { data, meta };
  },

  addFavorite: (productId: number) => requestData<void>(`/favorites/${productId}`, { method: 'PUT' }),

  removeFavorite: (productId: number) => requestData<void>(`/favorites/${productId}`, { method: 'DELETE' }),

  cart: () => requestData<CartView>('/cart'),

  addCartItem: (variantId: number, quantity: number) =>
    requestData<CartView>('/cart/items', { method: 'POST', body: { variantId, quantity } }),

  updateCartItem: (itemId: number, quantity: number) =>
    requestData<CartView>(`/cart/items/${itemId}`, { method: 'PATCH', body: { quantity } }),

  removeCartItem: (itemId: number) => requestData<CartView>(`/cart/items/${itemId}`, { method: 'DELETE' }),

  clearCart: () => requestData<CartView>('/cart', { method: 'DELETE' }),

  validateCoupon: (code: string) =>
    requestData<CouponPreview>('/coupons/validate', { method: 'POST', body: { code } }),

  orders: async (page = 1, limit = 20): Promise<Page<OrderSummary>> => {
    const { data, meta } = await request<OrderSummary[]>('/orders', { query: { page, limit } });
    return { data, meta };
  },

  order: (id: number) => requestData<OrderDetail>(`/orders/${id}`),

  createOrder: (body: CreateOrderInput) => requestData<OrderDetail>('/orders', { method: 'POST', body }),

  cancelOrder: (id: number) => requestData<OrderDetail>(`/orders/${id}/cancel`, { method: 'POST' }),

  startPayment: (orderId: number) =>
    requestData<{ paymentUrl: string }>('/payments/start', { method: 'POST', body: { orderId } }),

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
};
