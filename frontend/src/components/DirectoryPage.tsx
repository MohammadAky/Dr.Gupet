import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { shopApi } from '../api/endpoints-shop';
import { queryKeys } from '../api/query-keys';
import { citySuggestions, provinces } from '../lib/locations';
import { Pagination } from './Pagination';
import { SearchableFilter } from './SearchableFilter';
import { EmptyState, ErrorState, LoadingState } from './states';

const clinicPreview = [
  {
    id: 1,
    name: 'کلینیک نمونهٔ یک',
    province: 'تهران',
    city: 'تهران',
    address: 'نشانی نمایشی برای بررسی چیدمان کارت',
    phone: null,
    is24h: true,
    isVerified: true,
  },
  {
    id: 2,
    name: 'کلینیک نمونهٔ دو',
    province: 'فارس',
    city: 'شیراز',
    address: 'نشانی نمایشی برای بررسی متن طولانی و نمایش در موبایل',
    phone: null,
    is24h: false,
    isVerified: false,
  },
];

export function DirectoryPage({ kind }: { kind: 'pharmacies' | 'clinics' }) {
  const [params] = useSearchParams();
  return <DirectoryContent key={`${kind}:${params.toString()}`} kind={kind} />;
}

function DirectoryContent({ kind }: { kind: 'pharmacies' | 'clinics' }) {
  const [params, setParams] = useSearchParams();
  const [city, setCity] = useState(params.get('city') ?? '');
  const [province, setProvince] = useState(params.get('province') ?? '');
  const [is24h, setIs24h] = useState(params.get('is24h') === '1');
  const filters = {
    city: params.get('city') || undefined,
    province: params.get('province') || undefined,
    is24h: params.get('is24h') === '1' ? true : undefined,
    page: Number(params.get('page') ?? '1') || 1,
  };
  const clinics = kind === 'clinics';
  const demo =
    clinics &&
    import.meta.env.DEV &&
    (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') &&
    params.get('demo') === '1';
  const title = clinics ? 'کلینیک‌ها' : 'داروخانه‌ها';
  const base = clinics ? '/clinics' : '/pharmacies';

  const directory = useQuery({
    queryKey: clinics ? queryKeys.clinics({ ...filters }) : queryKeys.pharmacies({ ...filters }),
    queryFn: () => (clinics ? shopApi.clinics(filters) : shopApi.pharmacies(filters)),
    placeholderData: keepPreviousData,
    enabled: !demo,
  });
  const data = demo
    ? {
        data: clinicPreview.filter(
          (place) =>
            (!filters.province || place.province.includes(filters.province)) &&
            (!filters.city || place.city.includes(filters.city)) &&
            (!filters.is24h || place.is24h),
        ),
        meta: { page: 1, limit: 20, total: clinicPreview.length, totalPages: 1 },
      }
    : directory.data;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = new URLSearchParams();
    if (city.trim()) next.set('city', city.trim());
    if (province.trim()) next.set('province', province.trim());
    if (is24h) next.set('is24h', '1');
    if (demo) next.set('demo', '1');
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
      {demo && (
        <p className="preview-session-note" role="status">
          نمونهٔ طراحی محلی — نام و نشانی کارت‌ها ساختگی‌اند و به API متصل نیستند.
        </p>
      )}
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
              setParams(demo ? new URLSearchParams({ demo: '1' }) : new URLSearchParams());
            }}
          >
            پاک‌کردن فیلترها
          </button>
        </div>
      </form>

      {!demo && directory.isLoading && <LoadingState />}
      {!demo && directory.error && (
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
                </div>
                <h2>{demo ? place.name : <Link to={`${base}/${place.id}`}>{place.name}</Link>}</h2>
                <p>
                  {place.province}، {place.city}
                </p>
                <p className="directory-card__address">{place.address}</p>
                {!demo && (
                  <Link className="directory-card__link" to={`${base}/${place.id}`}>
                    مشاهدهٔ اطلاعات <span aria-hidden="true">←</span>
                  </Link>
                )}
              </article>
            ))}
          </div>
          {!demo && <Pagination meta={data.meta} />}
        </>
      )}
    </section>
  );
}
