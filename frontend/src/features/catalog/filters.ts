import type { ProductFilters } from '../../api/endpoints-shop';
import { DEFAULT_PAGE_LIMIT } from '../../lib/constants';

/**
 * URL ↔ API filter mapping for the catalog. Pure functions so they can be
 * unit-tested and reused by deep links, the back button and shareable URLs.
 */
export function parseProductFilters(params: URLSearchParams): ProductFilters {
  const num = (key: string): number | undefined => {
    const raw = params.get(key);
    if (!raw) return undefined;
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : undefined;
  };

  const sort = params.get('sort');
  const filters: ProductFilters = {
    page: num('page') ?? 1,
    limit: Math.min(num('limit') ?? DEFAULT_PAGE_LIMIT, 50),
    q: params.get('q') ?? undefined,
    petTypeId: num('petTypeId'),
    categorySlug: params.get('categorySlug') ?? undefined,
    brandId: num('brandId'),
    lifeStage: params.get('lifeStage') ?? undefined,
    sizeClass: params.get('sizeClass') ?? undefined,
    tagIds: params.get('tagIds') ?? undefined,
    minPrice: num('minPrice'),
    maxPrice: num('maxPrice'),
    sort: sort === 'price_asc' || sort === 'price_desc' || sort === 'newest' ? sort : undefined,
  };

  // BE-REQ-03: only `inStock=true` is a reliable signal today.
  filters.inStock = params.get('inStock') === '1' || params.get('inStock') === 'true';

  if (!filters.inStock) filters.inStock = undefined;
  return filters;
}

/** Serializes a patch of filters into a fresh URLSearchParams (page resets to 1). */
export function serializeProductFilters(
  current: URLSearchParams,
  patch: Partial<ProductFilters>,
): URLSearchParams {
  const next = new URLSearchParams(current);

  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === null || value === '' || value === false) next.delete(key);
    else next.set(key, String(value));
  }

  const touchedWithoutPage = Object.keys(patch).some((key) => key !== 'page');
  if (touchedWithoutPage) next.delete('page');

  if (patch.inStock) next.set('inStock', '1');
  return next;
}
