import { useEffect, useRef } from 'react';
import type { CartView } from '../api/types';
import { shippingEstimate } from '../features/cart/cart-state';
import { FREE_SHIPPING_THRESHOLD } from '../lib/constants';
import { formatToman } from '../lib/format';
import '../styles/commerce-checkout-experience.css';

export function ShippingProgress({ cart }: { cart?: CartView }) {
  const serverThreshold = cart?.estimate?.freeShippingThreshold;
  const hasServerThreshold = typeof serverThreshold === 'number' && Number.isSafeInteger(serverThreshold) && serverThreshold >= 0;
  const threshold = hasServerThreshold ? serverThreshold : FREE_SHIPPING_THRESHOLD;
  const total = Number.isSafeInteger(cart?.itemsTotal) && (cart?.itemsTotal ?? -1) >= 0 ? cart!.itemsTotal : 0;
  const remaining = Math.max(0, threshold - total);
  const percentage = threshold === 0 ? 100 : Math.min(100, (total / threshold) * 100);
  const shipping = shippingEstimate(cart);
  const eligible = remaining === 0 && shipping.cost === 0;
  const hasCart = cart !== undefined;
  const previousEligible = useRef<boolean | null>(hasCart ? eligible : null);
  const truck = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const crossed = previousEligible.current === false && eligible;
    previousEligible.current = hasCart ? eligible : null;
    if (!crossed || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.hidden) return;
    const animation = truck.current?.animate?.([
      { transform: 'translateY(0) rotate(0)' },
      { transform: 'translateY(-4px) rotate(-5deg)', offset: .25 },
      { transform: 'translateY(0) rotate(3deg)', offset: .55 },
      { transform: 'translateY(-1px) rotate(-1deg)', offset: .78 },
      { transform: 'translateY(0) rotate(0)' },
    ], { duration: 680, easing: 'cubic-bezier(.22,1,.36,1)' });
    return () => animation?.cancel();
  }, [hasCart, eligible]);
  const message = shipping.cost === 0 ? 'ارسال برآوردی رایگان است.'
    : remaining > 0 ? `${formatToman(remaining)} تا ارسال رایگان`
    : 'آستانه تکمیل شد؛ هزینهٔ ارسال را در خلاصه بررسی کنید.';
  return <section className="commerce-shipping" aria-label="برآورد ارسال رایگان" data-eligible={eligible}>
    <div className="commerce-shipping__heading">
      <p aria-live="polite">{message}</p>
      <small>{hasServerThreshold && shipping.source === 'server' ? 'برآورد سامانه' : 'برآورد اولیه'} · پیش از تخفیف</small>
    </div>
    <div className="commerce-shipping__meter">
      <div className="commerce-shipping__track" role="progressbar" aria-label="پیشرفت تا آستانهٔ ارسال رایگان"
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percentage)} aria-valuetext={message}>
        <span style={{ transform: `scaleX(${percentage / 100})` }} />
      </div>
      <svg ref={truck} className="commerce-shipping__truck" viewBox="0 0 28 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        <path d="M11 5h14v13H11M11 10H6l-4 5v3h4m5 0H9M6 10v5H2M23 18h-2" />
        <circle cx="8" cy="19" r="2.5" /><circle cx="19" cy="19" r="2.5" />
        <path d="M16 9h5M16 12h3" />
      </svg>
    </div>
  </section>;
}
