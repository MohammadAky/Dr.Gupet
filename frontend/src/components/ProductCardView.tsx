import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { ProductCard } from '../api/types';
import { formatToman } from '../lib/format';
import { API_BASE_URL } from '../lib/env';
import { safeImageUrl } from '../lib/image-url';
import { LIFE_STAGE_FA, SIZE_CLASS_FA } from '../lib/labels';
import { SafeImage } from './SafeImage';
import { isSampleProduct, publicRecordName } from '../lib/sample-records';
import '../styles/product-card-hover.css';

function ProductCardMedia({ image, alternate, name }: { image: string | null; alternate: string | null; name: string }) {
  const [requested, setRequested] = useState(false);
  const [ready, setReady] = useState(false);
  return <div className="product-card__media" data-alternate-ready={ready}
    onPointerEnter={event => {
      if (event.pointerType === 'touch' || !alternate || alternate === image) return;
      if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) setRequested(true);
    }}>
    <SafeImage src={image ?? undefined} alt={name} loading="lazy"
      sizes="(max-width: 760px) calc((100vw - 52px) / 2), (max-width: 1000px) 45vw, 320px" referrerPolicy="no-referrer" />
    {requested && alternate && <SafeImage src={alternate} alt="" className="product-card__alternate" aria-hidden="true"
      loading="eager" referrerPolicy="no-referrer" fallback={null} onLoad={() => setReady(true)} onError={() => setReady(false)} />}
  </div>;
}

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
  const hoverUrl = safeImageUrl(card.hoverImage, window.location.origin, API_BASE_URL);
  const sample = isSampleProduct(card);
  return (
    <article className="product-card" data-product-id={card.id}>
      <Link to={`/products/${card.slug}`} className="product-card__link">
        <ProductCardMedia key={`${imageUrl}|${hoverUrl}`} image={imageUrl} alternate={hoverUrl} name={publicRecordName(card)} />
        <h3>{publicRecordName(card)}</h3>
        <p className="product-card__brand">{publicRecordName({ ...card.brand, isSample: sample })}</p>
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
            {card.inStock && !sample ? 'موجود' : 'ناموجود'}
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
