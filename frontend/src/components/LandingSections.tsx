import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/endpoints';
import { shopApi, type Page } from '../api/endpoints-shop';
import { queryKeys } from '../api/query-keys';
import type { Clinic, Medicine, PetType, Pharmacy } from '../api/types';
import { hasCoordinates } from '../features/landing/distance';
import { landingSample, type LandingContent } from '../features/landing/content';
import { clinicArtwork, safeImageUrl } from '../lib/image-url';
import { API_BASE_URL } from '../lib/env';
import { SafeImage } from './SafeImage';
import { LandingCarousel } from './LandingCarousel';
import { ProductCardView } from './ProductCardView';
import { isSampleProduct, isSampleReference } from '../lib/sample-records';
import { EmptyState, ErrorState, LoadingState } from './states';

const centerFilters = { page: 1, limit: 4 };

function speciesKind(type: PetType): 'dog' | 'cat' | 'bird' | 'other' {
  const slug = type.slug.toLowerCase();
  if (type.name === 'سگ' || ['dog', 'dogs', 'سگ'].includes(slug)) return 'dog';
  if (type.name === 'گربه' || ['cat', 'cats', 'گربه'].includes(slug)) return 'cat';
  if (type.name === 'پرنده' || ['bird', 'birds', 'پرنده'].includes(slug)) return 'bird';
  return 'other';
}

function SpeciesArtwork({ type }: { type: PetType }) {
  const kind = speciesKind(type);
  if (kind !== 'other') {
    return (
      <SafeImage
        className="landing-species__artwork"
        src={`/brand/species-${kind}.webp`}
        alt=""
        width={320}
        height={320}
        loading="lazy"
        decoding="async"
      />
    );
  }
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <ellipse cx="32" cy="43" rx="14" ry="11" />
      <ellipse cx="15" cy="28" rx="5" ry="7" />
      <ellipse cx="27" cy="20" rx="5" ry="7" />
      <ellipse cx="40" cy="20" rx="5" ry="7" />
      <ellipse cx="51" cy="28" rx="5" ry="7" />
    </svg>
  );
}

function SectionHeading({
  id,
  title,
  to,
  action,
}: {
  id: string;
  title: string;
  to: string;
  action: string;
}) {
  return (
    <div className="landing-section__heading">
      <h2 id={id}>{title}</h2>
      <Link className="landing-section__all" to={to}>
        {action}
        <span aria-hidden="true">←</span>
      </Link>
    </div>
  );
}

function CenterCard({
  place,
  kind,
  distance,
}: {
  place: Clinic | Pharmacy;
  kind: 'clinics' | 'pharmacies';
  distance?: number;
}) {
  const sample = isSampleReference(place);
  const image =
    kind === 'clinics'
      ? `${clinicArtwork(place.id)}-480.webp`
      : safeImageUrl(place.image, window.location.origin, API_BASE_URL);
  return (
    <article className="landing-center">
      {image && (
        <figure className="landing-center__image">
          <SafeImage
            className="landing-center__artwork"
            src={image}
            width={960}
            height={720}
            alt=""
            loading="lazy"
            decoding="async"
          />
          <figcaption>{sample ? 'تصویر نمونهٔ نمایشی' : 'تصویر نمادین'}</figcaption>
        </figure>
      )}
      <div className="landing-center__body">
        <div className="landing-center__meta">
          {sample ? (
            <span>نمونهٔ نمایشی؛ مرکز واقعی نیست</span>
          ) : (
            <>
              {place.isVerified && <span>تأییدشده</span>}
              {place.is24h && <span>۲۴ ساعته</span>}
              {kind === 'pharmacies' && place.onDuty && <span>کشیک</span>}
            </>
          )}
        </div>
        <h3>
          <Link to={`/${kind}/${place.id}`}>{place.name}</Link>
        </h3>
        <p>
          {place.province}، {place.city}
        </p>
        <p className="landing-center__address">{place.address}</p>
        {!sample && distance !== undefined && (
          <p className="landing-center__distance">
            فاصلهٔ مستقیم تقریبی: {distance.toLocaleString('fa-IR', { maximumFractionDigits: 1 })}{' '}
            کیلومتر
          </p>
        )}
        <Link className="landing-center__action" to={`/${kind}/${place.id}`}>
          مشاهدهٔ اطلاعات<span aria-hidden="true">←</span>
        </Link>
      </div>
    </article>
  );
}

function usableNearby(page: Page<Clinic>): Page<Clinic> {
  return {
    ...page,
    data: page.data.filter(
      (place) =>
        !isSampleReference(place) &&
        typeof place.distanceKm === 'number' &&
        Number.isFinite(place.distanceKm) &&
        place.distanceKm >= 0,
    ),
  };
}

function MedicineCard({ medicine }: { medicine: Medicine }) {
  const sample = isSampleReference(medicine);
  const image = safeImageUrl(medicine.image, window.location.origin, API_BASE_URL);
  return (
    <article className="landing-medicine">
      {image && (
        <SafeImage
          className="landing-medicine__image"
          src={image}
          width={320}
          height={240}
          alt=""
          loading="lazy"
          decoding="async"
        />
      )}
      <span>
        {sample
          ? 'نمونهٔ نمایشی؛ داروی واقعی نیست'
          : medicine.requiresPrescription
            ? 'نیازمند نسخه'
            : 'اطلاعات دارویی'}
      </span>
      <h3>
        <Link to={`/medicines/${medicine.id}`}>{medicine.name}</Link>
      </h3>
      {medicine.activeIngredient && <p>مادهٔ مؤثره: {medicine.activeIngredient}</p>}
      <Link className="landing-center__action" to={`/medicines/${medicine.id}`}>
        مطالعهٔ اطلاعات<span aria-hidden="true">←</span>
      </Link>
    </article>
  );
}

export function LandingSections({ content = landingSample }: { content?: LandingContent }) {
  const types = useQuery({ queryKey: queryKeys.petTypes, queryFn: () => api.petTypes() });
  const clinics = useQuery({
    queryKey: queryKeys.clinics(centerFilters),
    queryFn: () => shopApi.clinics(centerFilters),
  });
  const pharmacies = useQuery({
    queryKey: queryKeys.pharmacies(centerFilters),
    queryFn: () => shopApi.pharmacies(centerFilters),
  });
  const productFilters = { page: 1, limit: 8, sampleOnly: true };
  const medicineFilters = {
    page: 1,
    limit: 8,
    sampleOnly: content.sections.medicines.demo || undefined,
  };
  const products = useQuery({
    queryKey: queryKeys.products(productFilters),
    queryFn: () => shopApi.products(productFilters),
    enabled: content.sections.products.demo,
  });
  const medicines = useQuery({
    queryKey: queryKeys.medicines(medicineFilters),
    queryFn: () => shopApi.medicines(medicineFilters),
  });
  const [locationState, setLocationState] = useState<'idle' | 'pending' | 'ready' | 'error'>(
    'idle',
  );
  const [locationMessage, setLocationMessage] = useState('');
  const [nearby, setNearby] = useState<{
    clinics: Page<Clinic> | null;
    pharmacies: Page<Pharmacy> | null;
  }>({ clinics: null, pharmacies: null });
  const [nearbyErrors, setNearbyErrors] = useState<{ clinics: unknown; pharmacies: unknown }>({
    clinics: null,
    pharmacies: null,
  });
  const generation = useRef(0);
  const locationInFlight = useRef(false);
  useEffect(
    () => () => {
      generation.current += 1;
    },
    [],
  );

  function findNearby() {
    if (locationInFlight.current) return;
    const request = ++generation.current;
    setNearby({ clinics: null, pharmacies: null });
    setNearbyErrors({ clinics: null, pharmacies: null });
    if (!navigator.geolocation) {
      setLocationState('error');
      setLocationMessage(
        'مرورگر شما موقعیت مکانی را پشتیبانی نمی‌کند. از فهرست مراکز شهر خود را انتخاب کنید.',
      );
      return;
    }
    locationInFlight.current = true;
    setLocationState('pending');
    setLocationMessage('در حال دریافت موقعیت و بررسی نزدیک‌ترین مراکز…');
    try {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          if (generation.current !== request) return;
          const origin = { lat: position.coords.latitude, lng: position.coords.longitude };
          if (!hasCoordinates(origin)) {
            locationInFlight.current = false;
            setLocationState('error');
            setLocationMessage(
              'موقعیت دریافت‌شده معتبر نیست. دوباره تلاش کنید یا شهر خود را از فهرست انتخاب کنید.',
            );
            return;
          }
          // Send only after explicit consent; no URL/query-key coordinates, persistent storage or watchPosition.
          const body = { ...origin, page: 1, limit: 4 };
          const results = await Promise.allSettled([
            shopApi.nearbyClinics(body),
            shopApi.nearbyPharmacies(body),
          ]);
          if (generation.current !== request) return;
          const clinicResult = results[0];
          const pharmacyResult = results[1];
          setNearby({
            clinics: clinicResult?.status === 'fulfilled' ? usableNearby(clinicResult.value) : null,
            pharmacies:
              pharmacyResult?.status === 'fulfilled' ? usableNearby(pharmacyResult.value) : null,
          });
          setNearbyErrors({
            clinics: clinicResult?.status === 'rejected' ? clinicResult.reason : null,
            pharmacies: pharmacyResult?.status === 'rejected' ? pharmacyResult.reason : null,
          });
          locationInFlight.current = false;
          const received =
            clinicResult?.status === 'fulfilled' || pharmacyResult?.status === 'fulfilled';
          setLocationState(received ? 'ready' : 'error');
          setLocationMessage(
            received
              ? 'فاصلهٔ بخش‌های دریافت‌شده از کل فهرست مراکز دارای مختصات بررسی شده است. فاصله‌ها مستقیم و تقریبی‌اند، نه مسیر یا زمان سفر.'
              : 'دریافت مراکز نزدیک موفق نبود. فهرست عادی همچنان در دسترس است؛ دوباره تلاش کنید.',
          );
        },
        (error) => {
          if (generation.current !== request) return;
          locationInFlight.current = false;
          setLocationState('error');
          setLocationMessage(
            error.code === 1
              ? 'دسترسی به موقعیت داده نشد. فهرست مراکز همچنان در دسترس است و می‌توانید شهر خود را انتخاب کنید.'
              : 'موقعیت شما دریافت نشد. دوباره تلاش کنید یا شهر خود را از فهرست مراکز انتخاب کنید.',
          );
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 },
      );
    } catch {
      locationInFlight.current = false;
      setLocationState('error');
      setLocationMessage(
        'دسترسی به موقعیت در این مرورگر ممکن نشد. دوباره تلاش کنید یا شهر خود را از فهرست مراکز انتخاب کنید.',
      );
    }
  }

  const clinicRows = nearby.clinics?.data.length ? nearby.clinics.data : (clinics.data?.data ?? []);
  const pharmacyRows = nearby.pharmacies?.data.length
    ? nearby.pharmacies.data
    : (pharmacies.data?.data ?? []);
  const sampleProducts = (products.data?.data ?? []).filter(isSampleProduct);
  const medicineRows = content.sections.medicines.demo
    ? (medicines.data?.data ?? []).filter(isSampleReference)
    : (medicines.data?.data ?? []);
  const orderedTypes = [...(types.data ?? [])].sort((a, b) => {
    const priority = { dog: 0, cat: 1, bird: 2, other: 3 };
    return priority[speciesKind(a)] - priority[speciesKind(b)];
  });
  return (
    <>
      <section
        className="landing-section landing-species site-container"
        aria-labelledby="landing-species-title"
      >
        <SectionHeading
          id="landing-species-title"
          title="برای همراه شما"
          to="/products"
          action="همهٔ محصولات"
        />
        {types.isLoading && <LoadingState />}
        {types.error && <ErrorState error={types.error} onRetry={() => void types.refetch()} />}
        {types.data?.length === 0 && <EmptyState text="دسته‌بندی حیوانات فعلاً در دسترس نیست." />}
        <nav className="landing-species__row" aria-label="محصولات بر اساس نوع حیوان">
          {orderedTypes.map((type) => (
            <Link
              key={type.id}
              to={`/products?petTypeId=${type.id}`}
              className="landing-species__item"
            >
              <span className="landing-species__circle">
                <SpeciesArtwork type={type} />
              </span>
              <strong>{type.name}</strong>
            </Link>
          ))}
        </nav>
      </section>
      <section
        className="landing-section landing-bestsellers site-container"
        aria-labelledby="landing-bestsellers-title"
      >
        <SectionHeading
          id="landing-bestsellers-title"
          title={content.sections.products.title}
          to="/products"
          action="مشاهدهٔ محصولات"
        />
        {content.sections.products.demo ? (
          <>
            <p className="landing-demo-notice">
              <span>نمونهٔ نمایشی</span>این محصولات در فهرست فروشگاه هم وجود دارند، قابل خرید نیستند
              و آمار پرفروش واقعی نیستند.
            </p>
            {products.isLoading && <LoadingState />}
            {products.error && (
              <ErrorState error={products.error} onRetry={() => void products.refetch()} />
            )}
            {products.data && sampleProducts.length === 0 && (
              <EmptyState text="هنوز محصول نمایشی ثبت نشده است." />
            )}
            {sampleProducts.length > 0 && (
              <LandingCarousel title={content.sections.products.title}>
                {sampleProducts.map((card) => (
                  <ProductCardView key={card.id} card={card} />
                ))}
              </LandingCarousel>
            )}
          </>
        ) : (
          <EmptyState
            text="فهرست پرفروش‌ها پس از آماده‌شدن آمار فروش نمایش داده می‌شود."
            action={
              <Link className="landing-center__action" to="/products">
                دیدن محصولات فروشگاه<span aria-hidden="true">←</span>
              </Link>
            }
          />
        )}
      </section>
      <section
        className="landing-section landing-clinics site-container"
        aria-labelledby="landing-clinics-title"
      >
        <SectionHeading
          id="landing-clinics-title"
          title={content.sections.clinics.title}
          to="/clinics"
          action="همهٔ کلینیک‌ها"
        />
        <div className="landing-location">
          <div>
            <p>کلینیک‌ها و داروخانه‌های نزدیک شما را با یک انتخاب پیدا می‌کنیم.</p>
            <span>
              با انتخاب این دکمه و اجازهٔ مرورگر، موقعیت شما برای محاسبهٔ فاصله به سرور ما ارسال
              می‌شود؛ ذخیره نمی‌شود.
            </span>
          </div>
          <button
            type="button"
            className="button-primary"
            onClick={findNearby}
            disabled={locationState === 'pending'}
            aria-describedby="landing-location-status"
          >
            {locationState === 'pending'
              ? 'در حال بررسی…'
              : locationState === 'idle'
                ? 'استفاده از موقعیت من'
                : 'بررسی دوبارهٔ موقعیت'}
          </button>
        </div>
        <p
          id="landing-location-status"
          className="landing-location__status"
          role={locationState === 'error' ? 'alert' : 'status'}
        >
          {locationMessage ||
            'تا پیش از انتخاب موقعیت، ترتیب کلینیک‌ها و داروخانه‌ها بر اساس فاصله نیست.'}
        </p>
        {clinics.isLoading && <LoadingState />}
        {clinics.error && (
          <ErrorState error={clinics.error} onRetry={() => void clinics.refetch()} />
        )}
        {nearbyErrors.clinics != null && (
          <ErrorState error={nearbyErrors.clinics} onRetry={findNearby} />
        )}
        {nearby.clinics?.data.length === 0 && (
          <p className="landing-section__note">
            کلینیک دارای موقعیت معتبر پیدا نشد؛ فهرست عادی کلینیک‌ها نمایش داده می‌شود.
          </p>
        )}
        {clinics.data?.data.length === 0 && !nearby.clinics?.data.length && (
          <EmptyState text="هنوز کلینیکی برای نمایش ثبت نشده است." />
        )}
        <div className="landing-centers landing-centers--fixed">
          {clinicRows.map((clinic) => (
            <CenterCard
              key={clinic.id}
              place={clinic}
              kind="clinics"
              distance={nearby.clinics?.data.length ? clinic.distanceKm : undefined}
            />
          ))}
        </div>
      </section>
      <section
        className="landing-section landing-pharmacies site-container"
        aria-labelledby="landing-pharmacies-title"
      >
        <SectionHeading
          id="landing-pharmacies-title"
          title={content.sections.pharmacies.title}
          to="/pharmacies"
          action="همهٔ داروخانه‌ها"
        />
        <p className="landing-section__note">
          {locationState === 'idle'
            ? 'برای مرتب‌سازی داروخانه‌ها بر اساس فاصله، دکمهٔ موقعیت در بخش کلینیک‌ها را انتخاب کنید.'
            : locationState === 'pending'
              ? 'در حال بررسی داروخانه‌های نزدیک شما…'
              : 'فاصله فقط برای مراکز واقعی دارای مختصات نمایش داده می‌شود.'}
        </p>
        {pharmacies.isLoading && <LoadingState />}
        {pharmacies.error && (
          <ErrorState error={pharmacies.error} onRetry={() => void pharmacies.refetch()} />
        )}
        {nearbyErrors.pharmacies != null && (
          <ErrorState error={nearbyErrors.pharmacies} onRetry={findNearby} />
        )}
        {nearby.pharmacies?.data.length === 0 && (
          <p className="landing-section__note">
            داروخانهٔ واقعی دارای موقعیت معتبر پیدا نشد؛ فهرست عادی و موارد نمایشی بدون فاصله نمایش
            داده می‌شوند.
          </p>
        )}
        {pharmacies.data?.data.length === 0 && !nearby.pharmacies?.data.length && (
          <EmptyState text="هنوز داروخانه‌ای برای نمایش ثبت نشده است." />
        )}
        <div className="landing-centers landing-centers--fixed">
          {pharmacyRows.map((pharmacy) => (
            <CenterCard
              key={pharmacy.id}
              place={pharmacy}
              kind="pharmacies"
              distance={nearby.pharmacies?.data.length ? pharmacy.distanceKm : undefined}
            />
          ))}
        </div>
      </section>
      <section
        className="landing-section landing-medicines site-container"
        aria-labelledby="landing-medicines-title"
      >
        <SectionHeading
          id="landing-medicines-title"
          title={content.sections.medicines.title}
          to="/medicines"
          action="همهٔ داروها"
        />
        <p className="landing-section__note">
          اطلاعات داروها برای آشنایی است؛ پیش از مصرف با دامپزشک مشورت کنید.
        </p>
        {content.sections.medicines.demo && (
          <p className="landing-demo-notice">
            <span>نمونهٔ نمایشی</span>این موارد در فهرست داروها هم وجود دارند و دارو یا توصیهٔ
            درمانی واقعی نیستند.
          </p>
        )}
        {medicines.isLoading && <LoadingState />}
        {medicines.error && (
          <ErrorState error={medicines.error} onRetry={() => void medicines.refetch()} />
        )}
        {medicines.data && medicineRows.length === 0 && (
          <EmptyState text="هنوز اطلاعات دارویی برای نمایش ثبت نشده است." />
        )}
        {medicineRows.length > 0 && (
          <LandingCarousel title={content.sections.medicines.title}>
            {medicineRows.map((medicine) => (
              <MedicineCard key={medicine.id} medicine={medicine} />
            ))}
          </LandingCarousel>
        )}
      </section>
    </>
  );
}
