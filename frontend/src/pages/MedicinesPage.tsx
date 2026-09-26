import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { shopApi } from '../api/endpoints-shop';
import { queryKeys } from '../api/query-keys';
import { Pagination } from '../components/Pagination';
import { EmptyState, ErrorState, LoadingState } from '../components/states';

/** Medicines (F10) — informational only: no price, no stock. */
export function MedicinesPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const prescriptionOnly = params.get('requiresPrescription') === '1';
  const [search, setSearch] = useState(q);

  const filters = {
    q: q || undefined,
    requiresPrescription: prescriptionOnly ? true : undefined,
    page: Number(params.get('page') ?? '1') || 1,
  };

  const medicines = useQuery({
    queryKey: queryKeys.medicines({ ...filters }),
    queryFn: () => shopApi.medicines(filters),
    placeholderData: keepPreviousData,
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const next = new URLSearchParams();
    if (search.trim()) next.set('q', search.trim());
    if (prescriptionOnly) next.set('requiresPrescription', '1');
    setParams(next);
  }

  return (
    <section>
      <h1>دارو‌ها</h1>
      <p>این بخش صرفاً اطلاعاتی است؛ قیمت و موجودی ندارد و پیش از مصرف با دامپزشک مشورت کنید.</p>

      <form onSubmit={submit}>
        <label htmlFor="medQ">جستجوی نام دارو یا مادهٔ مؤثره</label>
        <input id="medQ" value={search} onChange={(event) => setSearch(event.target.value)} />
        <label>
          <input
            type="checkbox"
            checked={prescriptionOnly}
            onChange={(event) => {
              const next = new URLSearchParams(params);
              if (event.target.checked) next.set('requiresPrescription', '1');
              else next.delete('requiresPrescription');
              setParams(next);
            }}
          />
          نیازمند نسخه
        </label>
        <button type="submit">جستجو</button>
      </form>

      {medicines.isLoading && <LoadingState />}
      {medicines.error && (
        <ErrorState error={medicines.error} onRetry={() => void medicines.refetch()} />
      )}
      {medicines.data && medicines.data.data.length === 0 && (
        <EmptyState text="دارویی با این جستجو پیدا نشد." />
      )}

      {medicines.data && medicines.data.data.length > 0 && (
        <>
          <ul>
            {medicines.data.data.map((medicine) => (
              <li key={medicine.id}>
                <Link to={`/medicines/${medicine.id}`}>{medicine.name}</Link>
                {medicine.activeIngredient && <> — {medicine.activeIngredient}</>}
                {medicine.requiresPrescription && <> (نیازمند نسخه)</>}
              </li>
            ))}
          </ul>
          <Pagination meta={medicines.data.meta} />
        </>
      )}
    </section>
  );
}
