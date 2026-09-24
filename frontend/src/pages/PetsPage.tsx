import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../api/endpoints';
import { queryKeys } from '../api/query-keys';
import { EmptyState, ErrorState, LoadingState } from '../components/states';
import { MAX_PETS_PER_USER } from '../lib/constants';
import { formatWeight } from '../lib/format';
import { errorText, GENDER_FA, LIFE_STAGE_FA, TAG_TYPE_FA } from '../lib/labels';

/** Pets list (F4) — soft delete with confirmation. */
export function PetsPage() {
  const queryClient = useQueryClient();
  const pets = useQuery({ queryKey: queryKeys.pets, queryFn: () => api.listPets() });

  const remove = useMutation({
    mutationFn: (id: number) => api.deletePet(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.pets }),
    onError: (error) => alert(errorText(error)),
  });

  if (pets.isLoading) return <LoadingState />;
  if (pets.error) return <ErrorState error={pets.error} onRetry={() => void pets.refetch()} />;

  const items = pets.data ?? [];
  const atLimit = items.length >= MAX_PETS_PER_USER;

  return (
    <section>
      <h1>حیوانات من</h1>

      {items.length === 0 && (
        <EmptyState
          text="هنوز حیوان خانگی ثبت نکرده‌اید."
          action={<Link to="/pets/new">ثبت اولین حیوان</Link>}
        />
      )}

      <ul>
        {items.map((pet) => (
          <li key={pet.id}>
            <p>
              <Link to={`/pets/${pet.id}`}>{pet.name}</Link>
            </p>
            <p>
              {pet.petType.name}
              {pet.breed ? ` — ${pet.breed.name}` : ''} · {LIFE_STAGE_FA[pet.lifeStage]}
              {pet.gender ? ` · ${GENDER_FA[pet.gender]}` : ''}
              {pet.weightKg ? ` · ${formatWeight(Math.round(pet.weightKg * 1000))}` : ''}
            </p>
            <ul>
              {pet.tags.map((tag) => (
                <li key={tag.id}>
                  {tag.name} ({TAG_TYPE_FA[tag.type]})
                </li>
              ))}
            </ul>
            <p>
              <Link to={`/pets/${pet.id}/edit`}>ویرایش</Link>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`«${pet.name}» حذف شود؟`)) remove.mutate(pet.id);
                }}
              >
                حذف
              </button>
            </p>
          </li>
        ))}
      </ul>

      {!atLimit && <Link to="/pets/new">افزودن حیوان</Link>}
      {atLimit && <p>حداکثر {MAX_PETS_PER_USER} حیوان مجاز است.</p>}
    </section>
  );
}
