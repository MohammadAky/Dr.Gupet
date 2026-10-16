import { useQuery } from '@tanstack/react-query';
import { useId } from 'react';
import { Link } from 'react-router-dom';
import { shopApi } from '../api/endpoints-shop';
import type { ProductCard, ProductDetail } from '../api/types';
import { isSampleProduct } from '../lib/sample-records';
import { LandingCarousel } from './LandingCarousel';
import { ProductCardView } from './ProductCardView';
import { ErrorState, LoadingState } from './states';
import '../styles/related-products.css';

function compatible(current: string, candidate: string): boolean {
  return current === 'ALL' || candidate === 'ALL' || current === candidate;
}

/** Category membership comes from the category-filtered public API, not invented card metadata. */
export function rankRelatedProducts(product: ProductDetail, category: ProductCard[], others: ProductCard[]): ProductCard[] {
  const preferred = new Set(category.map(card => card.id));
  const unique = new Map<number, ProductCard>();
  for (const card of [...category, ...others]) {
    if (card.id === product.id || card.slug === product.slug || !card.inStock || isSampleProduct(card)
      || !compatible(product.lifeStage, card.lifeStage) || !compatible(product.sizeClass, card.sizeClass)) continue;
    if (!unique.has(card.id)) unique.set(card.id, card);
  }
  const score = (card: ProductCard) => (preferred.has(card.id) ? 8 : 0)
    + (card.lifeStage === product.lifeStage ? 2 : 0)
    + (card.sizeClass === product.sizeClass ? 2 : 0)
    + (card.brand.id === product.brand.id ? 1 : 0);
  return [...unique.values()].sort((a, b) => score(b) - score(a) || a.id - b.id).slice(0, 12);
}

/** Public catalog similarity, without a personal-profile or purchase-history claim. */
export function RelatedProducts({ product }: { product: ProductDetail }) {
  const titleId = useId();
  const enabled = Number.isSafeInteger(product.id) && product.id > 0
    && Number.isSafeInteger(product.petType.id) && product.petType.id > 0
    && Number.isSafeInteger(product.brand.id) && product.brand.id > 0
    && Number.isSafeInteger(product.category.id) && product.category.id > 0
    && !!product.slug && !!product.category.slug && product.isActive && !isSampleProduct(product);
  const related = useQuery({
    queryKey: ['products', 'related', product.id, product.slug, product.petType.id, product.category.slug,
      product.lifeStage, product.sizeClass, product.brand.id],
    enabled,
    queryFn: async ({ signal }) => {
      const base = {
        petTypeId: product.petType.id, inStock: true, limit: 24, page: 1,
        // The API includes ALL-compatible records and filters before pagination.
        ...(product.lifeStage !== 'ALL' ? { lifeStage: product.lifeStage } : {}),
        ...(product.sizeClass !== 'ALL' ? { sizeClass: product.sizeClass } : {}),
      };
      const [category, fallback] = await Promise.all([
        shopApi.products({ ...base, categorySlug: product.category.slug }),
        shopApi.products(base),
      ]);
      if (signal.aborted) throw new DOMException('Inactive product', 'AbortError');
      return rankRelatedProducts(product, category.data, fallback.data);
    },
  });
  if (!enabled) return null;
  return <section className="related-products" aria-labelledby={titleId}>
    <div className="related-products__heading"><div><h2 id={titleId}>انتخاب‌های مشابه</h2>
      <p>محصولات موجود برای {product.petType.name}، بر پایهٔ دسته‌بندی و ویژگی‌های همین محصول.</p></div>
      <Link to={`/products?petTypeId=${product.petType.id}&inStock=true`}>همهٔ محصولات موجود</Link>
    </div>
    {related.isPending ? <LoadingState layout="cards" />
      : related.error ? <ErrorState error={related.error} onRetry={() => void related.refetch()} />
        : related.data?.length ? <LandingCarousel title="انتخاب‌های مشابه">
          {related.data.map(card => <ProductCardView key={card.id} card={card} actions={
            <Link className="related-products__choose" to={`/products/${card.slug}`} aria-label={`انتخاب ${card.name}`}>انتخاب</Link>
          } />)}
        </LandingCarousel>
          : <p className="related-products__empty">در حال حاضر محصول مشابهِ موجود دیگری پیدا نشد.</p>}
  </section>;
}
