import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { shopApi } from '../api/endpoints-shop';
import { queryKeys } from '../api/query-keys';
import { ErrorState, LoadingState } from '../components/states';
import { clinicArtwork } from '../lib/image-url';

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
    <article className="directory-detail clinic-detail">
      <figure className="clinic-detail__image">
        <img
          src={`${clinicArtwork(item.id)}-960.webp`}
          width="960"
          height="720"
          decoding="async"
          alt=""
        />
        <figcaption>تصویر نمادین؛ عکس این مرکز نیست</figcaption>
      </figure>
      <div className="clinic-detail__body">
        <Link className="clinic-detail__back" to="/clinics">
          بازگشت به کلینیک‌ها <span aria-hidden="true">←</span>
        </Link>
        <span className="eyebrow">راهنمای کلینیک‌ها</span>
        <h1>{item.name}</h1>
        <div className="directory-card__meta">
          {item.isVerified && <span>تأییدشده</span>}
          {item.is24h && <span>۲۴ ساعته</span>}
        </div>
        <p className="clinic-card__location">
          {item.province}، {item.city}
        </p>
        <dl className="clinic-detail__facts">
          <div>
            <dt>نشانی</dt>
            <dd>{item.address}</dd>
          </div>
          <div>
            <dt>ساعات کاری</dt>
            <dd>{item.workingHours || 'ساعات کاری ثبت نشده است.'}</dd>
          </div>
        </dl>
        <div className="clinic-detail__actions">
          {item.phone && (
            <a className="clinic-detail__contact" href={`tel:${item.phone}`}>
              تماس با مرکز <bdi dir="ltr">{item.phone}</bdi>
            </a>
          )}
          {mapUrl && (
            <a className="clinic-detail__map" href={mapUrl} target="_blank" rel="noreferrer">
              نمایش روی نقشه
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
