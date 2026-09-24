import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { shopApi } from '../api/endpoints-shop';
import { queryKeys } from '../api/query-keys';
import { ErrorState, LoadingState } from '../components/states';
import { formatRelativeJalali } from '../lib/jalali';

/** Medicine detail (F10): server-supplied disclaimer is rendered verbatim. */
export function MedicineDetailPage() {
  const { id = '' } = useParams();
  const medicineId = Number(id);
  const [city, setCity] = useState('');

  const medicine = useQuery({
    queryKey: queryKeys.medicine(medicineId),
    queryFn: () => shopApi.medicine(medicineId),
    enabled: Number.isFinite(medicineId) && medicineId > 0,
  });

  if (medicine.isLoading) return <LoadingState />;
  if (medicine.error) return <ErrorState error={medicine.error} onRetry={() => void medicine.refetch()} />;
  if (!medicine.data) return null;

  const item = medicine.data;
  const pharmacies = city.trim()
    ? item.pharmacies.filter((row) => row.city.includes(city.trim()))
    : item.pharmacies;

  return (
    <article>
      <h1>{item.name}</h1>
      <p>
        {item.activeIngredient && <>مادهٔ مؤثره: {item.activeIngredient} · </>}
        {item.type && <>{item.type} · </>}
        {item.requiresPrescription ? 'نیازمند نسخه' : 'بدون نسخه'}
      </p>
      <ul>
        {item.petTypes.map((type) => (
          <li key={type.id}>{type.name}</li>
        ))}
      </ul>
      <p>{item.usage ?? '—'}</p>
      {item.notes && <p>{item.notes}</p>}

      <p role="note" className="disclaimer">
        {item.disclaimer}
      </p>

      <section>
        <h2>داروخانه‌های دارندهٔ این دارو</h2>
        <label htmlFor="cityFilter">فیلتر شهر</label>
        <input id="cityFilter" value={city} onChange={(event) => setCity(event.target.value)} />

        {pharmacies.length === 0 && <p>داروخانه‌ای یافت نشد.</p>}
        <ul>
          {pharmacies.map((row) => (
            <li key={row.id}>
              <p>
                <Link to={`/pharmacies/${row.id}`}>{row.name}</Link>{' '}
                {row.isVerified && '(تأییدشده)'} {row.is24h && '(۲۴ ساعته)'}
              </p>
              <p>{row.address}</p>
              {row.phone && (
                <p>
                  <a dir="ltr" href={`tel:${row.phone}`}>
                    {row.phone}
                  </a>
                </p>
              )}
              <p>آخرین تأیید: {formatRelativeJalali(row.lastConfirmedAt)}</p>
              {row.note && <p>{row.note}</p>}
            </li>
          ))}
        </ul>
      </section>

      <p>
        <Link to="/medicines">بازگشت به فهرست دارو‌ها</Link>
      </p>
    </article>
  );
}
