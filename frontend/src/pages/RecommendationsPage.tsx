import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/endpoints';
import { shopApi } from '../api/endpoints-shop';
import { queryKeys } from '../api/query-keys';
import { Pagination } from '../components/Pagination';
import { ProductCardView } from '../components/ProductCardView';
import { EmptyState, ErrorState, LoadingState } from '../components/states';

export function parseRecommendationPage(params: URLSearchParams): number {
  const page = Number(params.get('page'));
  return Number.isSafeInteger(page) && page >= 1 ? page : 1;
}

/** Recommendations (F6): pick a pet, show matched diet tags. */
export function RecommendationsPage() {
  const [params, setParams] = useSearchParams();
  const pets = useQuery({ queryKey: queryKeys.pets, queryFn: () => api.listPets() });

  const urlPetId = Number(params.get('petId') ?? '0') || 0;
  const petId = urlPetId > 0 ? urlPetId : (pets.data?.[0]?.id ?? 0);
  const page = parseRecommendationPage(params);

  const recommendations = useQuery({
    queryKey: queryKeys.recommendations(petId, page),
    queryFn: () => shopApi.recommendations(petId, page),
    enabled: petId > 0,
  });

  function selectPet(nextId: number) {
    const query = new URLSearchParams(params);
    query.set('petId', String(nextId));
    query.delete('page');
    setParams(query);
  }

  if (pets.isLoading) return <LoadingState />;
  if (pets.error) return <ErrorState error={pets.error} onRetry={() => void pets.refetch()} />;

  const petList = pets.data ?? [];
  if (petList.length === 0) {
    return (
      <section>
        <h1>پیشنهادها</h1>
        <EmptyState
          text="برای دیدن پیشنهادها ابتدا حیوان خانگی خود را ثبت کنید."
          action={<Link to="/pets/new">ثبت حیوان</Link>}
        />
      </section>
    );
  }

  return (
    <section>
      <h1>محصولات مناسب پت شما</h1>

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

      <p>
        پیشنهادها بر اساس سن، وزن، وضعیت عقیمی و برچسب‌های آلرژن/رژیمی ساخته می‌شوند؛ جایگزین
        مشاورهٔ دامپزشک نیستند.
      </p>

      {recommendations.isLoading && <LoadingState />}
      {recommendations.error && (
        <ErrorState error={recommendations.error} onRetry={() => void recommendations.refetch()} />
      )}
      {recommendations.data && recommendations.data.data.length === 0 && (
        <EmptyState
          text="برای این حیوان پیشنهادی پیدا نشد؛ پروفایل او را کامل‌تر کنید."
          action={<Link to={`/pets/${petId}/edit`}>ویرایش پروفایل</Link>}
        />
      )}

      {recommendations.data && recommendations.data.data.length > 0 && (
        <>
          <div className="product-grid">
            {recommendations.data.data.map((card) => (
              <ProductCardView key={card.id} card={card} matchedTags={card.matchedTags} />
            ))}
          </div>
          <Pagination meta={recommendations.data.meta} />
        </>
      )}
    </section>
  );
}
