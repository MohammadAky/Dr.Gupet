import { describe, expect, it } from 'vitest';
import { parseProductFilters, serializeProductFilters } from './filters';

describe('parseProductFilters', () => {
  it('defaults page and limit', () => {
    const filters = parseProductFilters(new URLSearchParams());
    expect(filters.page).toBe(1);
    expect(filters.limit).toBe(20);
    expect(filters.inStock).toBeUndefined();
  });

  it('clamps limit to the backend maximum (50)', () => {
    const filters = parseProductFilters(new URLSearchParams('limit=500'));
    expect(filters.limit).toBe(50);
  });

  it('reads every supported filter', () => {
    const filters = parseProductFilters(
      new URLSearchParams(
        'page=2&q=غذا&petTypeId=1&categorySlug=dog-dry-food&brandId=3&lifeStage=ADULT&sizeClass=SMALL&tagIds=4,5&minPrice=1000&maxPrice=90000&sort=price_asc&inStock=1',
      ),
    );
    expect(filters).toMatchObject({
      page: 2,
      q: 'غذا',
      petTypeId: 1,
      categorySlug: 'dog-dry-food',
      brandId: 3,
      lifeStage: 'ADULT',
      sizeClass: 'SMALL',
      tagIds: '4,5',
      minPrice: 1000,
      maxPrice: 90000,
      sort: 'price_asc',
      inStock: true,
    });
  });

  it('ignores unknown sort values and malformed numbers', () => {
    const filters = parseProductFilters(new URLSearchParams('sort=hack&petTypeId=abc&page=-3'));
    expect(filters.sort).toBeUndefined();
    expect(filters.petTypeId).toBeUndefined();
    expect(filters.page).toBe(1);
  });

  it('preserves zero-price boundaries without treating them as empty filters', () => {
    expect(parseProductFilters(new URLSearchParams('minPrice=0&maxPrice=0'))).toMatchObject({
      minPrice: 0,
      maxPrice: 0,
    });
    const url = serializeProductFilters(new URLSearchParams('page=3'), {
      minPrice: 0,
      maxPrice: 0,
    });
    expect(url.get('minPrice')).toBe('0');
    expect(url.get('maxPrice')).toBe('0');
    expect(url.has('page')).toBe(false);
  });

  it.each(['1.5', '-1', 'Infinity', '9007199254740992'])(
    'does not send invalid integer identities, pagination or money from the URL: %s',
    (value) => {
      const filters = parseProductFilters(
        new URLSearchParams({
          page: value,
          limit: value,
          petTypeId: value,
          brandId: value,
          minPrice: value,
          maxPrice: value,
        }),
      );
      expect(filters.page).toBe(1);
      expect(filters.limit).toBe(20);
      expect(filters.petTypeId).toBeUndefined();
      expect(filters.brandId).toBeUndefined();
      expect(filters.minPrice).toBeUndefined();
      expect(filters.maxPrice).toBeUndefined();
    },
  );
});

describe('serializeProductFilters', () => {
  it('drops cleared values and resets the page', () => {
    const current = new URLSearchParams('page=5&q=foo&brandId=2');
    const next = serializeProductFilters(current, { q: undefined, brandId: 7 });
    expect(next.get('q')).toBeNull();
    expect(next.get('brandId')).toBe('7');
    expect(next.get('page')).toBeNull();
  });

  it('keeps the page when only the page changes', () => {
    const current = new URLSearchParams('q=foo');
    const next = serializeProductFilters(current, { page: 3 });
    expect(next.get('page')).toBe('3');
  });

  it('serializes inStock=true as 1 and false as absent (BE-REQ-03)', () => {
    expect(serializeProductFilters(new URLSearchParams(), { inStock: true }).get('inStock')).toBe(
      '1',
    );
    expect(
      serializeProductFilters(new URLSearchParams('inStock=1'), { inStock: false }).get('inStock'),
    ).toBeNull();
  });
});
