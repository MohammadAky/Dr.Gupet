import '../styles/content-pages.css';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { type FormEvent, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { shopApi } from '../api/endpoints-shop';
import { api } from '../api/endpoints';
import { queryKeys } from '../api/query-keys';
import { Pagination } from '../components/Pagination';
import { SearchableFilter } from '../components/SearchableFilter';
import { EmptyState, ErrorState, LoadingState } from '../components/states';
import { isSampleReference, publicRecordName } from '../lib/sample-records';

/** Medicines (F10) — informational only: no price, no stock. */
export function MedicinesPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const prescriptionOnly = params.get('requiresPrescription') === '1';
  const [searchDraft, setSearchDraft] = useState({ q, value: q });
  const search = searchDraft.q === q ? searchDraft.value : q;
  const setSearch = (value: string) => setSearchDraft({ q, value });
  const [suggestionTerm, setSuggestionTerm] = useState('');
  const rawPetTypeId = Number(params.get('petTypeId'));
  const petTypeId =
    Number.isSafeInteger(rawPetTypeId) && rawPetTypeId > 0 ? rawPetTypeId : undefined;
  const petTypes = useQuery({ queryKey: queryKeys.petTypes, queryFn: () => api.petTypes() });

  const filters = {
    q: q || undefined,
    petTypeId,
    requiresPrescription: prescriptionOnly ? true : undefined,
    page:
      Number.isSafeInteger(Number(params.get('page'))) && Number(params.get('page')) > 0
        ? Number(params.get('page'))
        : 1,
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
      ...(suggestions.data?.data ?? []).map(publicRecordName),
      ...(medicines.data?.data ?? []).map(publicRecordName),
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
    <section className="medicine-directory">
      <div className="directory-page__heading">
        <span className="eyebrow">راهنمای سلامت</span>
        <h1>اطلاعات داروها</h1>
        <p>صرفاً اطلاعاتی؛ پیش از مصرف با دامپزشک مشورت کنید.</p>
      </div>

      <form className="filter-panel" onSubmit={submit}>
        <div className="filter-panel__grid">
          <SearchableFilter
            label="نام دارو یا مادهٔ مؤثره"
            value={search}
            options={medicineOptions}
            onInputChange={setSearch}
            onSelect={setSearch}
            placeholder="جستجوی دارو"
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
              next.delete('page');
              setParams(next);
            }}
          />
          نیازمند نسخه
        </label>
        <button type="submit" className="filter-apply">
          جستجو
        </button>
      </form>

      {medicines.isLoading && <LoadingState layout="cards" />}
      {medicines.error && (
        <ErrorState error={medicines.error} onRetry={() => void medicines.refetch()} />
      )}
      {medicines.data && medicines.data.data.length === 0 && (
        <EmptyState text="دارویی با این جستجو پیدا نشد." />
      )}

      {medicines.data && medicines.data.data.length > 0 && (
        <>
          <ul className="medicine-grid">
            {medicines.data.data.map((medicine) => (
              <li className="medicine-card" key={medicine.id}>
                {!isSampleReference(medicine) && medicine.requiresPrescription && (
                  <span className="medicine-card__kind">نیازمند نسخه</span>
                )}
                <h2>
                  <Link to={`/medicines/${medicine.id}`}>{publicRecordName(medicine)}</Link>
                </h2>
                {!isSampleReference(medicine) && medicine.activeIngredient && <p>مادهٔ مؤثره: {medicine.activeIngredient}</p>}
                <Link className="directory-card__link" to={`/medicines/${medicine.id}`}>
                  جزئیات <span aria-hidden="true">←</span>
                </Link>
              </li>
            ))}
          </ul>
          <Pagination meta={medicines.data.meta} />
        </>
      )}
    </section>
  );
}
