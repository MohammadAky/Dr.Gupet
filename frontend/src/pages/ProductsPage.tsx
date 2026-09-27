import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { type FormEvent, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { shopApi } from '../api/endpoints-shop';
import { queryKeys } from '../api/query-keys';
import { api } from '../api/endpoints';
import { Pagination } from '../components/Pagination';
import { ProductCardView } from '../components/ProductCardView';
import { SearchableFilter } from '../components/SearchableFilter';
import { EmptyState, ErrorState, LoadingState } from '../components/states';
import { parseProductFilters, serializeProductFilters } from '../features/catalog/filters';
import { toEnDigits } from '../lib/format';

/**
 * Catalog list. All filters live in the URL (convention §5.5), so the list is
 * shareable and the browser back button works.
 */
export function ProductsPage() {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => parseProductFilters(params), [params]);

  const searchFormRef = useRef<HTMLFormElement>(null);
  const priceFormRef = useRef<HTMLFormElement>(null);

  const petTypes = useQuery({ queryKey: queryKeys.petTypes, queryFn: () => api.petTypes() });
  const brands = useQuery({ queryKey: queryKeys.brands, queryFn: () => shopApi.brands() });

  const products = useQuery({
    queryKey: queryKeys.products({ ...filters }),
    queryFn: () => shopApi.products(filters),
    placeholderData: keepPreviousData,
  });

  function patch(next: Parameters<typeof serializeProductFilters>[1]) {
    setParams(serializeProductFilters(params, next));
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const search = String(new FormData(event.currentTarget).get('q') ?? '').trim();
    patch({ q: search || undefined });
  }

  function submitPrices(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parse = (value: string) => {
      const digits = toEnDigits(value.trim());
      if (!digits) return undefined;
      const normalized = Number(digits);
      return Number.isFinite(normalized) && normalized >= 0 ? normalized : undefined;
    };
    const values = new FormData(event.currentTarget);
    patch({
      minPrice: parse(String(values.get('minPrice') ?? '')),
      maxPrice: parse(String(values.get('maxPrice') ?? '')),
    });
  }

  function clearFilters() {
    setParams(new URLSearchParams());
    searchFormRef.current?.reset();
    priceFormRef.current?.reset();
  }

  return (
    <section>
      <h1>محصولات</h1>

      <form className="catalog-search" ref={searchFormRef} onSubmit={submitSearch}>
        <label htmlFor="q">جستجو</label>
        <input id="q" name="q" key={filters.q ?? ''} defaultValue={filters.q ?? ''} />
        <button type="submit" className="filter-apply">
          جستجو
        </button>
      </form>

      <div className="filters filter-panel">
        <div className="filter-panel__grid">
          <SearchableFilter
            label="نوع حیوان"
            value={String(filters.petTypeId ?? '')}
            options={[
              { value: '', label: 'همهٔ حیوانات' },
              ...(petTypes.data ?? []).map((type) => ({
                value: String(type.id),
                label: type.name,
              })),
            ]}
            onSelect={(value) => patch({ petTypeId: value ? Number(value) : undefined })}
          />
          <SearchableFilter
            label="برند"
            value={String(filters.brandId ?? '')}
            options={[
              { value: '', label: 'همهٔ برندها' },
              ...(brands.data ?? []).map((brand) => ({
                value: String(brand.id),
                label: brand.name,
              })),
            ]}
            onSelect={(value) => patch({ brandId: value ? Number(value) : undefined })}
          />
          <SearchableFilter
            label="سن"
            value={filters.lifeStage ?? ''}
            options={[
              { value: '', label: 'همهٔ سن‌ها' },
              { value: 'PUPPY_KITTEN', label: 'توله/بچه گربه' },
              { value: 'ADULT', label: 'بالغ' },
              { value: 'SENIOR', label: 'سالمند' },
            ]}
            onSelect={(value) => patch({ lifeStage: value || undefined })}
          />
          <SearchableFilter
            label="سایز"
            value={filters.sizeClass ?? ''}
            options={[
              { value: '', label: 'همهٔ سایزها' },
              { value: 'SMALL', label: 'کوچک' },
              { value: 'MEDIUM', label: 'متوسط' },
              { value: 'LARGE', label: 'بزرگ' },
            ]}
            onSelect={(value) => patch({ sizeClass: value || undefined })}
          />
          <SearchableFilter
            label="مرتب‌سازی"
            value={filters.sort ?? 'newest'}
            options={[
              { value: 'newest', label: 'جدیدترین' },
              { value: 'price_asc', label: 'ارزان‌ترین' },
              { value: 'price_desc', label: 'گران‌ترین' },
            ]}
            onSelect={(value) => patch({ sort: value })}
          />
        </div>

        <label className="filter-check">
          <input
            type="checkbox"
            checked={filters.inStock === true}
            onChange={(event) => patch({ inStock: event.target.checked })}
          />
          فقط موجود
        </label>

        <form className="price-filter" ref={priceFormRef} onSubmit={submitPrices}>
          <label htmlFor="minPrice">از قیمت</label>
          <input
            id="minPrice"
            name="minPrice"
            dir="ltr"
            key={`min-${filters.minPrice ?? ''}`}
            defaultValue={filters.minPrice ?? ''}
          />
          <label htmlFor="maxPrice">تا قیمت</label>
          <input
            id="maxPrice"
            name="maxPrice"
            dir="ltr"
            key={`max-${filters.maxPrice ?? ''}`}
            defaultValue={filters.maxPrice ?? ''}
          />
          <button type="submit" className="filter-apply">
            اعمال قیمت
          </button>
        </form>

        <button type="button" className="filter-clear" onClick={clearFilters}>
          پاک‌کردن فیلترها
        </button>
      </div>

      {products.isLoading && <LoadingState />}
      {products.error && (
        <ErrorState error={products.error} onRetry={() => void products.refetch()} />
      )}
      {products.data && products.data.data.length === 0 && (
        <EmptyState
          text="محصولی با این فیلترها پیدا نشد."
          action={
            <button type="button" onClick={clearFilters}>
              پاک‌کردن فیلترها
            </button>
          }
        />
      )}
      {products.data && products.data.data.length > 0 && (
        <>
          <div className="product-grid">
            {products.data.data.map((card) => (
              <ProductCardView key={card.id} card={card} />
            ))}
          </div>
          <Pagination meta={products.data.meta} />
        </>
      )}
    </section>
  );
}
