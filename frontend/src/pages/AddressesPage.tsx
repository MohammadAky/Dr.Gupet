import '../styles/content-pages.css';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/endpoints';
import { queryKeys } from '../api/query-keys';
import { useAuth } from '../auth/auth-provider';
import { EmptyState, ErrorState, LoadingState } from '../components/states';
import { MAX_ADDRESSES_PER_USER } from '../lib/constants';
import { errorText } from '../lib/labels';
import { AccountFrame, AccountNav } from '../components/AccountNav';
import { ConfirmDialog } from '../components/ConfirmDialog';

/** Address book (F3): list, set default, delete (server keeps one default). */
export function AddressesPage() {
  const { status, user } = useAuth();
  const userId = status === 'authed' ? (user?.id ?? null) : null;
  if (status === 'loading') return <AccountFrame title="آدرس‌های من"><LoadingState layout="rows" /></AccountFrame>;
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
      if (signal.aborted || !active.current)
        throw new DOMException('Inactive session', 'AbortError');
      return result;
    },
  });
  const writing = useRef(false);
  const [pending, setPending] = useState<{ kind: 'default' | 'delete'; id: number } | null>(null);
  const [notice, setNotice] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const [deleting, setDeleting] = useState<{ id: number; title: string } | null>(null);

  useLayoutEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  const setDefault = useMutation({
    mutationFn: (id: number) => api.setDefaultAddress(id),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.deleteAddress(id),
  });

  async function changeAddress(kind: 'default' | 'delete', id: number) {
    if (
      !active.current ||
      writing.current
    )
      return;
    writing.current = true;
    setPending({ kind, id });
    setNotice(null);
    try {
      if (kind === 'default') await setDefault.mutateAsync(id);
      else await remove.mutateAsync(id);
      if (!active.current) return;
      await queryClient.invalidateQueries({ queryKey: queryKeys.addresses });
      if (active.current)
        setNotice({
          kind: 'success',
          text: kind === 'default' ? 'آدرس پیش‌فرض تغییر کرد.' : 'آدرس حذف شد.',
        });
    } catch (error) {
      if (active.current && kind === 'default') setNotice({ kind: 'error', text: errorText(error) });
      if (kind === 'delete') throw error;
    } finally {
      if (active.current) {
        writing.current = false;
        setPending(null);
      }
    }
  }

  if (addresses.isLoading) return <AccountFrame title="آدرس‌های من"><LoadingState layout="rows" /></AccountFrame>;
  if (addresses.error)
    return <AccountFrame title="آدرس‌های من"><ErrorState error={addresses.error} onRetry={() => void addresses.refetch()} /></AccountFrame>;

  const items = addresses.data ?? [];
  const atLimit = items.length >= MAX_ADDRESSES_PER_USER;

  return (
    <section className="account-page" aria-busy={pending !== null}>
      <AccountNav />
      <header className="account-heading">
        <div>
          <h1>آدرس‌های من</h1>
        </div>
        {!atLimit && items.length > 0 && (
          <Link className="account-primary-link" to="/addresses/new">
            افزودن آدرس <span aria-hidden="true">+</span>
          </Link>
        )}
      </header>
      {notice && <p role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}</p>}

      {items.length === 0 && (
        <EmptyState
          text="هنوز آدرسی ثبت نکرده‌اید."
          action={<Link to="/addresses/new">افزودن آدرس</Link>}
        />
      )}

      <ul className="account-list account-addresses">
        {items.map((address) => (
          <li key={address.id} data-default={String(address.isDefault)}>
            <p>
              <strong>{address.title}</strong>{' '}
              {address.isDefault && <span className="account-badge">پیش‌فرض</span>}
            </p>
            <p>
              {address.receiverName} · <bdi>{address.receiverPhone}</bdi>
            </p>
            <p>
              {address.province}، {address.city}، {address.fullAddress}
            </p>
            {address.postalCode && (
              <p className="account-subtle">
                کد پستی: <bdi>{address.postalCode}</bdi>
              </p>
            )}
            <p className="account-actions">
              <Link to={`/addresses/${address.id}/edit`}>ویرایش</Link>
              {!address.isDefault && (
                <button
                  type="button"
                  disabled={pending !== null}
                  onClick={() => void changeAddress('default', address.id)}
                >
                  پیش‌فرض کردن
                </button>
              )}
              <button
                className="account-danger"
                type="button"
                disabled={pending !== null}
                onClick={() => { setNotice(null); setDeleting({ id: address.id, title: address.title }); }}
              >
                حذف
              </button>
            </p>
          </li>
        ))}
      </ul>

      {atLimit && <p>حداکثر {MAX_ADDRESSES_PER_USER} آدرس مجاز است.</p>}
      <ConfirmDialog open={deleting !== null} title={`حذف آدرس «${deleting?.title ?? ''}»`}
        description="این نشانی از حساب شما حذف می‌شود. برای استفادهٔ دوباره باید آن را ثبت کنید."
        confirmLabel="حذف آدرس" onClose={() => setDeleting(null)}
        onConfirm={() => deleting ? changeAddress('delete', deleting.id) : undefined} />
    </section>
  );
}
