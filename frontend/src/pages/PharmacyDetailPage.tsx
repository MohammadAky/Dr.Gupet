import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { shopApi } from '../api/endpoints-shop';
import { queryKeys } from '../api/query-keys';
import { EmptyState, ErrorState, LoadingState } from '../components/states';
import { DirectoryDetailFrame } from '../components/DirectoryDetailFrame';
import { isSampleReference } from '../lib/sample-records';
import { SampleRecordNotice } from '../components/SampleRecordNotice';
import { SafeImage } from '../components/SafeImage';
import { safeImageUrl } from '../lib/image-url';
import { API_BASE_URL } from '../lib/env';
import { hasCoordinates } from '../features/landing/distance';

/** Pharmacy detail (F10): hours, phone, map link. */
export function PharmacyDetailPage() {
  const { id = '' } = useParams();
  const pharmacyId = Number(id);

  const pharmacy = useQuery({
    queryKey: queryKeys.pharmacy(pharmacyId),
    queryFn: () => shopApi.pharmacy(pharmacyId),
    enabled: Number.isSafeInteger(pharmacyId) && pharmacyId > 0,
  });

  if (
    !Number.isSafeInteger(pharmacyId) ||
    pharmacyId <= 0 ||
    pharmacy.isLoading ||
    pharmacy.error ||
    !pharmacy.data
  )
    return (
      <DirectoryDetailFrame
        title="اطلاعات داروخانه"
        to="/pharmacies"
        backLabel="بازگشت به داروخانه‌ها"
      >
        {!Number.isSafeInteger(pharmacyId) || pharmacyId <= 0 ? (
          <EmptyState text="داروخانهٔ مورد نظر پیدا نشد." />
        ) : pharmacy.isLoading ? (
          <LoadingState />
        ) : pharmacy.error ? (
          <ErrorState error={pharmacy.error} onRetry={() => void pharmacy.refetch()} />
        ) : (
          <EmptyState text="داروخانهٔ مورد نظر پیدا نشد." />
        )}
      </DirectoryDetailFrame>
    );

  const item = pharmacy.data;
  const sample = isSampleReference(item);
  const image = safeImageUrl(item.image, window.location.origin, API_BASE_URL);
  const mapUrl =
    !sample && hasCoordinates(item)
      ? `https://www.openstreetmap.org/?mlat=${item.lat}&mlon=${item.lng}#map=17/${item.lat}/${item.lng}`
      : null;

  return (
    <article className="pharmacy-detail">
      <Link className="detail-back" to="/pharmacies">
        بازگشت به داروخانه‌ها ←
      </Link>
      <h1>{item.name}</h1>
      {sample && <SampleRecordNotice kind="pharmacy" />}
      {image && (
        <SafeImage className="sample-record-image" src={image} alt={item.name} loading="lazy" />
      )}
      <p>
        {item.isVerified && 'تأییدشده · '}
        {item.is24h && '۲۴ ساعته · '}
        {item.province}، {item.city}
      </p>
      <p>{item.address}</p>
      {item.workingHours && <p>ساعات کاری: {item.workingHours}</p>}
      {!sample && item.phone && (
        <p>
          <a dir="ltr" href={`tel:${item.phone}`}>
            {item.phone}
          </a>
        </p>
      )}
      {mapUrl && (
        <p>
          <a href={mapUrl} target="_blank" rel="noreferrer">
            نمایش روی نقشه
          </a>
        </p>
      )}
      <p>
        <Link to="/pharmacies">بازگشت به فهرست</Link>
      </p>
    </article>
  );
}
