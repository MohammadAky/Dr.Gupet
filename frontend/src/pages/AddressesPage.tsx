import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/endpoints';
import { queryKeys } from '../api/query-keys';
import { useAuth } from '../auth/auth-provider';
import { EmptyState, ErrorState, LoadingState } from '../components/states';
import { MAX_ADDRESSES_PER_USER } from '../lib/constants';
import { errorText } from '../lib/labels';

/** Address book (F3): list, set default, delete (server keeps one default). */
export function AddressesPage() {
  const { status, user } = useAuth();
  const userId = status === 'authed' ? user?.id ?? null : null;
  if (userId === null) return <p>برای مشاهدهٔ آدرس‌های خود وارد حساب شوید.</p>;
  return <AddressesContent key={userId} />;
}

function AddressesContent() {
  const queryClient = useQueryClient();
  const active = useRef(true);
  const addresses = useQuery({
    queryKey: queryKeys.addresses,
    queryFn: async ({ signal }) => {
      const result = await api.listAddresses();
      if (signal.aborted || !active.current) throw new DOMException('Inactive session', 'AbortError');
      return result;
    },
  });
  const writing = useRef(false);
  const [pending, setPending] = useState<{ kind: 'default' | 'delete'; id: number } | null>(null);
  const [notice, setNotice] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  useLayoutEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  const setDefault = useMutation({
    mutationFn: (id: number) => api.setDefaultAddress(id),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.deleteAddress(id),
  });

  async function changeAddress(kind: 'default' | 'delete', id: number) {
    if (!active.current || writing.current || (kind === 'delete' && !window.confirm('این آدرس حذف شود؟'))) return;
    writing.current = true;
    setPending({ kind, id });
    setNotice(null);
    try {
      if (kind === 'default') await setDefault.mutateAsync(id);
      else await remove.mutateAsync(id);
      if (!active.current) return;
      await queryClient.invalidateQueries({ queryKey: queryKeys.addresses });
      if (active.current) setNotice({
        kind: 'success',
        text: kind === 'default' ? 'آدرس پیش‌فرض تغییر کرد.' : 'آدرس حذف شد.',
      });
    } catch (error) {
      if (active.current) setNotice({ kind: 'error', text: errorText(error) });
    } finally {
      if (active.current) {
        writing.current = false;
        setPending(null);
      }
    }
  }

  if (addresses.isLoading) return <LoadingState />;
  if (addresses.error)
    return <ErrorState error={addresses.error} onRetry={() => void addresses.refetch()} />;

  const items = addresses.data ?? [];
  const atLimit = items.length >= MAX_ADDRESSES_PER_USER;

  return (
    <section aria-busy={pending !== null}>
      <h1>آدرس‌های من</h1>
      {notice && <p role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}</p>}

      {items.length === 0 && (
        <EmptyState
          text="هنوز آدرسی ثبت نکرده‌اید."
          action={<Link to="/addresses/new">افزودن آدرس</Link>}
        />
      )}

      <ul>
        {items.map((address) => (
          <li key={address.id} data-default={String(address.isDefault)}>
            <p>
              <strong>{address.title}</strong> {address.isDefault && '(پیش‌فرض)'}
            </p>
            <p>
              {address.receiverName} — <span dir="ltr">{address.receiverPhone}</span>
            </p>
            <p>
              {address.province}، {address.city}، {address.fullAddress}
            </p>
            {address.postalCode && <p dir="ltr">{address.postalCode}</p>}
            <p>
              <Link to={`/addresses/${address.id}/edit`}>ویرایش</Link>
              {!address.isDefault && (
                <button type="button" disabled={pending !== null} onClick={() => void changeAddress('default', address.id)}>
                  پیش‌فرض کردن
                </button>
              )}
              <button
                type="button"
                disabled={pending !== null}
                onClick={() => void changeAddress('delete', address.id)}
              >
                حذف
              </button>
            </p>
          </li>
        ))}
      </ul>

      {!atLimit && <Link to="/addresses/new">افزودن آدرس جدید</Link>}
      {atLimit && <p>حداکثر {MAX_ADDRESSES_PER_USER} آدرس مجاز است.</p>}
    </section>
  );
}
