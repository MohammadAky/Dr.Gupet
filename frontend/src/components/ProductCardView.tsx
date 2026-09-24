import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { ProductCard } from '../api/types';
import { formatToman } from '../lib/format';
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
  return (
    <article className="product-card" data-product-id={card.id}>
      <Link to={`/products/${card.slug}`} className="product-card__link">
        {card.image ? (
          <img src={card.image} alt={card.name} loading="lazy" />
        ) : (
          <span className="product-card__placeholder" aria-hidden="true" />
        )}
        <h3>{card.name}</h3>
        <p>{card.brand.name}</p>
        <p dir="ltr">{formatToman(card.minPrice)}</p>
        <p>{card.inStock ? 'موجود' : 'ناموجود'}</p>
        <p>
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
