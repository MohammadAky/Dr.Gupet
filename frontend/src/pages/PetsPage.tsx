import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/endpoints';
import { queryKeys } from '../api/query-keys';
import { useAuth } from '../auth/auth-provider';
import { EmptyState, ErrorState, LoadingState } from '../components/states';
import { MAX_PETS_PER_USER } from '../lib/constants';
import { formatWeight } from '../lib/format';
import { errorText, GENDER_FA, LIFE_STAGE_FA, TAG_TYPE_FA } from '../lib/labels';

/** Pets list (F4) — soft delete with confirmation. */
export function PetsPage() {
  const { status, user } = useAuth();
  const userId = status === 'authed' ? user?.id ?? null : null;
  if (userId === null) return <p>برای مشاهدهٔ حیوانات خود وارد حساب شوید.</p>;
  return <PetsContent key={userId} />;
}

function PetsContent() {
  const queryClient = useQueryClient();
  const active = useRef(true);
  const pets = useQuery({
    queryKey: queryKeys.pets,
    queryFn: async ({ signal }) => {
      const result = await api.listPets();
      if (signal.aborted || !active.current) throw new DOMException('Inactive session', 'AbortError');
      return result;
    },
  });
  const writing = useRef(false);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  useLayoutEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  const remove = useMutation({
    mutationFn: (id: number) => api.deletePet(id),
  });

  async function deletePet(id: number, name: string) {
    if (!active.current || writing.current || !window.confirm(`«${name}» حذف شود؟`)) return;
    writing.current = true;
    setPendingId(id);
    setNotice(null);
    try {
      await remove.mutateAsync(id);
      if (!active.current) return;
      await queryClient.invalidateQueries({ queryKey: queryKeys.pets });
      if (active.current) setNotice({ kind: 'success', text: 'حیوان حذف شد.' });
    } catch (error) {
      if (active.current) setNotice({ kind: 'error', text: errorText(error) });
    } finally {
      if (active.current) {
        writing.current = false;
        setPendingId(null);
      }
    }
  }

  if (pets.isLoading) return <LoadingState />;
  if (pets.error) return <ErrorState error={pets.error} onRetry={() => void pets.refetch()} />;

  const items = pets.data ?? [];
  const atLimit = items.length >= MAX_PETS_PER_USER;

  return (
    <section aria-busy={pendingId !== null}>
      <h1>حیوانات من</h1>
      {notice && <p role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}</p>}

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
                disabled={pendingId !== null}
                onClick={() => void deletePet(pet.id, pet.name)}
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
