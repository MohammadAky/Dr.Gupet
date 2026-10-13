import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { ProductCard } from '../api/types';
import { formatToman } from '../lib/format';
import { API_BASE_URL } from '../lib/env';
import { safeImageUrl } from '../lib/image-url';
import { LIFE_STAGE_FA, SIZE_CLASS_FA } from '../lib/labels';
import { SafeImage } from './SafeImage';
import { isSampleProduct } from '../lib/sample-records';

/**
 * The single product card renderer used by home, catalog, favorites and
 * recommendations. Only behaviour and data — no visual decisions.
 */
export function ProductCardView({
  card,
  matchedTags,
  actions,
}: {
  card: ProductCard;
  matchedTags?: string[];
  actions?: ReactNode;
}) {
  const imageUrl = safeImageUrl(card.image, window.location.origin, API_BASE_URL);
  const sample = isSampleProduct(card);
  return (
    <article className="product-card" data-product-id={card.id}>
      <Link to={`/products/${card.slug}`} className="product-card__link">
        <div className="product-card__media">
          <SafeImage
            src={imageUrl ?? undefined}
            alt={card.name}
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        </div>
        <h3>{card.name}</h3>
        <p className="product-card__brand">{card.brand.name}</p>
        <div className="product-card__bottom">
          <div className="product-card__prices">
            {typeof card.compareAtPrice === 'number' && card.compareAtPrice > card.minPrice && (
              <del className="product-card__compare" aria-label="قیمت پیشین">
                {formatToman(card.compareAtPrice)}
              </del>
            )}
            <p className="product-card__price">{formatToman(card.minPrice)}</p>
          </div>
          <span className={`stock-pill${card.inStock && !sample ? '' : ' stock-pill--out'}`}>
            {sample ? 'نمونهٔ نمایشی؛ غیرقابل خرید' : card.inStock ? 'موجود' : 'ناموجود'}
          </span>
        </div>
        <p className="product-card__meta">
          {LIFE_STAGE_FA[card.lifeStage]} · {SIZE_CLASS_FA[card.sizeClass]}
        </p>
      </Link>
      {matchedTags && matchedTags.length > 0 && (
        <ul className="matched-tags" aria-label="برچسب‌های مناسب">
          {matchedTags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
      )}
      {actions}
    </article>
  );
}
