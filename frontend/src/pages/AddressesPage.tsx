import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../api/endpoints';
import { queryKeys } from '../api/query-keys';
import { EmptyState, ErrorState, LoadingState } from '../components/states';
import { MAX_ADDRESSES_PER_USER } from '../lib/constants';
import { errorText } from '../lib/labels';

/** Address book (F3): list, set default, delete (server keeps one default). */
export function AddressesPage() {
  const queryClient = useQueryClient();
  const addresses = useQuery({ queryKey: queryKeys.addresses, queryFn: () => api.listAddresses() });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: queryKeys.addresses });
  }

  const setDefault = useMutation({
    mutationFn: (id: number) => api.setDefaultAddress(id),
    onSuccess: invalidate,
    onError: (error) => alert(errorText(error)),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.deleteAddress(id),
    onSuccess: invalidate,
    onError: (error) => alert(errorText(error)),
  });

  if (addresses.isLoading) return <LoadingState />;
  if (addresses.error) return <ErrorState error={addresses.error} onRetry={() => void addresses.refetch()} />;

  const items = addresses.data ?? [];
  const atLimit = items.length >= MAX_ADDRESSES_PER_USER;

  return (
    <section>
      <h1>آدرس‌های من</h1>

      {items.length === 0 && (
        <EmptyState text="هنوز آدرسی ثبت نکرده‌اید." action={<Link to="/addresses/new">افزودن آدرس</Link>} />
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
                <button type="button" onClick={() => setDefault.mutate(address.id)}>
                  پیش‌فرض کردن
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('این آدرس حذف شود؟')) remove.mutate(address.id);
                }}
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
