import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { shopApi } from '../api/endpoints-shop';
import { queryKeys } from '../api/query-keys';
import { Pagination } from '../components/Pagination';
import { EmptyState, ErrorState, LoadingState } from '../components/states';

/** Pharmacy directory (F10): city / province / 24h filters. */
export function PharmaciesPage() {
  const [params, setParams] = useSearchParams();
  const [city, setCity] = useState(params.get('city') ?? '');
  const [province, setProvince] = useState(params.get('province') ?? '');
  const is24h = params.get('is24h') === '1';

  const filters = {
    city: params.get('city') ?? undefined,
    province: params.get('province') ?? undefined,
    is24h: is24h ? true : undefined,
    page: Number(params.get('page') ?? '1') || 1,
  };

  const pharmacies = useQuery({
    queryKey: queryKeys.pharmacies({ ...filters }),
    queryFn: () => shopApi.pharmacies(filters),
    placeholderData: keepPreviousData,
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const next = new URLSearchParams();
    if (city.trim()) next.set('city', city.trim());
    if (province.trim()) next.set('province', province.trim());
    if (is24h) next.set('is24h', '1');
    setParams(next);
  }

  return (
    <section>
      <h1>داروخانه‌ها</h1>
      <p>فهرست اطلاعاتی داروخانه‌ها؛ قیمت و موجودی دارو ارائه نمی‌شود.</p>

      <form onSubmit={submit}>
        <label htmlFor="city">شهر</label>
        <input id="city" value={city} onChange={(event) => setCity(event.target.value)} />
        <label htmlFor="province">استان</label>
        <input
          id="province"
          value={province}
          onChange={(event) => setProvince(event.target.value)}
        />
        <label>
          <input
            type="checkbox"
            checked={is24h}
            onChange={(event) => {
              const next = new URLSearchParams(params);
              if (event.target.checked) next.set('is24h', '1');
              else next.delete('is24h');
              setParams(next);
            }}
          />
          فقط ۲۴ ساعته
        </label>
        <button type="submit">اعمال فیلتر</button>
      </form>

      {pharmacies.isLoading && <LoadingState />}
      {pharmacies.error && (
        <ErrorState error={pharmacies.error} onRetry={() => void pharmacies.refetch()} />
      )}
      {pharmacies.data && pharmacies.data.data.length === 0 && (
        <EmptyState text="داروخانه‌ای با این فیلتر پیدا نشد." />
      )}

      {pharmacies.data && pharmacies.data.data.length > 0 && (
        <>
          <ul>
            {pharmacies.data.data.map((pharmacy) => (
              <li key={pharmacy.id}>
                <Link to={`/pharmacies/${pharmacy.id}`}>{pharmacy.name}</Link>
                {pharmacy.isVerified && ' (تأییدشده)'} {pharmacy.is24h && ' (۲۴ ساعته)'}
                <p>
                  {pharmacy.province}، {pharmacy.city}
                </p>
              </li>
            ))}
          </ul>
          <Pagination meta={pharmacies.data.meta} />
        </>
      )}
    </section>
  );
}
