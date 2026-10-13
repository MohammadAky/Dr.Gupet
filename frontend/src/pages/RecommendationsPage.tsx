import '../styles/content-pages.css';
import { useQuery } from '@tanstack/react-query';
import { useLayoutEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/endpoints';
import { shopApi } from '../api/endpoints-shop';
import { queryKeys } from '../api/query-keys';
import { Pagination } from '../components/Pagination';
import { ProductCardView } from '../components/ProductCardView';
import { EmptyState, ErrorState, LoadingState } from '../components/states';
import { AccountFrame, AccountNav } from '../components/AccountNav';
import { useAuth } from '../auth/auth-provider';
import type { RecommendationItem } from '../api/types';

export function recommendationEvidence(card: Pick<RecommendationItem, 'matchedTags'>): string {
  const tags = [...new Set(card.matchedTags.map((tag) => tag.trim()).filter(Boolean))];
  return tags.length ? `تطابق رژیمی ثبت‌شده: ${tags.join('، ')}` : 'تطابق رژیمی مشخصی برای این محصول گزارش نشده است.';
}

export function parseRecommendationPage(params: URLSearchParams): number {
  const page = Number(params.get('page'));
  return Number.isSafeInteger(page) && page >= 1 ? page : 1;
}

/** Recommendations (F6): pick a pet, show matched diet tags. */
export function RecommendationsPage() {
  const { status, user } = useAuth();
  if (status === 'loading') return <AccountFrame title="پیشنهادها"><LoadingState layout="cards" /></AccountFrame>;
  if (status !== 'authed' || !user) return <p>برای دیدن پیشنهادها وارد حساب شوید.</p>;
  return <RecommendationsSession key={user.id} />;
}

function RecommendationsSession() {
  const [params, setParams] = useSearchParams();
  const active = useRef(true);
  useLayoutEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const pets = useQuery({
    queryKey: queryKeys.pets,
    queryFn: async ({ signal }) => {
      const result = await api.listPets();
      if (signal.aborted || !active.current)
        throw new DOMException('Inactive session', 'AbortError');
      return result;
    },
  });

  const urlPetId = Number(params.get('petId') ?? '0') || 0;
  const petId =
    Number.isSafeInteger(urlPetId) && pets.data?.some((pet) => pet.id === urlPetId)
      ? urlPetId
      : (pets.data?.[0]?.id ?? 0);
  const page = parseRecommendationPage(params);

  const recommendations = useQuery({
    queryKey: queryKeys.recommendations(petId, page),
    queryFn: async ({ signal }) => {
      const result = await shopApi.recommendations(petId, page);
      if (signal.aborted || !active.current)
        throw new DOMException('Inactive session', 'AbortError');
      return result;
    },
    enabled: petId > 0,
  });

  function selectPet(nextId: number) {
    const query = new URLSearchParams(params);
    query.set('petId', String(nextId));
    query.delete('page');
    setParams(query);
  }

  if (pets.isLoading) return <AccountFrame title="پیشنهادها"><LoadingState layout="cards" /></AccountFrame>;
  if (pets.error) return <AccountFrame title="پیشنهادها"><ErrorState error={pets.error} onRetry={() => void pets.refetch()} /></AccountFrame>;

  const petList = pets.data ?? [];
  if (petList.length === 0) {
    return (
      <section className="account-page">
        <AccountNav />
        <header className="account-heading">
          <div>
            <h1>پیشنهادها</h1>
            <p>پیشنهادهای شخصی، با شناخت بهتر همراه شما شروع می‌شوند.</p>
          </div>
        </header>
        <EmptyState
          text="برای دیدن پیشنهادها ابتدا حیوان خانگی خود را ثبت کنید."
          action={<Link to="/pets/new">ثبت حیوان</Link>}
        />
      </section>
    );
  }

  return (
    <section className="account-page" aria-busy={recommendations.isFetching}>
      <AccountNav />
      <header className="account-heading">
        <div>
          <h1>پیشنهادها برای {petList.find((pet) => pet.id === petId)?.name}</h1>
          <p>انتخاب‌هایی متناسب با اطلاعات ثبت‌شدهٔ همراهتان.</p>
        </div>
      </header>

      <div className="account-pet-selector">
        <label htmlFor="petSelect">حیوان</label>
        <select
          id="petSelect"
          value={petId}
          onChange={(event) => selectPet(Number(event.target.value))}
        >
          {petList.map((pet) => (
            <option key={pet.id} value={pet.id}>
              {pet.name}
            </option>
          ))}
        </select>
      </div>

      <p className="account-guidance">
        پیشنهادها از اطلاعات ثبت‌شدهٔ حیوان و محصول به دست می‌آیند. تطابق رژیمی هر محصول
        جداگانه نمایش داده می‌شود؛ این نتیجه تضمین سازگاری یا جایگزین مشاورهٔ دامپزشک نیست.
      </p>

      {recommendations.isLoading && <LoadingState layout="cards" />}
      {recommendations.error && (
        <ErrorState error={recommendations.error} onRetry={() => void recommendations.refetch()} />
      )}
      {recommendations.data && recommendations.data.data.length === 0 && (
        <EmptyState
          text={page > 1 ? 'در این صفحه پیشنهادی پیدا نشد.' : 'برای این حیوان پیشنهادی پیدا نشد؛ پروفایل او را کامل‌تر کنید.'}
          action={page > 1 ? <button type="button" disabled={recommendations.isFetching} onClick={() => {
            const query = new URLSearchParams(params);
            query.delete('page');
            setParams(query);
          }}>بازگشت به صفحهٔ اول</button> : <Link to={`/pets/${petId}/edit`}>ویرایش پروفایل</Link>}
        />
      )}

      {recommendations.data && recommendations.data.data.length > 0 && (
        <>
          <div className="product-grid">
            {recommendations.data.data.map((card) => (
              <div key={card.id}>
                <ProductCardView card={card} />
                <p className="recommendation-evidence">{recommendationEvidence(card)}</p>
              </div>
            ))}
          </div>
          <Pagination meta={recommendations.data.meta} busy={recommendations.isFetching} />
        </>
      )}
    </section>
  );
}
