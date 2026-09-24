/** Response envelope shapes (README §6.2). */

export interface PageInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Envelope<T> {
  success: true;
  data: T;
  meta?: PageInfo;
}

export type Role = 'USER' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'BLOCKED';
export type Gender = 'MALE' | 'FEMALE';
export type LifeStage = 'PUPPY_KITTEN' | 'ADULT' | 'SENIOR' | 'ALL';
export type SizeClass = 'SMALL' | 'MEDIUM' | 'LARGE' | 'ALL';
export type NeuterSuitability = 'ANY' | 'NEUTERED_ONLY';
export type TagType = 'ALLERGEN' | 'DIET';
export type ProductTagKind = 'CONTAINS' | 'SUITABLE_FOR';
export type CouponType = 'PERCENT' | 'FIXED';
export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELED';
export type PaymentStatus = 'INITIATED' | 'SUCCESS' | 'FAILED';
export type SortOption = 'newest' | 'price_asc' | 'price_desc';

/** POST /auth/otp/request */
export interface OtpRequestResult {
  expiresIn: number;
}

/** The user object returned by POST /auth/otp/verify. */
export interface SessionUser {
  id: number;
  firstName: string | null;
  lastName: string | null;
  phone: string;
  avatar: string | null;
  role: Role;
  status: UserStatus;
  isPhoneVerified: boolean;
}

/** POST /auth/otp/verify */
export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
  isNewUser: boolean;
}

/** POST /auth/refresh */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/** GET /users/me and PATCH /users/me */
export interface UserProfile {
  id: number;
  firstName: string | null;
  lastName: string | null;
  phone: string;
  avatar: string | null;
  role: Role;
  createdAt: string;
  updatedAt: string;
}

/** GET /addresses (full Prisma row). */
export interface Address {
  id: number;
  userId: number;
  title: string;
  receiverName: string;
  receiverPhone: string;
  province: string;
  city: string;
  fullAddress: string;
  postalCode: string | null;
  lat: number | null;
  lng: number | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PetType {
  id: number;
  name: string;
  slug: string;
}

export interface Breed {
  id: number;
  name: string;
  petTypeId?: number;
}

export interface Tag {
  id: number;
  name: string;
  slug: string;
  type: TagType;
}

/** GET /pets — Prisma row + computed fields. */
export interface Pet {
  id: number;
  userId: number;
  name: string;
  petTypeId: number;
  breedId: number | null;
  birthDate: string | null;
  gender: Gender | null;
  isNeutered: boolean;
  weightKg: number | null;
  photo: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  petType: PetType;
  breed: Breed | null;
  tags: Tag[];
  lifeStage: LifeStage;
}

/** GET /brands */
export interface Brand {
  id: number;
  name: string;
  slug: string;
  logo: string | null;
  country: string | null;
}

/** GET /categories — root categories with one level of children. */
export interface Category {
  id: number;
  name: string;
  slug: string;
  image: string | null;
  children: { id: number; name: string; slug: string; image: string | null }[];
}

/** Product card used by /products, /favorites and /products/recommendations. */
export interface ProductCard {
  id: number;
  name: string;
  slug: string;
  brand: { id: number; name: string };
  image: string | null;
  minPrice: number;
  inStock: boolean;
  lifeStage: LifeStage;
  sizeClass: SizeClass;
}

/** GET /products/recommendations item. */
export interface RecommendationItem extends ProductCard {
  matchedTags: string[];
  matchScore: number;
}

/** GET /products/:slug variant rows (stock numbers are never exposed). */
export interface ProductVariant {
  id: number;
  sku: string;
  weightGram: number;
  price: number;
  compareAtPrice: number | null;
  inStock: boolean;
  lowStock: boolean;
}

/** GET /products/:slug */
export interface ProductDetail {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  ingredientsText: string | null;
  lifeStage: LifeStage;
  sizeClass: SizeClass;
  neuterSuitability: NeuterSuitability;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  brand: { id: number; name: string; slug: string };
  category: { id: number; name: string; slug: string };
  petType: { id: number; name: string; slug: string };
  images: { id: number; url: string; sortOrder: number }[];
  variants: ProductVariant[];
  tags: Tag[];
}

/** GET /cart */
export interface CartItemView {
  id: number;
  variantId: number;
  productName: string;
  productSlug: string;
  productImage: string | null;
  weightGram: number;
  unitPrice: number;
  quantity: number;
  total: number;
  available: boolean;
  stockProblem?: 'OUT_OF_STOCK' | 'INSUFFICIENT';
}

export interface CartView {
  items: CartItemView[];
  itemsTotal: number;
}

/** POST /coupons/validate — finalAmount excludes shipping (BE-REQ-04). */
export interface CouponPreview {
  code: string;
  discountAmount: number;
  finalAmount: number;
}

export interface OrderItemRow {
  id: number;
  productName: string;
  weightGram: number;
  unitPrice: number;
  quantity: number;
  total: number;
  variantId?: number;
  orderId?: number;
}

export interface PaymentRow {
  id: number;
  orderId: number;
  amount: number;
  gateway: string;
  status: PaymentStatus;
  gatewayRef: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface OrderTotals {
  itemsTotal: number;
  discountAmount: number;
  shippingCost: number;
  finalAmount: number;
}

/** GET /orders item. */
export interface OrderSummary extends OrderTotals {
  id: number;
  orderNumber: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  items: Pick<OrderItemRow, 'id' | 'productName' | 'weightGram' | 'unitPrice' | 'quantity' | 'total'>[];
  payments: { status: PaymentStatus }[];
}

export interface AddressSnapshot {
  title: string;
  receiverName: string;
  receiverPhone: string;
  province: string;
  city: string;
  fullAddress: string;
  postalCode: string | null;
}

/** GET /orders/:id */
export interface OrderDetail extends OrderTotals {
  id: number;
  orderNumber: string;
  userId: number;
  addressSnapshot: AddressSnapshot;
  status: OrderStatus;
  shippingMethod: string | null;
  trackingCode: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  note: string | null;
  couponId: number | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItemRow[];
  payments: PaymentRow[];
}

/** GET /medicines item (Prisma scalars + petTypes). */
export interface Medicine {
  id: number;
  name: string;
  activeIngredient: string | null;
  type: string | null;
  brand: string | null;
  usage: string | null;
  notes: string | null;
  requiresPrescription: boolean;
  image: string | null;
  isActive: boolean;
  petTypes: { id: number; name: string }[];
}

/** GET /medicines/:id — adds the server-supplied disclaimer and pharmacies. */
export interface MedicineDetail extends Medicine {
  disclaimer: string;
  pharmacies: {
    id: number;
    name: string;
    city: string;
    address: string;
    phone: string | null;
    is24h: boolean;
    isVerified: boolean;
    lastConfirmedAt: string;
    note: string | null;
  }[];
}

/** GET /pharmacies */
export interface Pharmacy {
  id: number;
  name: string;
  city: string;
  province: string;
  address: string;
  phone: string | null;
  is24h: boolean;
  isVerified: boolean;
}

/** GET /pharmacies/:id */
export interface PharmacyDetail extends Pharmacy {
  lat: number | null;
  lng: number | null;
  workingHours: string | null;
}

/** GET /health */
export interface HealthResult {
  status: string;
}

/** POST /upload/image */
export interface UploadResult {
  url: string;
}

