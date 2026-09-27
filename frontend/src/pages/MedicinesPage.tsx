import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { type FormEvent, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { shopApi } from '../api/endpoints-shop';
import { api } from '../api/endpoints';
import { queryKeys } from '../api/query-keys';
import { Pagination } from '../components/Pagination';
import { SearchableFilter } from '../components/SearchableFilter';
import { EmptyState, ErrorState, LoadingState } from '../components/states';

/** Medicines (F10) — informational only: no price, no stock. */
export function MedicinesPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const prescriptionOnly = params.get('requiresPrescription') === '1';
  const [search, setSearch] = useState(q);
  const [suggestionTerm, setSuggestionTerm] = useState('');
  const petTypeId = Number(params.get('petTypeId') ?? '') || undefined;
  const petTypes = useQuery({ queryKey: queryKeys.petTypes, queryFn: () => api.petTypes() });

  const filters = {
    q: q || undefined,
    petTypeId,
    requiresPrescription: prescriptionOnly ? true : undefined,
    page: Number(params.get('page') ?? '1') || 1,
  };

  const medicines = useQuery({
    queryKey: queryKeys.medicines({ ...filters }),
    queryFn: () => shopApi.medicines(filters),
    placeholderData: keepPreviousData,
  });
  useEffect(() => {
    const timer = window.setTimeout(() => setSuggestionTerm(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);
  const suggestions = useQuery({
    queryKey: ['medicine-suggestions', suggestionTerm],
    queryFn: () => shopApi.medicines({ q: suggestionTerm, limit: 10 }),
    enabled: suggestionTerm.length >= 2,
    staleTime: 30_000,
    retry: false,
  });
  const medicineOptions = [
    ...new Set([
      ...(suggestions.data?.data ?? []).map((medicine) => medicine.name),
      ...(medicines.data?.data ?? []).map((medicine) => medicine.name),
    ]),
  ].map((name) => ({ value: name, label: name }));

  function submit(event: FormEvent) {
    event.preventDefault();
    const next = new URLSearchParams();
    if (search.trim()) next.set('q', search.trim());
    if (petTypeId) next.set('petTypeId', String(petTypeId));
    if (prescriptionOnly) next.set('requiresPrescription', '1');
    setParams(next);
  }

  return (
    <section>
      <h1>دارو‌ها</h1>
      <p>این بخش صرفاً اطلاعاتی است؛ قیمت و موجودی ندارد و پیش از مصرف با دامپزشک مشورت کنید.</p>

      <form className="filter-panel" onSubmit={submit}>
        <div className="filter-panel__grid">
          <SearchableFilter
            label="نام دارو یا مادهٔ مؤثره"
            value={search}
            options={medicineOptions}
            onInputChange={setSearch}
            onSelect={setSearch}
            placeholder="نام دارو را بنویسید یا از فهرست انتخاب کنید"
          />
          <SearchableFilter
            label="نوع حیوان"
            value={String(petTypeId ?? '')}
            options={[
              { value: '', label: 'همهٔ حیوانات' },
              ...(petTypes.data ?? []).map((type) => ({
                value: String(type.id),
                label: type.name,
              })),
            ]}
            onSelect={(value) => {
              const next = new URLSearchParams(params);
              if (value) next.set('petTypeId', value);
              else next.delete('petTypeId');
              next.delete('page');
              setParams(next);
            }}
          />
        </div>
        <label className="filter-check">
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
        <button type="submit" className="filter-apply">
          جستجو
        </button>
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
