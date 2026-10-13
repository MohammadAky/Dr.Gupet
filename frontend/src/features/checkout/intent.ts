export interface CheckoutIntent {
  couponCode: string;
  note: string;
  addressId: number | null;
}

const emptyIntent = (): CheckoutIntent => ({ couponCode: '', note: '', addressId: null });
let draft: { userId: number; intent: CheckoutIntent } | null = null;

/** An in-memory draft, never a payment quote. Auth transitions clear this module. */
export function readCheckoutIntent(userId: number): CheckoutIntent {
  if (draft?.userId !== userId) return emptyIntent();
  return { ...draft.intent };
}

export function writeCheckoutIntent(userId: number, patch: Partial<CheckoutIntent>): void {
  if (!Number.isSafeInteger(userId) || userId < 1) return;
  const current = readCheckoutIntent(userId);
  draft = {
    userId,
    intent: {
      couponCode: patch.couponCode ?? current.couponCode,
      note: (patch.note ?? current.note).slice(0, 500),
      addressId:
        patch.addressId === undefined
          ? current.addressId
          : patch.addressId !== null && Number.isSafeInteger(patch.addressId) && patch.addressId > 0
            ? patch.addressId
            : null,
    },
  };
}

export function clearCheckoutIntent(): void {
  draft = null;
}
