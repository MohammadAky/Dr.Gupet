import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { ProductCard } from '../api/types';
import { formatAmount, toFaDigits } from '../lib/format';
import { API_BASE_URL } from '../lib/env';
import { safeImageUrl } from '../lib/image-url';
import { LIFE_STAGE_FA } from '../lib/labels';
import { SafeImage } from './SafeImage';
import { isSampleProduct, publicRecordName } from '../lib/sample-records';
import { ProductCardQuickAdd } from './ProductCardQuickAdd';
import '../styles/product-card-hover.css';
import '../styles/product-card-anatomy.css';

function ProductCardMedia({
  image,
  alternate,
  name,
}: {
  image: string | null;
  alternate: string | null;
  name: string;
}) {
  const [requested, setRequested] = useState(false);
  const [ready, setReady] = useState(false);
  return (
    <div
      className="product-card__media"
      data-alternate-ready={ready}
      onPointerEnter={(event) => {
        if (event.pointerType === 'touch' || !alternate || alternate === image) return;
        if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) setRequested(true);
      }}
    >
      <SafeImage
        src={image ?? undefined}
        alt={name}
        loading="lazy"
        sizes="(max-width: 760px) calc((100vw - 52px) / 2), (max-width: 1000px) 45vw, 320px"
        referrerPolicy="no-referrer"
      />
      {requested && alternate && (
        <SafeImage
          src={alternate}
          alt=""
          className="product-card__alternate"
          aria-hidden="true"
          loading="eager"
          referrerPolicy="no-referrer"
          fallback={null}
          onLoad={() => setReady(true)}
          onError={() => setReady(false)}
        />
      )}
    </div>
  );
}

/**
 * The single product card renderer used by home, catalog, favorites and
 * recommendations. Prices and availability always come from the public API.
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
  const available = card.inStock && !sample;
  const oldPrice =
    available &&
    Number.isSafeInteger(card.compareAtPrice) &&
    (card.compareAtPrice ?? 0) > card.minPrice &&
    card.minPrice >= 0
      ? card.compareAtPrice!
      : null;
  // Round down so a partial discount can never be presented as a full one.
  const discount =
    oldPrice === null ? null : Math.floor(((oldPrice - card.minPrice) * 100) / oldPrice);
  return (
    <article className="product-card" data-product-id={card.id}>
      <Link to={`/products/${card.slug}`} className="product-card__link">
        <ProductCardMedia
          key={`${imageUrl}|${hoverUrl}`}
          image={imageUrl}
          alternate={hoverUrl}
          name={publicRecordName(card)}
        />
        {discount !== null && <span className="product-card__sale">فروش ویژه</span>}
        <h3>{publicRecordName(card)}</h3>
        <p className="product-card__brand">
          {publicRecordName({ ...card.brand, isSample: sample })}
        </p>
        <p className="product-card__meta">
          {card.petType
            ? `${card.petType.name} (${LIFE_STAGE_FA[card.lifeStage]})`
            : LIFE_STAGE_FA[card.lifeStage]}
        </p>
      </Link>
      <div className="product-card__bottom">
        {available ? (
          <>
            <ProductCardQuickAdd card={card} />
            <div className="product-card__prices">
              {oldPrice !== null && (
                <div className="product-card__discount-row">
                  <span
                    className="product-card__discount"
                    aria-label={`${discount === 0 ? 'کمتر از یک' : toFaDigits(String(discount))} درصد تخفیف`}
                  >
                    {discount === 0 ? 'کمتر از ۱٪' : `${toFaDigits(String(discount))}٪`}
                  </span>
                  <del className="product-card__compare" aria-label="قیمت پیشین" dir="ltr">
                    <span>تومان</span>
                    <bdi>{formatAmount(oldPrice)}</bdi>
                  </del>
                </div>
              )}
              <p className="product-card__price" dir="ltr">
                <span>تومان</span>
                <bdi>{formatAmount(card.minPrice)}</bdi>
              </p>
            </div>
          </>
        ) : (
          <span className="product-card__unavailable">ناموجود</span>
        )}
      </div>
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
