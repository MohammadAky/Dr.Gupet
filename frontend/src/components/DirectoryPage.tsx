import { SafeImage } from './SafeImage';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { shopApi } from '../api/endpoints-shop';
import { queryKeys } from '../api/query-keys';
import { clinicArtwork, safeImageUrl } from '../lib/image-url';
import { API_BASE_URL } from '../lib/env';
import { citySuggestions, provinces } from '../lib/locations';
import { Pagination } from './Pagination';
import { SearchableFilter } from './SearchableFilter';
import { EmptyState, ErrorState, LoadingState } from './states';
import { isSampleReference } from '../lib/sample-records';

export function DirectoryPage({ kind }: { kind: 'pharmacies' | 'clinics' }) {
  return <DirectoryContent key={kind} kind={kind} />;
}

function DirectoryContent({ kind }: { kind: 'pharmacies' | 'clinics' }) {
  const [params, setParams] = useSearchParams();
  const dutyParam = params.get('onDuty');
  const urlDraft = {
    source: params.toString(),
    city: params.get('city') ?? '',
    province: params.get('province') ?? '',
    is24h: params.get('is24h') === '1',
    onDuty: dutyParam === 'true' || dutyParam === 'false' ? dutyParam : 'all',
  };
  const [draft, setDraft] = useState(urlDraft);
  const current = draft.source === urlDraft.source ? draft : urlDraft;
  const { city, province, is24h, onDuty } = current;
  const setCity = (city: string) =>
    setDraft((old) => ({ ...(old.source === urlDraft.source ? old : urlDraft), city }));
  const setProvince = (province: string) =>
    setDraft((old) => ({ ...(old.source === urlDraft.source ? old : urlDraft), province }));
  const setIs24h = (is24h: boolean) =>
    setDraft((old) => ({ ...(old.source === urlDraft.source ? old : urlDraft), is24h }));
  const setOnDuty = (onDuty: string) =>
    setDraft((old) => ({ ...(old.source === urlDraft.source ? old : urlDraft), onDuty }));
  const filters = {
    city: params.get('city') || undefined,
    province: params.get('province') || undefined,
    is24h: params.get('is24h') === '1' ? true : undefined,
    page:
      Number.isSafeInteger(Number(params.get('page'))) && Number(params.get('page')) > 0
        ? Number(params.get('page'))
        : 1,
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
    <section className={`directory-page${clinics ? ' clinic-directory' : ''}`}>
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
      {data?.meta && (
        <p className="directory-results" role="status">
          {data.meta.total.toLocaleString('fa-IR')} {clinics ? 'کلینیک' : 'داروخانه'} پیدا شد
          {directory.isFetching ? ' · در حال به‌روزرسانی…' : ''}
        </p>
      )}

      {directory.isLoading && <LoadingState />}
      {directory.error && (
        <ErrorState error={directory.error} onRetry={() => void directory.refetch()} />
      )}
      {data && data.data.length === 0 && <EmptyState text="مرکزی با این فیلتر پیدا نشد." />}
      {data && data.data.length > 0 && (
        <>
          <div className="directory-grid">
            {data.data.map((place) => (
              <article className={`directory-card${clinics ? ' clinic-card' : ''}`} key={place.id}>
                {(clinics || place.image) && (
                  <figure className="clinic-card__image">
                    <SafeImage
                      src={
                        clinics
                          ? `${clinicArtwork(place.id)}-480.webp`
                          : (safeImageUrl(place.image, window.location.origin, API_BASE_URL) ??
                            undefined)
                      }
                      srcSet={
                        clinics
                          ? `${clinicArtwork(place.id)}-480.webp 480w, ${clinicArtwork(place.id)}-960.webp 960w`
                          : undefined
                      }
                      sizes="(max-width: 600px) calc(100vw - 40px), (max-width: 1000px) 45vw, 360px"
                      width="960"
                      height="720"
                      loading="lazy"
                      decoding="async"
                      alt=""
                    />
                    <figcaption>
                      {isSampleReference(place) ? 'تصویر نمونهٔ نمایشی' : 'تصویر نمادین'}
                    </figcaption>
                  </figure>
                )}
                <div className={clinics ? 'clinic-card__body' : undefined}>
                  <div className="directory-card__meta">
                    {isSampleReference(place) && <span>نمونهٔ نمایشی؛ مرکز واقعی نیست</span>}
                    {place.isVerified && <span>تأییدشده</span>}
                    {place.is24h && <span>۲۴ ساعته</span>}
                    {!clinics && place.onDuty && <span>کشیک</span>}
                  </div>
                  <h2>
                    <Link to={`${base}/${place.id}`}>{place.name}</Link>
                  </h2>
                  <p className={clinics ? 'clinic-card__location' : undefined}>
                    {place.province}، {place.city}
                  </p>
                  <p className="directory-card__address">{place.address}</p>
                  <div className={clinics ? 'clinic-card__actions' : undefined}>
                    <Link className="directory-card__link" to={`${base}/${place.id}`}>
                      مشاهدهٔ اطلاعات <span aria-hidden="true">←</span>
                    </Link>
                    {clinics && place.phone && (
                      <a
                        className="clinic-card__contact"
                        href={`tel:${place.phone}`}
                        aria-label={`تماس با ${place.name}`}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M8.1 3H5a2 2 0 0 0-2 2c0 8.8 7.2 16 16 16a2 2 0 0 0 2-2v-3.1l-4.6-1.5-1.8 2.3a13.4 13.4 0 0 1-7.3-7.3l2.3-1.8L8.1 3Z" />
                        </svg>
                        تماس
                      </a>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
          <Pagination meta={data.meta} />
        </>
      )}
    </section>
  );
}
