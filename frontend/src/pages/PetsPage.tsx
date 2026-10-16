import '../styles/content-pages.css';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/endpoints';
import { queryKeys } from '../api/query-keys';
import { useAuth } from '../auth/auth-provider';
import { EmptyState, ErrorState, LoadingState } from '../components/states';
import { MAX_PETS_PER_USER } from '../lib/constants';
import { GENDER_FA, LIFE_STAGE_FA, TAG_TYPE_FA } from '../lib/labels';
import { AccountFrame, AccountNav } from '../components/AccountNav';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { SafeImage } from '../components/SafeImage';
import { API_BASE_URL } from '../lib/env';
import { safeImageUrl } from '../lib/image-url';

/** Pets list (F4) — soft delete with confirmation. */
export function PetsPage() {
  const { status, user } = useAuth();
  const userId = status === 'authed' ? (user?.id ?? null) : null;
  if (status === 'loading') return <AccountFrame title="حیوانات من"><LoadingState layout="cards" /></AccountFrame>;
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
      if (signal.aborted || !active.current)
        throw new DOMException('Inactive session', 'AbortError');
      return result;
    },
  });
  const writing = useRef(false);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const [deleting, setDeleting] = useState<{ id: number; name: string } | null>(null);

  useLayoutEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  const remove = useMutation({
    mutationFn: (id: number) => api.deletePet(id),
  });

  async function deletePet(id: number) {
    if (!active.current || writing.current) return;
    writing.current = true;
    setPendingId(id);
    setNotice(null);
    try {
      await remove.mutateAsync(id);
      if (!active.current) return;
      await queryClient.invalidateQueries({ queryKey: queryKeys.pets });
      if (active.current) setNotice({ kind: 'success', text: 'حیوان حذف شد.' });
    } finally {
      if (active.current) {
        writing.current = false;
        setPendingId(null);
      }
    }
  }

  if (pets.isLoading) return <AccountFrame title="حیوانات من"><LoadingState layout="cards" /></AccountFrame>;
  if (pets.error) return <AccountFrame title="حیوانات من"><ErrorState error={pets.error} onRetry={() => void pets.refetch()} /></AccountFrame>;

  const items = pets.data ?? [];
  const atLimit = items.length >= MAX_PETS_PER_USER;

  return (
    <section className="account-page" aria-busy={pendingId !== null}>
      <AccountNav />
      <header className="account-heading">
        <div>
          <h1>حیوانات من</h1>
        </div>
        {!atLimit && items.length > 0 && (
          <Link className="account-primary-link" to="/pets/new">
            افزودن حیوان <span aria-hidden="true">+</span>
          </Link>
        )}
      </header>
      {notice && <p role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}</p>}

      {items.length === 0 && (
        <EmptyState
          text="هنوز حیوان خانگی ثبت نکرده‌اید."
          action={<Link to="/pets/new">ثبت حیوان</Link>}
        />
      )}

      <ul className="account-list account-pets">
        {items.map((pet) => {
          const image = safeImageUrl(pet.photo, window.location.origin, API_BASE_URL);
          return (
            <li key={pet.id}>
              <div className="account-pet-identity">
                {image ? (
                  <SafeImage
                    className="account-pet-photo"
                    src={image}
                    alt={pet.name}
                    width={76}
                    height={76}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="account-pet-monogram" aria-hidden="true">
                    {pet.name.slice(0, 1)}
                  </span>
                )}
                <div>
                  <p>
                    <Link to={`/pets/${pet.id}`}>{pet.name}</Link>
                  </p>
                  <span className="account-subtle">
                    {pet.petType.name}
                    {pet.breed ? ` · ${pet.breed.name}` : ''}
                  </span>
                </div>
              </div>
              <p>
                {LIFE_STAGE_FA[pet.lifeStage]}
                {pet.gender ? ` · ${GENDER_FA[pet.gender]}` : ''}
                {pet.weightKg !== null
                  ? ` · ${pet.weightKg.toLocaleString('fa-IR', { maximumFractionDigits: 3 })} کیلوگرم`
                  : ''}
              </p>
              <ul className="account-tags">
                {pet.tags.map((tag) => (
                  <li key={tag.id}>
                    {tag.name} ({TAG_TYPE_FA[tag.type]})
                  </li>
                ))}
              </ul>
              <p className="account-actions">
                <Link to={`/pets/${pet.id}`}>پروفایل</Link>
                <Link to={`/pets/${pet.id}/edit`}>ویرایش</Link>
                <button
                  className="account-danger"
                  type="button"
                  disabled={pendingId !== null}
                  onClick={() => { setNotice(null); setDeleting({ id: pet.id, name: pet.name }); }}
                >
                  حذف
                </button>
              </p>
            </li>
          );
        })}
      </ul>

      {atLimit && <p>حداکثر {MAX_PETS_PER_USER} حیوان مجاز است.</p>}
      <ConfirmDialog open={deleting !== null} title={`حذف «${deleting?.name ?? ''}»`}
        description="پروفایل این حیوان از فهرست شما حذف می‌شود. بازگردانی از این صفحه امکان‌پذیر نیست."
        confirmLabel="حذف حیوان" onClose={() => setDeleting(null)}
        onConfirm={() => deleting ? deletePet(deleting.id) : undefined} />
    </section>
  );
}
