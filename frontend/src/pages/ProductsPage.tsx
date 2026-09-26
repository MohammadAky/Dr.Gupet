import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { type FormEvent, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { shopApi } from '../api/endpoints-shop';
import { queryKeys } from '../api/query-keys';
import { api } from '../api/endpoints';
import { Pagination } from '../components/Pagination';
import { ProductCardView } from '../components/ProductCardView';
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

      <form ref={searchFormRef} onSubmit={submitSearch}>
        <label htmlFor="q">جستجو</label>
        <input id="q" name="q" key={filters.q ?? ''} defaultValue={filters.q ?? ''} />
        <button type="submit">جستجو</button>
      </form>

      <div className="filters">
        <label htmlFor="petType">نوع حیوان</label>
        <select
          id="petType"
          value={filters.petTypeId ?? ''}
          onChange={(event) =>
            patch({ petTypeId: event.target.value ? Number(event.target.value) : undefined })
          }
        >
          <option value="">همه</option>
          {petTypes.data?.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </select>

        <label htmlFor="brand">برند</label>
        <select
          id="brand"
          value={filters.brandId ?? ''}
          onChange={(event) =>
            patch({ brandId: event.target.value ? Number(event.target.value) : undefined })
          }
        >
          <option value="">همه</option>
          {brands.data?.map((brand) => (
            <option key={brand.id} value={brand.id}>
              {brand.name}
            </option>
          ))}
        </select>

        <label htmlFor="lifeStage">سن</label>
        <select
          id="lifeStage"
          value={filters.lifeStage ?? ''}
          onChange={(event) => patch({ lifeStage: event.target.value || undefined })}
        >
          <option value="">همه</option>
          <option value="PUPPY_KITTEN">توله/بچه گربه</option>
          <option value="ADULT">بالغ</option>
          <option value="SENIOR">سالمند</option>
        </select>

        <label htmlFor="sizeClass">سایز</label>
        <select
          id="sizeClass"
          value={filters.sizeClass ?? ''}
          onChange={(event) => patch({ sizeClass: event.target.value || undefined })}
        >
          <option value="">همه</option>
          <option value="SMALL">کوچک</option>
          <option value="MEDIUM">متوسط</option>
          <option value="LARGE">بزرگ</option>
        </select>

        <label htmlFor="sort">مرتب‌سازی</label>
        <select
          id="sort"
          value={filters.sort ?? 'newest'}
          onChange={(event) => patch({ sort: event.target.value })}
        >
          <option value="newest">جدیدترین</option>
          <option value="price_asc">ارزان‌ترین</option>
          <option value="price_desc">گران‌ترین</option>
        </select>

        <label>
          <input
            type="checkbox"
            checked={filters.inStock === true}
            onChange={(event) => patch({ inStock: event.target.checked })}
          />
          فقط موجود
        </label>

        <form ref={priceFormRef} onSubmit={submitPrices}>
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
          <button type="submit">اعمال قیمت</button>
        </form>

        <button type="button" onClick={clearFilters}>
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
