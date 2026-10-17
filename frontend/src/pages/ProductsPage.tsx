import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { type FormEvent, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { shopApi } from '../api/endpoints-shop';
import { queryKeys } from '../api/query-keys';
import { api } from '../api/endpoints';
import { Pagination } from '../components/Pagination';
import { ProductCardView } from '../components/ProductCardView';
import { SearchableFilter } from '../components/SearchableFilter';
import { EmptyState, ErrorState, LoadingState } from '../components/states';
import { parseProductFilters, serializeProductFilters } from '../features/catalog/filters';
import { TomanInput } from '../components/TomanInput';
import { rawTomanInput } from '../lib/toman-input';
import '../styles/content-pages.css';
import '../styles/catalog-layout.css';
import { publicRecordName } from '../lib/sample-records';

/**
 * Catalog list. All filters live in the URL (convention §5.5), so the list is
 * shareable and the browser back button works.
 */
export function ProductsPage() {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => parseProductFilters(params), [params]);

  const searchFormRef = useRef<HTMLFormElement>(null);
  const priceFormRef = useRef<HTMLFormElement>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);
  const selectedTags = (filters.tagIds ?? '')
    .split(',')
    .filter((value) => /^\d+$/.test(value) && Number(value) > 0);
  const activeFilterCount =
    [
      filters.petTypeId,
      filters.brandId,
      filters.lifeStage,
      filters.sizeClass,
      filters.inStock,
      filters.minPrice !== undefined,
      filters.maxPrice !== undefined,
      filters.sort && filters.sort !== 'newest',
    ].filter(Boolean).length + selectedTags.length;

  const petTypes = useQuery({ queryKey: queryKeys.petTypes, queryFn: () => api.petTypes() });
  const brands = useQuery({ queryKey: queryKeys.brands, queryFn: () => shopApi.brands() });
  const dietTags = useQuery({ queryKey: queryKeys.tags('DIET'), queryFn: () => api.tags('DIET') });

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
      const digits = rawTomanInput(value.trim());
      if (!digits || !/^\d+$/.test(digits)) return undefined;
      const normalized = Number(digits);
      return Number.isFinite(normalized) && normalized >= 0 ? normalized : undefined;
    };
    const values = new FormData(event.currentTarget);
    const rawMin = String(values.get('minPrice') ?? '').trim();
    const rawMax = String(values.get('maxPrice') ?? '').trim();
    const minPrice = parse(rawMin);
    const maxPrice = parse(rawMax);
    if (
      (rawMin && !Number.isSafeInteger(minPrice)) ||
      (rawMax && !Number.isSafeInteger(maxPrice)) ||
      (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice)
    ) {
      setPriceError('قیمت باید عدد صحیح و نامنفی باشد و حداقل از حداکثر بیشتر نباشد.');
      return;
    }
    setPriceError(null);
    patch({ minPrice, maxPrice });
  }

  function clearFilters() {
    setParams(new URLSearchParams());
    setPriceError(null);
    searchFormRef.current?.reset();
    priceFormRef.current?.reset();
  }

  return (
    <section className="catalog-page">
      <nav className="catalog-breadcrumb" aria-label="مسیر صفحه">
        <span>فروشگاه دکتر گوپت</span>
        <span aria-hidden="true">/</span>
        <h1>محصولات</h1>
      </nav>

      <div className="catalog-layout">
        <aside className="catalog-sidebar" aria-label="جستجو و فیلتر محصولات">
          <form className="catalog-search" ref={searchFormRef} onSubmit={submitSearch}>
            <label className="sr-only" htmlFor="q">
              جستجو
            </label>
            <input
              id="q"
              name="q"
              placeholder="جستجوی محصول"
              key={filters.q ?? ''}
              defaultValue={filters.q ?? ''}
            />
            <button type="submit" className="filter-apply">
              جستجو
            </button>
          </form>

          <button
            type="button"
            className="catalog-filter-toggle"
            aria-controls="catalog-filter-panel"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((open) => !open)}
          >
            <span>
              فیلتر و مرتب‌سازی
              {activeFilterCount > 0 ? ` · ${activeFilterCount.toLocaleString('fa-IR')} مورد` : ''}
            </span>
            <span aria-hidden="true">{filtersOpen ? '−' : '+'}</span>
          </button>
          <div
            id="catalog-filter-panel"
            className={`filters filter-panel${filtersOpen ? '' : ' filters--collapsed'}`}
          >
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
                    label: publicRecordName(brand),
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

            {(petTypes.error || brands.error) && (
              <ErrorState
                error="دریافت برخی گزینه‌های فیلتر ممکن نشد."
                onRetry={() => {
                  void petTypes.refetch();
                  void brands.refetch();
                }}
              />
            )}
            <fieldset
              className="catalog-diet-tags"
              disabled={dietTags.isPending || dietTags.isError}
            >
              <legend>ویژگی‌های رژیمی</legend>
              {dietTags.isPending && <LoadingState text="در حال دریافت ویژگی‌ها…" />}
              {dietTags.data?.map((tag) => (
                <label key={tag.id} className="filter-check">
                  <input
                    type="checkbox"
                    checked={selectedTags.includes(String(tag.id))}
                    onChange={(event) => {
                      const next = event.target.checked
                        ? [...selectedTags, String(tag.id)]
                        : selectedTags.filter((id) => id !== String(tag.id));
                      patch({ tagIds: next.join(',') || undefined });
                    }}
                  />
                  {tag.name}
                </label>
              ))}
              {dietTags.data?.length === 0 && <p>ویژگی رژیمی در دسترس نیست.</p>}
            </fieldset>
            {dietTags.error && (
              <ErrorState error={dietTags.error} onRetry={() => void dietTags.refetch()} />
            )}

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
              <TomanInput
                id="minPrice"
                name="minPrice"

                aria-invalid={priceError ? true : undefined}
                aria-describedby={priceError ? 'price-filter-error' : undefined}

                key={`min-${filters.minPrice ?? ''}`}
                defaultValue={filters.minPrice ?? ''}
              />
              <label htmlFor="maxPrice">تا قیمت</label>
              <TomanInput
                id="maxPrice"
                name="maxPrice"

                aria-invalid={priceError ? true : undefined}
                aria-describedby={priceError ? 'price-filter-error' : undefined}

                key={`max-${filters.maxPrice ?? ''}`}
                defaultValue={filters.maxPrice ?? ''}
              />
              <button type="submit" className="filter-apply">
                اعمال قیمت
              </button>
            </form>
            {priceError && (
              <p id="price-filter-error" role="alert" className="field__error">
                {priceError}
              </p>
            )}

            <button type="button" className="filter-clear" onClick={clearFilters}>
              پاک‌کردن فیلترها
            </button>
          </div>
        </aside>

        <div className="catalog-results" aria-label="نتایج محصولات">
          {products.isLoading && <LoadingState layout="cards" />}
          {products.data?.meta && (
            <p className="directory-results" role="status">
              {products.data.meta.total.toLocaleString('fa-IR')} محصول
              {products.isFetching ? ' · در حال به‌روزرسانی…' : ''}
            </p>
          )}
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
              <Pagination meta={products.data.meta} busy={products.isFetching} />
            </>
          )}
        </div>
      </div>
    </section>
  );
}
