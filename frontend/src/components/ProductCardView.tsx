import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { ProductCard } from '../api/types';
import { formatToman } from '../lib/format';
import { API_BASE_URL } from '../lib/env';
import { safeImageUrl } from '../lib/image-url';
import { LIFE_STAGE_FA, SIZE_CLASS_FA } from '../lib/labels';

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
  return (
    <article className="product-card" data-product-id={card.id}>
      <Link to={`/products/${card.slug}`} className="product-card__link">
        <div className="product-card__media">
          {imageUrl ? (
            <img src={imageUrl} alt={card.name} loading="lazy" referrerPolicy="no-referrer" />
          ) : (
            <span className="product-card__placeholder" aria-hidden="true" />
          )}
        </div>
        <h3>{card.name}</h3>
        <p className="product-card__brand">{card.brand.name}</p>
        <div className="product-card__bottom">
          <p className="product-card__price">{formatToman(card.minPrice)}</p>
          <span className={`stock-pill${card.inStock ? '' : ' stock-pill--out'}`}>
            {card.inStock ? 'موجود' : 'ناموجود'}
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
