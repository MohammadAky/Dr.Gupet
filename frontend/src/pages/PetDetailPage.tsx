import '../styles/content-pages.css';
import { useQuery } from '@tanstack/react-query';
import { useLayoutEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/endpoints';
import { queryKeys } from '../api/query-keys';
import { ErrorState, LoadingState } from '../components/states';
import { formatJalali } from '../lib/jalali';
import { GENDER_FA, LIFE_STAGE_FA, TAG_TYPE_FA } from '../lib/labels';
import { AccountFrame, AccountNav } from '../components/AccountNav';
import { SafeImage } from '../components/SafeImage';
import { safeImageUrl } from '../lib/image-url';
import { API_BASE_URL } from '../lib/env';
import { useAuth } from '../auth/auth-provider';

/** Pet detail (F4) with the entry point to recommendations (F6). */
export function PetDetailPage() {
  const { status, user } = useAuth();
  const { id } = useParams();
  if (status === 'loading') return <AccountFrame title="پروفایل حیوان"><LoadingState layout="detail" /></AccountFrame>;
  if (status !== 'authed' || !user) return <p>برای دیدن حیوان خود وارد حساب شوید.</p>;
  return <PetDetailSession key={`${user.id}:${id}`} userId={user.id} />;
}

function PetDetailSession({ userId }: { userId: number }) {
  const { id = '' } = useParams();
  const petId = Number(id);
  const validId = Number.isSafeInteger(petId) && petId > 0;
  const active = useRef(true);
  useLayoutEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  const pet = useQuery({
    queryKey: queryKeys.pet(petId),
    queryFn: async ({ signal }) => {
      const result = await api.getPet(petId);
      if (signal.aborted || !active.current)
        throw new DOMException('Inactive session', 'AbortError');
      if (result.id !== petId || result.userId !== userId)
        throw new Error('اطلاعات این حیوان برای حساب فعلی معتبر نیست.');
      return result;
    },
    enabled: validId,
  });

  if (!validId)
    return (
      <section className="account-page">
        <AccountNav />
        <h1>پروفایل حیوان</h1>
        <p role="alert">شناسهٔ حیوان معتبر نیست.</p>
        <Link to="/pets">بازگشت به حیوانات من</Link>
      </section>
    );
  if (pet.isLoading) return <AccountFrame title="پروفایل حیوان"><LoadingState layout="detail" /></AccountFrame>;
  if (pet.error) return <AccountFrame title="پروفایل حیوان"><ErrorState error={pet.error} onRetry={() => void pet.refetch()} /></AccountFrame>;
  if (!pet.data || pet.data.id !== petId || pet.data.userId !== userId) return null;

  const item = pet.data;
  const photo = safeImageUrl(item.photo, window.location.origin, API_BASE_URL);

  return (
    <article className="account-page account-detail-page">
      <AccountNav />
      <header className="account-heading">
        <div className="account-pet-identity">
          {photo ? (
            <SafeImage
              className="account-pet-photo"
              src={photo}
              alt={item.name}
              width={96}
              height={96}
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="account-pet-monogram" aria-hidden="true">
              {item.name.slice(0, 1)}
            </span>
          )}
          <div>
            <h1>{item.name}</h1>
            <p>
              {item.petType.name}
              {item.breed ? ` · ${item.breed.name}` : ''}
            </p>
          </div>
        </div>
        <Link className="account-secondary-link" to={`/pets/${item.id}/edit`}>
          ویرایش پروفایل
        </Link>
      </header>
      <dl className="account-facts">
        <div>
          <dt>مرحلهٔ زندگی</dt>
          <dd>{LIFE_STAGE_FA[item.lifeStage]}</dd>
        </div>
        {item.gender && (
          <div>
            <dt>جنسیت</dt>
            <dd>{GENDER_FA[item.gender]}</dd>
          </div>
        )}
        <div>
          <dt>عقیم‌شده</dt>
          <dd>{item.isNeutered ? 'بله' : 'خیر'}</dd>
        </div>
        {item.weightKg !== null && (
          <div>
            <dt>وزن</dt>
            <dd>{item.weightKg.toLocaleString('fa-IR', { maximumFractionDigits: 3 })} کیلوگرم</dd>
          </div>
        )}
        {item.birthDate && (
          <div>
            <dt>تولد</dt>
            <dd>{formatJalali(item.birthDate)}</dd>
          </div>
        )}
      </dl>

      <section>
        <h2>برچسب‌ها</h2>
        <ul className="account-tags">
          {item.tags.map((tag) => (
            <li key={tag.id}>
              {tag.name} ({TAG_TYPE_FA[tag.type]})
            </li>
          ))}
        </ul>
        {item.tags.length === 0 && (
          <p className="account-subtle">هنوز برچسبی برای این حیوان ثبت نشده است.</p>
        )}
      </section>

      <p className="account-actions">
        <Link className="account-primary-link" to={`/recommendations?petId=${item.id}`}>
          محصولات مناسب {item.name}
        </Link>
      </p>
      <p>
        <Link to="/pets">همه حیوانات</Link>
      </p>
    </article>
  );
}
