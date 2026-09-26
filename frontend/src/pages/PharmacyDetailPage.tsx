import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { shopApi } from '../api/endpoints-shop';
import { queryKeys } from '../api/query-keys';
import { ErrorState, LoadingState } from '../components/states';

/** Pharmacy detail (F10): hours, phone, map link. */
export function PharmacyDetailPage() {
  const { id = '' } = useParams();
  const pharmacyId = Number(id);

  const pharmacy = useQuery({
    queryKey: queryKeys.pharmacy(pharmacyId),
    queryFn: () => shopApi.pharmacy(pharmacyId),
    enabled: Number.isFinite(pharmacyId) && pharmacyId > 0,
  });

  if (pharmacy.isLoading) return <LoadingState />;
  if (pharmacy.error)
    return <ErrorState error={pharmacy.error} onRetry={() => void pharmacy.refetch()} />;
  if (!pharmacy.data) return null;

  const item = pharmacy.data;
  const mapUrl =
    item.lat !== null && item.lng !== null
      ? `https://www.openstreetmap.org/?mlat=${item.lat}&mlon=${item.lng}#map=17/${item.lat}/${item.lng}`
      : null;

  return (
    <article>
      <h1>{item.name}</h1>
      <p>
        {item.isVerified && 'تأییدشده · '}
        {item.is24h && '۲۴ ساعته · '}
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
      <p>
        <Link to="/pharmacies">بازگشت به فهرست</Link>
      </p>
    </article>
  );
}
