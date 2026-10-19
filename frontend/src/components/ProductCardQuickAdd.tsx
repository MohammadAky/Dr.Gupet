import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import { shopApi } from '../api/endpoints-shop';
import { queryKeys } from '../api/query-keys';
import type { ProductCard, ProductDetail, ProductVariant } from '../api/types';
import { useAuth } from '../auth/auth-provider';
import { signalCartAdded } from '../features/cart/cart-feedback';
import {
  addGuestCartItem,
  readGuestCart,
  readGuestTransfer,
  useGuestCart,
  useGuestTransferCheckpoint,
} from '../features/cart/guest-cart';
import { formatToman, formatWeight } from '../lib/format';
import { errorText } from '../lib/labels';
import { isSampleProduct, publicRecordName } from '../lib/sample-records';
import { Dialog } from './ui/interactive';
import { Button } from './ui/primitives';

// A claim starts before the detail request, so two delayed cards cannot open
// independent modal dialogs. It contains no product, account, or persisted data.
let activeQuickAdd: symbol | null = null;
const HANDOFF_MESSAGE = 'برای افزودن کالا، ابتدا انتقال سبد خرید را تکمیل کنید.';

/** Public detail is loaded only on interaction; pending guest handoff gates account writes. */
export function ProductCardQuickAdd({ card }: { card: ProductCard }) {
  const { status } = useAuth();
  const guestItems = useGuestCart();
  const guestTransfer = useGuestTransferCheckpoint();
  const handoffPending = status === 'authed' && (guestItems.length > 0 || guestTransfer !== null);
  const [request, setRequest] = useState<{ keyboard: boolean; source: HTMLElement } | null>(null);
  const [claim] = useState(() => Symbol('product-card-quick-add'));
  const open = request !== null;
  const [feedback, setFeedback] = useState('');

  useLayoutEffect(() => {
    if (!request && activeQuickAdd === claim) activeQuickAdd = null;
  }, [claim, request]);
  useLayoutEffect(
    () => () => {
      if (activeQuickAdd === claim) activeQuickAdd = null;
    },
    [claim],
  );

  return (
    <div
      className={`product-card__quick-add${handoffPending ? ' product-card__quick-add--handoff' : ''}`}
    >
      <button
        type="button"
        className="product-card__basket"
        aria-label={`افزودن ${publicRecordName(card)} به سبد خرید`}
        title={handoffPending ? HANDOFF_MESSAGE : 'افزودن به سبد خرید'}
        disabled={handoffPending}
        aria-busy={open || handoffPending || undefined}
        aria-disabled={open || handoffPending || undefined}
        onClick={(event) => {
          if (
            open ||
            (status === 'authed' && (readGuestCart().length > 0 || readGuestTransfer() !== null))
          )
            return;
          if (activeQuickAdd !== null) {
            setFeedback('ابتدا افزودن محصول قبلی را تکمیل یا پنجرهٔ آن را ببندید.');
            return;
          }
          activeQuickAdd = claim;
          setFeedback('');
          setRequest({ keyboard: event.detail === 0, source: event.currentTarget });
        }}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m5 9 2 11h10l2-11H5Z M8 9l4-6 4 6 M9 13h6 M12 10v6" />
        </svg>
      </button>
      <span className="sr-only" role="status">
        {handoffPending ? HANDOFF_MESSAGE : feedback}
      </span>
      {handoffPending && (
        <Link to="/cart" className="product-card__handoff-link" title={HANDOFF_MESSAGE}>
          بررسی سبد
        </Link>
      )}
      {request && (
        <QuickAddSession
          key={`${card.id}:${card.slug}`}
          card={card}
          keyboard={request.keyboard}
          source={request.source}
          onClose={() => setRequest(null)}
          onSuccess={() => {
            setFeedback('به سبد خرید اضافه شد.');
            setRequest(null);
          }}
        />
      )}
    </div>
  );
}

function QuickAddSession({
  card,
  keyboard,
  source,
  onClose,
  onSuccess,
}: {
  card: ProductCard;
  keyboard: boolean;
  source: HTMLElement | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { status, user } = useAuth();
  const location = useLocation();
  const client = useQueryClient();
  const identity = status === 'authed' ? (user?.id ?? null) : null;
  const guestItems = useGuestCart();
  const guestTransfer = useGuestTransferCheckpoint();
  const handoffPending = identity !== null && (guestItems.length > 0 || guestTransfer !== null);
  const actor = status === 'guest' ? 'guest' : identity !== null ? `user:${identity}` : 'loading';
  const initial = useRef({ identity, actor, route: location.key });
  const current = useRef({ identity, actor, route: location.key, active: true });
  const detailRef = useRef<ProductDetail | null>(null);
  const callbacks = useRef({ onClose, onSuccess });
  const [variants, setVariants] = useState<ProductVariant[] | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const add = useMutation({ mutationFn: (variantId: number) => shopApi.addCartItem(variantId, 1) });

  useLayoutEffect(() => {
    current.current = { identity, actor, route: location.key, active: true };
    callbacks.current = { onClose, onSuccess };
    if (actor !== initial.current.actor || location.key !== initial.current.route) onClose();
  }, [identity, actor, location.key, onClose, onSuccess]);
  useLayoutEffect(
    () => () => {
      current.current.active = false;
    },
    [],
  );

  function isCurrent() {
    return (
      current.current.active &&
      current.current.actor === initial.current.actor &&
      current.current.route === initial.current.route
    );
  }

  async function submit(variant: ProductVariant) {
    if (
      !isCurrent() ||
      inFlight.current ||
      initial.current.actor === 'loading' ||
      !variant.inStock ||
      !Number.isSafeInteger(variant.id) ||
      variant.id <= 0 ||
      isSampleProduct(card)
    )
      return;
    if (
      initial.current.identity !== null &&
      (readGuestCart().length > 0 || readGuestTransfer() !== null)
    ) {
      setError(HANDOFF_MESSAGE);
      return;
    }
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      if (initial.current.identity === null) {
        const detail = detailRef.current;
        if (!detail) throw new Error('اطلاعات محصول در دسترس نیست. دوباره تلاش کنید.');
        addGuestCartItem(detail, variant, 1);
      } else {
        await add.mutateAsync(variant.id);
      }
      if (!isCurrent()) return;
      signalCartAdded({ userId: initial.current.identity, keyboard, source });
      if (initial.current.identity !== null)
        void client.invalidateQueries({ queryKey: queryKeys.cart });
      callbacks.current.onSuccess();
    } catch (failure: unknown) {
      if (isCurrent()) setError(errorText(failure));
    } finally {
      if (isCurrent()) {
        inFlight.current = false;
        setPending(false);
      }
    }
  }

  useEffect(() => {
    if (initial.current.actor === 'loading') return;
    let cancelled = false;
    void client
      .fetchQuery({
        queryKey: queryKeys.product(card.slug),
        queryFn: () => shopApi.product(card.slug),
        staleTime: 0,
      })
      .then((detail) => {
        if (cancelled || !isCurrent()) return;
        if (
          detail.id !== card.id ||
          detail.slug !== card.slug ||
          !detail.isActive ||
          isSampleProduct(detail)
        ) {
          setError('این محصول در حال حاضر قابل خرید نیست.');
          return;
        }
        const available = detail.variants.filter((variant) => variant.inStock);
        detailRef.current = detail;
        setVariants(available);
        if (available.length === 0) setError('این محصول در حال حاضر ناموجود است.');
        else if (available.length === 1) void submit(available[0]!);
      })
      .catch((failure: unknown) => {
        if (!cancelled && isCurrent()) setError(errorText(failure));
      });
    return () => {
      cancelled = true;
    };
    // This is one user-initiated operation; identity/route changes invalidate it above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (actor === 'loading')
    return (
      <span className="sr-only" role="status">
        در حال بررسی حساب…
      </span>
    );
  if (handoffPending)
    return (
      <Dialog open title="انتقال سبد خرید" description={publicRecordName(card)} onClose={onClose}>
        <div className="product-card__choice">
          <p role="status">{HANDOFF_MESSAGE}</p>
          <Link to="/cart">بررسی سبد خرید</Link>
        </div>
      </Dialog>
    );
  if (variants === null && error === null)
    return (
      <span className="sr-only" role="status">
        در حال بررسی موجودی…
      </span>
    );
  if (variants?.length === 1 && !error)
    return (
      <span className="sr-only" role="status">
        در حال افزودن به سبد خرید…
      </span>
    );
  return (
    <Dialog
      open
      title={variants && variants.length > 1 ? 'انتخاب بسته‌بندی' : 'افزودن به سبد خرید'}
      description={publicRecordName(card)}
      onClose={onClose}
    >
      <div className="product-card__choice">
        {variants && variants.length > 1 && (
          <fieldset disabled={pending}>
            <legend>بسته‌بندی مورد نظر را انتخاب کنید</legend>
            {variants.map((variant) => (
              <label key={variant.id}>
                <input
                  type="radio"
                  name={`card-variant-${card.id}`}
                  value={variant.id}
                  checked={selected === variant.id}
                  onChange={() => setSelected(variant.id)}
                />
                <span>
                  {formatWeight(variant.weightGram)}
                  <small dir="ltr">{variant.sku}</small>
                </span>
                <strong>{formatToman(variant.price)}</strong>
              </label>
            ))}
          </fieldset>
        )}
        {error && <p role="alert">{error}</p>}
        {variants && variants.length > 0 && (
          <Button
            pending={pending}
            disabled={variants.length > 1 && selected === null}
            onClick={() => {
              const variant =
                variants.find((item) => item.id === selected) ??
                (variants.length === 1 ? variants[0] : undefined);
              if (variant) void submit(variant);
            }}
          >
            افزودن به سبد خرید
          </Button>
        )}
      </div>
    </Dialog>
  );
}
