import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { shopApi } from '../api/endpoints-shop';
import { queryKeys } from '../api/query-keys';
import { ErrorState, LoadingState } from '../components/states';

export function ClinicDetailPage() {
  const { id = '' } = useParams();
  const clinicId = Number(id);
  const clinic = useQuery({
    queryKey: queryKeys.clinic(clinicId),
    queryFn: () => shopApi.clinic(clinicId),
    enabled: Number.isInteger(clinicId) && clinicId > 0,
  });

  if (!Number.isInteger(clinicId) || clinicId <= 0) {
    return <p>شناسهٔ کلینیک معتبر نیست.</p>;
  }
  if (clinic.isLoading) return <LoadingState />;
  if (clinic.error)
    return <ErrorState error={clinic.error} onRetry={() => void clinic.refetch()} />;
  if (!clinic.data) return null;

  const item = clinic.data;
  const mapUrl =
    item.lat !== null && item.lng !== null
      ? `https://www.openstreetmap.org/?mlat=${item.lat}&mlon=${item.lng}#map=17/${item.lat}/${item.lng}`
      : null;

  return (
    <article className="directory-detail">
      <span className="eyebrow">راهنمای کلینیک‌ها</span>
      <h1>{item.name}</h1>
      <div className="directory-card__meta">
        {item.isVerified && <span>تأییدشده</span>}
        {item.is24h && <span>۲۴ ساعته</span>}
      </div>
      <p>
        {item.province}، {item.city}
      </p>
      <p>{item.address}</p>
      {item.workingHours && <p>ساعات کاری: {item.workingHours}</p>}
      {item.phone && (
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
      <Link to="/clinics">بازگشت به فهرست کلینیک‌ها</Link>
    </article>
  );
}
