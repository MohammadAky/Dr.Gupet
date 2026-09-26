/**
 * Central query-key registry — the only place where cache keys are defined
 * (convention §5.7). Mutations invalidate the affected keys explicitly.
 */
export const queryKeys = {
  health: ['health'] as const,
  me: ['me'] as const,
  addresses: ['addresses'] as const,
  petTypes: ['pet-types'] as const,
  breeds: (petTypeId: number) => ['breeds', petTypeId] as const,
  tags: (type?: string) => ['tags', type ?? 'ALL'] as const,
  pets: ['pets'] as const,
  pet: (id: number) => ['pets', id] as const,
  brands: ['brands'] as const,
  categories: (petTypeId?: number) => ['categories', petTypeId ?? 'all'] as const,
  products: (filters: Record<string, unknown>) => ['products', filters] as const,
  product: (slug: string) => ['products', 'detail', slug] as const,
  recommendations: (petId: number, page: number) => ['recommendations', petId, page] as const,
  favorites: (page: number) => ['favorites', page] as const,
  cart: ['cart'] as const,
  orders: (page: number) => ['orders', page] as const,
  order: (id: number) => ['orders', 'detail', id] as const,
  medicines: (filters: Record<string, unknown>) => ['medicines', filters] as const,
  medicine: (id: number) => ['medicines', id] as const,
  pharmacies: (filters: Record<string, unknown>) => ['pharmacies', filters] as const,
  pharmacy: (id: number) => ['pharmacies', id] as const,
};
