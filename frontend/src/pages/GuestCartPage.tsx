import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useGuestCart,
  useGuestTransferCheckpoint,
  clearGuestCart,
  removeGuestCartItem,
  setGuestCartQuantity,
  editGuestTransferItem,
  type GuestCartItem,
} from '../features/cart/guest-cart';
import { GUEST_CART_HANDOFF_NOTE } from '../components/GuestCartTransfer';
import { useGuestCartTransferState } from '../features/cart/guest-cart-transfer';
import { QuantityField, parseQuantityInput } from '../components/QuantityField';
import { CommerceSteps } from '../components/CommerceSteps';
import { SafeImage } from '../components/SafeImage';
import { formatToman, formatWeight } from '../lib/format';
import { safeImageUrl } from '../lib/image-url';
import { API_BASE_URL } from '../lib/env';
import '../styles/guest-cart.css';

export function GuestCartPage({
  transferring = false,
  actorId,
}: {
  transferring?: boolean;
  actorId?: number;
}) {
  const items = useGuestCart();
  const checkpoint = useGuestTransferCheckpoint();
  const locked = transferring || checkpoint !== null;
  const transferState = useGuestCartTransferState();
  const canEdit = (item: GuestCartItem) =>
    !locked ||
    (actorId !== undefined &&
      checkpoint?.actorId === actorId &&
      transferState.actorId === actorId &&
      transferState.status === 'failed' &&
      checkpoint.rows.find((row) => row.variantId === item.variantId)?.phase === 'ready');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const total = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  async function write(action: () => void | Promise<void>) {
    if (editing) return;
    setEditing(true);
    try {
      await action();
      setError('');
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'سبد ذخیره نشد.');
    } finally {
      setEditing(false);
    }
  }
  return (
    <section className="account-page account-commerce-page guest-cart-page">
      <header className="account-heading">
        <h1>سبد خرید</h1>
        <Link className="account-secondary-link" to="/products">
          ادامه خرید
        </Link>
      </header>
      <div className="commerce-journey">
        <CommerceSteps current="cart" />
      </div>
      {error && <p role="alert">{error}</p>}
      {!items.length ? (
        <div className="account-empty-cart commerce-glass">
          <h2>سبد خرید شما خالی است.</h2>
          <Link to="/products">مشاهدهٔ محصولات</Link>
        </div>
      ) : (
        <div className="account-shopping-layout">
          <ul className="account-cart-items">
            {items.map((item) => (
              <li key={item.variantId}>
                <div className="account-cart-product">
                  <SafeImage
                    src={
                      safeImageUrl(item.productImage, window.location.origin, API_BASE_URL) ??
                      undefined
                    }
                    alt={item.productName}
                    width={88}
                    height={88}
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <Link to={`/products/${item.productSlug}`}>{item.productName}</Link>
                    <p className="account-subtle">{formatWeight(item.weightGram)}</p>
                    <p className="account-subtle">
                      آخرین قیمت مشاهده‌شده: {formatToman(item.unitPrice)}
                    </p>
                  </div>
                </div>
                <GuestQuantity
                  key={`${item.variantId}:${item.quantity}`}
                  item={item}
                  locked={editing || !canEdit(item)}
                  onCommit={(count) =>
                    write(() =>
                      checkpoint && actorId !== undefined
                        ? editGuestTransferItem(actorId, item.variantId, count)
                        : setGuestCartQuantity(item.variantId, count),
                    )
                  }
                />
                <p className="account-cart-total">{formatToman(item.unitPrice * item.quantity)}</p>
                <button
                  type="button"
                  className="account-danger"
                  disabled={editing || !canEdit(item)}
                  onClick={() =>
                    write(() =>
                      checkpoint && actorId !== undefined
                        ? editGuestTransferItem(actorId, item.variantId, null)
                        : removeGuestCartItem(item.variantId),
                    )
                  }
                >
                  حذف
                </button>
              </li>
            ))}
          </ul>
          <aside className="account-shopping-summary">
            <h2>خلاصه سبد خرید</h2>
            <dl className="account-totals">
              <dt>جمع برآوردی کالاها</dt>
              <dd>{formatToman(total)}</dd>
            </dl>
            <p className="account-subtle">قیمت و موجودی پس از ورود دوباره بررسی می‌شود.</p>
            <p className="account-subtle">{GUEST_CART_HANDOFF_NOTE}</p>
            {!transferring && !checkpoint && (
              <Link className="account-primary-link" to="/login?next=%2Fcheckout">
                ورود و تکمیل خرید
              </Link>
            )}
            {locked && (
              <p role="status">
                اقلام مهمان تا پایان انتقال محفوظ‌اند؛ ادامهٔ خرید پس از تأیید انتقال باز می‌شود.
              </p>
            )}
            <button
              type="button"
              className="account-danger"
              disabled={editing || locked}
              onClick={() => write(clearGuestCart)}
            >
              خالی‌کردن سبد
            </button>
          </aside>
        </div>
      )}
    </section>
  );
}
function GuestQuantity({
  item,
  locked,
  onCommit,
}: {
  item: GuestCartItem;
  locked: boolean;
  onCommit(count: number): void;
}) {
  const [value, setValue] = useState(String(item.quantity));
  const count = parseQuantityInput(value, 20);
  return (
    <div className="commerce-quantity">
      <QuantityField
        id={`guest-qty-${item.variantId}`}
        value={value}
        onChange={setValue}
        max={20}
        disabled={locked}
      />
      {value !== String(item.quantity) && (
        <button
          type="button"
          disabled={locked || count === null}
          onClick={() => {
            if (count !== null) onCommit(count);
          }}
        >
          به‌روزرسانی تعداد
        </button>
      )}
    </div>
  );
}
