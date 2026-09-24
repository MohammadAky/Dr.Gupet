import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { shopApi } from '../api/endpoints-shop';
import { queryKeys } from '../api/query-keys';
import { Pagination } from '../components/Pagination';
import { ProductCardView } from '../components/ProductCardView';
import { EmptyState, ErrorState, LoadingState } from '../components/states';

/** Home: category shortcuts + newest products (GET /products?sort=newest). */
export function HomePage() {
  const categories = useQuery({ queryKey: queryKeys.categories(), queryFn: () => shopApi.categories() });
  const newest = useQuery({
    queryKey: queryKeys.products({ sort: 'newest', limit: 8 }),
    queryFn: () => shopApi.products({ sort: 'newest', limit: 8 }),
  });

  return (
    <section>
      <h1>غذای خشک سگ و گربه</h1>

      <nav aria-label="دسته‌بندی‌ها">
        {categories.isLoading && <LoadingState />}
        {categories.error && <ErrorState error={categories.error} onRetry={() => void categories.refetch()} />}
        {categories.data && (
          <ul>
            {categories.data.map((category) => (
              <li key={category.id}>
                <Link to={`/products?categorySlug=${category.slug}`}>{category.name}</Link>
                {category.children.length > 0 && (
                  <ul>
                    {category.children.map((child) => (
                      <li key={child.id}>
                        <Link to={`/products?categorySlug=${child.slug}`}>{child.name}</Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </nav>

      <h2>جدیدترین محصولات</h2>
      {newest.isLoading && <LoadingState />}
      {newest.error && <ErrorState error={newest.error} onRetry={() => void newest.refetch()} />}
      {newest.data && newest.data.data.length === 0 && <EmptyState text="محصولی برای نمایش وجود ندارد." />}
      {newest.data && newest.data.data.length > 0 && (
        <>
          <div className="product-grid">
            {newest.data.data.map((card) => (
              <ProductCardView key={card.id} card={card} />
            ))}
          </div>
          <Pagination meta={newest.data.meta} />
        </>
      )}
    </section>
  );
}
