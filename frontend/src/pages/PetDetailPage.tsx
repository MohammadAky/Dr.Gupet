import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/endpoints';
import { queryKeys } from '../api/query-keys';
import { ErrorState, LoadingState } from '../components/states';
import { formatJalali } from '../lib/jalali';
import { formatWeight } from '../lib/format';
import { GENDER_FA, LIFE_STAGE_FA, TAG_TYPE_FA } from '../lib/labels';

/** Pet detail (F4) with the entry point to recommendations (F6). */
export function PetDetailPage() {
  const { id = '' } = useParams();
  const petId = Number(id);

  const pet = useQuery({
    queryKey: queryKeys.pet(petId),
    queryFn: () => api.getPet(petId),
    enabled: Number.isFinite(petId) && petId > 0,
  });

  if (pet.isLoading) return <LoadingState />;
  if (pet.error) return <ErrorState error={pet.error} onRetry={() => void pet.refetch()} />;
  if (!pet.data) return null;

  const item = pet.data;

  return (
    <article>
      <h1>{item.name}</h1>
      <p>
        {item.petType.name}
        {item.breed ? ` — ${item.breed.name}` : ''}
      </p>
      <ul>
        <li>مرحلهٔ زندگی: {LIFE_STAGE_FA[item.lifeStage]}</li>
        {item.gender && <li>جنسیت: {GENDER_FA[item.gender]}</li>}
        <li>عقیم‌شده: {item.isNeutered ? 'بله' : 'خیر'}</li>
        {item.weightKg && <li>وزن: {formatWeight(Math.round(item.weightKg * 1000))}</li>}
        {item.birthDate && <li>تولد: {formatJalali(item.birthDate)}</li>}
      </ul>

      <section>
        <h2>برچسب‌ها</h2>
        <ul>
          {item.tags.map((tag) => (
            <li key={tag.id}>
              {tag.name} ({TAG_TYPE_FA[tag.type]})
            </li>
          ))}
        </ul>
      </section>

      <p>
        <Link to={`/recommendations?petId=${item.id}`}>محصولات مناسب {item.name}</Link>
      </p>
      <p>
        <Link to={`/pets/${item.id}/edit`}>ویرایش</Link> · <Link to="/pets">همه حیوانات</Link>
      </p>
    </article>
  );
}
