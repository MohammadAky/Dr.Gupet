import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { shopApi } from '../api/endpoints-shop';
import { queryKeys } from '../api/query-keys';
import { citySuggestions, provinces } from '../lib/locations';
import { Pagination } from './Pagination';
import { SearchableFilter } from './SearchableFilter';
import { EmptyState, ErrorState, LoadingState } from './states';

export function DirectoryPage({ kind }: { kind: 'pharmacies' | 'clinics' }) {
  const [params] = useSearchParams();
  return <DirectoryContent key={`${kind}:${params.toString()}`} kind={kind} />;
}

function DirectoryContent({ kind }: { kind: 'pharmacies' | 'clinics' }) {
  const [params, setParams] = useSearchParams();
  const [city, setCity] = useState(params.get('city') ?? '');
  const [province, setProvince] = useState(params.get('province') ?? '');
  const [is24h, setIs24h] = useState(params.get('is24h') === '1');
  const dutyParam = params.get('onDuty');
  const [onDuty, setOnDuty] = useState(
    dutyParam === 'true' || dutyParam === 'false' ? dutyParam : 'all',
  );
  const filters = {
    city: params.get('city') || undefined,
    province: params.get('province') || undefined,
    is24h: params.get('is24h') === '1' ? true : undefined,
    page: Number(params.get('page') ?? '1') || 1,
  };
  const pharmacyFilters = {
    ...filters,
    onDuty: dutyParam === 'true' ? true : dutyParam === 'false' ? false : undefined,
  };
  const clinics = kind === 'clinics';
  const title = clinics ? 'کلینیک‌ها' : 'داروخانه‌ها';
  const base = clinics ? '/clinics' : '/pharmacies';

  const directory = useQuery({
    queryKey: clinics
      ? queryKeys.clinics({ ...filters })
      : queryKeys.pharmacies({ ...pharmacyFilters }),
    queryFn: () => (clinics ? shopApi.clinics(filters) : shopApi.pharmacies(pharmacyFilters)),
    placeholderData: keepPreviousData,
  });
  const data = directory.data;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = new URLSearchParams();
    if (city.trim()) next.set('city', city.trim());
    if (province.trim()) next.set('province', province.trim());
    if (is24h) next.set('is24h', '1');
    if (!clinics && onDuty !== 'all') next.set('onDuty', onDuty);
    setParams(next);
  }

  return (
    <section className="directory-page">
      <div className="directory-page__heading">
        <span className="eyebrow">راهنمای مراکز</span>
        <h1>{title}</h1>
        <p>
          {clinics
            ? 'اطلاعات کلینیک‌های دامپزشکی را بر اساس شهر و استان پیدا کنید.'
            : 'فهرست اطلاعاتی داروخانه‌ها؛ قیمت و موجودی دارو ارائه نمی‌شود.'}
        </p>
      </div>
      <form className="filter-panel directory-page__filters" onSubmit={submit}>
        <div className="filter-panel__grid">
          <SearchableFilter
            label="استان"
            value={province}
            onInputChange={setProvince}
            onSelect={(value) => {
              setProvince(value);
              setCity('');
            }}
            options={provinces.map((name) => ({ value: name, label: name }))}
            placeholder="استان را انتخاب یا تایپ کنید"
          />
          <SearchableFilter
            label="شهر"
            value={city}
            onInputChange={setCity}
            onSelect={setCity}
            options={citySuggestions(province).map((name) => ({ value: name, label: name }))}
            placeholder="شهر را انتخاب یا تایپ کنید"
          />
        </div>
        <div className="filter-panel__actions">
          <label className="filter-check">
            <input
              type="checkbox"
              checked={is24h}
              onChange={(event) => setIs24h(event.target.checked)}
            />{' '}
            فقط ۲۴ ساعته
          </label>
          {!clinics && (
            <label className="directory-duty-filter">
              وضعیت کشیک
              <select value={onDuty} onChange={(event) => setOnDuty(event.target.value)}>
                <option value="all">همه</option>
                <option value="true">کشیک</option>
                <option value="false">غیرکشیک</option>
              </select>
            </label>
          )}
          <button type="submit" className="filter-apply">
            نمایش نتایج
          </button>
          <button
            type="button"
            className="filter-clear"
            onClick={() => {
              setCity('');
              setProvince('');
              setIs24h(false);
              setOnDuty('all');
              setParams(new URLSearchParams());
            }}
          >
            پاک‌کردن فیلترها
          </button>
        </div>
      </form>

      {directory.isLoading && <LoadingState />}
      {directory.error && (
        <ErrorState error={directory.error} onRetry={() => void directory.refetch()} />
      )}
      {data && data.data.length === 0 && <EmptyState text="مرکزی با این فیلتر پیدا نشد." />}
      {data && data.data.length > 0 && (
        <>
          <div className="directory-grid">
            {data.data.map((place) => (
              <article className="directory-card" key={place.id}>
                <div className="directory-card__meta">
                  {place.isVerified && <span>تأییدشده</span>}
                  {place.is24h && <span>۲۴ ساعته</span>}
                  {!clinics && place.onDuty && <span>کشیک</span>}
                </div>
                <h2>
                  <Link to={`${base}/${place.id}`}>{place.name}</Link>
                </h2>
                <p>
                  {place.province}، {place.city}
                </p>
                <p className="directory-card__address">{place.address}</p>
                <Link className="directory-card__link" to={`${base}/${place.id}`}>
                  مشاهدهٔ اطلاعات <span aria-hidden="true">←</span>
                </Link>
              </article>
            ))}
          </div>
          <Pagination meta={data.meta} />
        </>
      )}
    </section>
  );
}
