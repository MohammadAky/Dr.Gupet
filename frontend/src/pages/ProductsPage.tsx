import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useSearchParams } from 'react-router-dom';
import { shopApi } from '../api/endpoints-shop';
import { queryKeys } from '../api/query-keys';
import { api } from '../api/endpoints';
import { ProductCardView } from '../components/ProductCardView';
import { CatalogFilters, type CatalogFilterSection } from '../components/CatalogFilters';
import { Dialog } from '../components/ui';
import { EmptyState, ErrorState, LoadingState } from '../components/states';
import { parseProductFilters, serializeProductFilters } from '../features/catalog/filters';
import '../styles/content-pages.css';
import '../styles/catalog-layout.css';

const BATCH_SIZE = 24;
const PHONE_QUERY = '(max-width: 900px)';
function subscribeSize(callback: () => void) {
  const media = window.matchMedia?.(PHONE_QUERY);
  media?.addEventListener('change', callback);
  return () => media?.removeEventListener('change', callback);
}
const phoneSnapshot = () => window.matchMedia?.(PHONE_QUERY).matches ?? false;

/** Shareable filters with one continuous, progressively requested catalog. */
export function ProductsPage() {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => parseProductFilters(params), [params]);
  const requestFilters = { ...filters, page: undefined, limit: BATCH_SIZE };
  const isPhone = useSyncExternalStore(subscribeSize, phoneSnapshot, () => false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [openedSection, setOpenedSection] = useState<CatalogFilterSection | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const activeCount = [filters.petTypeId, filters.brandId, filters.categorySlug, filters.lifeStage,
    filters.sizeClass, filters.inStock, filters.minPrice !== undefined,
    filters.maxPrice !== undefined].filter(Boolean).length + (filters.tagIds ?? '').split(',').filter(Boolean).length;
  const petTypes = useQuery({ queryKey: queryKeys.petTypes, queryFn: () => api.petTypes() });
  const brands = useQuery({ queryKey: queryKeys.brands, queryFn: () => shopApi.brands() });
  const dietTags = useQuery({ queryKey: queryKeys.tags('DIET'), queryFn: () => api.tags('DIET') });
  const products = useInfiniteQuery({
    queryKey: queryKeys.productsInfinite(requestFilters),
    queryFn: ({ pageParam }) => shopApi.products({ ...requestFilters, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: last => last.meta && last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined,
    retry: false,
  });
  const cards = useMemo(() => {
    const unique = new Set<number>();
    return (products.data?.pages.flatMap(page => page.data) ?? []).filter(card => {
      if (unique.has(card.id)) return false;
      unique.add(card.id); return true;
    });
  }, [products.data]);
  const { hasNextPage, isFetching, isFetchNextPageError, fetchNextPage } = products;
  useEffect(() => {
    if (!sentinel.current || !hasNextPage || isFetching || isFetchNextPageError ||
        typeof IntersectionObserver === 'undefined') return;
    let requested = false;
    const observer = new IntersectionObserver(entries => {
      if (!requested && entries.some(entry => entry.isIntersecting)) {
        requested = true; void fetchNextPage();
      }
    }, { rootMargin: '180px 0px' });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetching, isFetchNextPageError, fetchNextPage]);
  function patch(next: Parameters<typeof serializeProductFilters>[1]) {
    setParams(serializeProductFilters(params, next));
  }
  function clearFilters() { setParams(new URLSearchParams()); }
  function openDrawer(section: CatalogFilterSection | null) {
    setOpenedSection(section); setDrawerOpen(true);
  }
  const filterPanel = <CatalogFilters filters={filters} onPatch={patch} onClear={clearFilters}
    activeCount={activeCount} openedSection={openedSection} onOpenSection={setOpenedSection}
    petTypes={petTypes.data ?? []} brands={brands.data ?? []} dietTags={dietTags.data ?? []}
    referencesPending={petTypes.isPending || brands.isPending || dietTags.isPending}
    referencesError={petTypes.isError || brands.isError || dietTags.isError}
    onRetry={() => { void petTypes.refetch(); void brands.refetch(); void dietTags.refetch(); }} />;
  return <section className="catalog-page">
    <nav className="catalog-breadcrumb" aria-label="مسیر صفحه">
      <span>فروشگاه دکتر گوپت</span><span aria-hidden="true">/</span><h1>محصولات</h1>
    </nav>
    {filters.q && <p className="catalog-search-context">نتایج جستجوی «{filters.q}»
      <button type="button" onClick={() => patch({ q: undefined })}>حذف جستجو</button>
    </p>}
    {isPhone && <div className="catalog-mobile-tools">
      <div className="catalog-chip-rail" aria-label="فیلتر و مرتب‌سازی">
        <button type="button" onClick={() => openDrawer('sort')}>مرتب‌سازی <span aria-hidden="true">⇅</span></button>
        <button type="button" onClick={() => openDrawer(null)}>فیلترها{activeCount ? ' · ' + activeCount.toLocaleString('fa-IR') : ''} <span aria-hidden="true">☷</span></button>
        <button type="button" onClick={() => openDrawer('price')}>محدودهٔ قیمت</button>
        <button type="button" onClick={() => openDrawer('diet')}>نیازهای غذایی</button>
      </div>
      <div className="catalog-chip-rail" aria-label="فیلترهای پرکاربرد حیوانات">
        <button type="button" aria-pressed={filters.inStock === true} onClick={() => patch({ inStock: !filters.inStock })}>فقط موجود</button>
        {petTypes.data?.map(type => <button type="button" key={type.id} aria-pressed={filters.petTypeId === type.id}
          onClick={() => patch({ petTypeId: filters.petTypeId === type.id ? undefined : type.id })}>{type.name}</button>)}
        <button type="button" aria-pressed={filters.lifeStage === 'PUPPY_KITTEN'} onClick={() => patch({ lifeStage: filters.lifeStage === 'PUPPY_KITTEN' ? undefined : 'PUPPY_KITTEN' })}>توله و بچه گربه</button>
        <button type="button" aria-pressed={filters.lifeStage === 'ADULT'} onClick={() => patch({ lifeStage: filters.lifeStage === 'ADULT' ? undefined : 'ADULT' })}>بالغ</button>
        <button type="button" onClick={() => openDrawer('brand')}>برند</button>
      </div>
    </div>}
    <div className="catalog-layout">
      {!isPhone && <aside className="catalog-sidebar" aria-label="فیلتر محصولات">{filterPanel}</aside>}
      <div className="catalog-results" aria-label="نتایج محصولات">
        <div className="catalog-results__heading">
          <p className="directory-results" role="status">{products.data?.pages[0]?.meta
            ? products.data.pages[0].meta.total.toLocaleString('fa-IR') + ' محصول' : 'محصولات فروشگاه'}</p>
          {!isPhone && <span className="catalog-sort-label">{filters.sort === 'price_asc' ? 'ارزان‌ترین' : filters.sort === 'price_desc' ? 'گران‌ترین' : 'جدیدترین'}</span>}
        </div>
        {products.isPending && <LoadingState layout="cards" />}
        {products.error && !products.data && <ErrorState error={products.error} onRetry={() => void products.refetch()} />}
        {products.isRefetchError && !products.isFetchNextPageError && products.data && <div role="alert" className="catalog-refresh-error">
          <p>تازه‌سازی محصولات انجام نشد؛ قیمت و موجودی نمایش‌داده‌شده ممکن است تغییر کرده باشند.</p>
          <button type="button" onClick={() => void products.refetch()}>تلاش دوباره برای تازه‌سازی</button>
        </div>}
        {products.isSuccess && cards.length === 0 && <EmptyState text="محصولی با این فیلترها پیدا نشد."
          action={<button type="button" onClick={clearFilters}>پاک‌کردن فیلترها</button>} />}
        {cards.length > 0 && <div className="product-grid">{cards.map(card => <ProductCardView key={card.id} card={card} />)}</div>}
        <div ref={sentinel} className="catalog-load-more" aria-live="polite">
          {products.isFetchingNextPage && <LoadingState text="در حال دریافت محصولات بیشتر…" />}
          {products.isFetchNextPageError && <p role="alert">دریافت ادامهٔ محصولات ممکن نشد؛ محصولات قبلی حفظ شده‌اند.</p>}
          {products.hasNextPage && <button type="button" className="filter-clear" disabled={products.isFetching}
            onClick={() => void products.fetchNextPage()}>{products.isFetchNextPageError ? 'تلاش دوباره برای ادامه' : 'نمایش محصولات بیشتر'}</button>}
          {!products.hasNextPage && cards.length > 0 && <p>همهٔ محصولات نمایش داده شدند.</p>}
        </div>
      </div>
    </div>
    <Dialog open={isPhone && drawerOpen} title="فیلتر محصولات" variant="drawer" onClose={() => setDrawerOpen(false)}>
      {filterPanel}
      <button type="button" className="ui-button ui-button--primary catalog-drawer-apply" onClick={() => setDrawerOpen(false)}>مشاهدهٔ نتایج</button>
    </Dialog>
  </section>;
}
