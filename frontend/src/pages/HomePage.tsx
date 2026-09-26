import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { shopApi } from '../api/endpoints-shop';
import { api } from '../api/endpoints';
import { queryKeys } from '../api/query-keys';
import { ProductCardView } from '../components/ProductCardView';
import { EmptyState, ErrorState, LoadingState } from '../components/states';

export function HomePage() {
  const categories = useQuery({
    queryKey: queryKeys.categories(),
    queryFn: () => shopApi.categories(),
  });
  const petTypes = useQuery({ queryKey: queryKeys.petTypes, queryFn: () => api.petTypes() });
  const newest = useQuery({
    queryKey: queryKeys.products({ sort: 'newest', limit: 8 }),
    queryFn: () => shopApi.products({ sort: 'newest', limit: 8 }),
  });
  const health = useQuery({ queryKey: queryKeys.health, queryFn: () => api.health() });
  const dogType = petTypes.data?.find(
    (type) => type.name === 'سگ' || type.slug.toLowerCase() === 'dog',
  );
  const catType = petTypes.data?.find(
    (type) => type.name === 'گربه' || type.slug.toLowerCase() === 'cat',
  );

  return (
    <div className="home-page">
      <section className="home-hero site-container" aria-labelledby="hero-title">
        <div className="hero-surface">
          <div className="hero-copy">
            <span className="hero-kicker">برای همراهان دوست‌داشتنی شما</span>
            <h1 id="hero-title">
              انتخابی بهتر برای <em>دوست پشمالوی</em> شما
            </h1>
            <p>
              محصولات سگ و گربه را یک‌جا ببینید، ویژگی‌ها را بررسی کنید و با آگاهی بیشتر انتخاب
              کنید.
            </p>
            <div className="hero-actions">
              <Link className="button-primary" to="/products">
                مشاهدهٔ محصولات <span aria-hidden="true">←</span>
              </Link>
              <Link className="button-secondary" to="/medicines">
                اطلاعات داروها
              </Link>
            </div>
            <div className="hero-meta">
              <span>جستجوی آسان</span>
              <span>جزئیات روشن محصولات</span>
            </div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <img
              className="hero-dog"
              src="/brand/dog-portrait.jpg"
              width="415"
              height="415"
              alt=""
              fetchPriority="high"
            />
            <img
              className="hero-cat"
              src="/brand/cat-portrait.jpg"
              width="145"
              height="145"
              alt=""
            />
            <div className="hero-stamp">
              با عشق برای <strong>حیوانات</strong> خانگی
            </div>
          </div>
        </div>
      </section>

      <section className="home-section site-container" aria-labelledby="categories-title">
        <div className="section-head">
          <div>
            <p className="section-eyebrow">کاوش کنید</p>
            <h2 id="categories-title">از کجا شروع کنیم؟</h2>
          </div>
          <Link to="/products">همهٔ محصولات ←</Link>
        </div>
        <div className="category-grid" aria-busy={petTypes.isLoading}>
          {[
            { type: dogType, image: 'dog-portrait.jpg', title: 'برای سگ‌ها', color: 'gold' },
            { type: catType, image: 'cat-portrait.jpg', title: 'برای گربه‌ها', color: 'green' },
          ].map(({ type, image, title, color }) => {
            const content = (
              <>
                <span className={`category-visual category-visual--${color}`}>
                  <img src={`/brand/${image}`} width="112" height="112" loading="lazy" alt="" />
                </span>
                <strong>{title}</strong>
                <small>
                  {type
                    ? 'مرور و فیلتر محصولات'
                    : petTypes.isLoading
                      ? 'در حال آماده‌سازی…'
                      : 'دسته‌بندی در دسترس نیست'}
                </small>
              </>
            );
            return type ? (
              <Link key={title} className="category-card" to={`/products?petTypeId=${type.id}`}>
                {content}
              </Link>
            ) : (
              <div key={title} className="category-card">
                {content}
              </div>
            );
          })}
          <Link className="category-card" to="/medicines">
            <span className="category-visual category-visual--gold">
              <svg
                width="64"
                height="64"
                viewBox="0 0 64 64"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                aria-hidden="true"
              >
                <rect x="8" y="21" width="48" height="26" rx="13" />
                <path d="M32 21v26M19 10h26M32 5v10" />
              </svg>
            </span>
            <strong>اطلاعات داروها</strong>
            <small>برای مطالعه و آگاهی</small>
          </Link>
          <Link className="category-card" to="/pharmacies">
            <span className="category-visual category-visual--green">
              <svg
                width="64"
                height="64"
                viewBox="0 0 64 64"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                aria-hidden="true"
              >
                <path d="M13 53V23l19-12 19 12v30H13Z" />
                <path d="M25 53V37h14v16M32 22v11M26.5 27.5h11" />
              </svg>
            </span>
            <strong>داروخانه‌ها</strong>
            <small>جستجوی اطلاعات مراکز</small>
          </Link>
        </div>
        {petTypes.error && (
          <ErrorState error={petTypes.error} onRetry={() => void petTypes.refetch()} />
        )}
        {categories.isLoading && <LoadingState />}
        {categories.error && (
          <ErrorState error={categories.error} onRetry={() => void categories.refetch()} />
        )}
        {categories.data && categories.data.length > 0 && (
          <nav className="category-shortcuts" aria-label="دسته‌بندی‌های محصولات">
            {categories.data.map((category) => (
              <Link
                key={category.id}
                to={`/products?categorySlug=${encodeURIComponent(category.slug)}`}
              >
                {category.name}
              </Link>
            ))}
          </nav>
        )}
      </section>

      <div className="promo-grid site-container">
        <section className="promo-card promo-card--green">
          <span>راهنمای انتخاب</span>
          <h2>به دنبال محصول مناسب برای همراهتان هستید؟</h2>
          <p>می‌توانید محصولات را بر اساس ویژگی‌های ثبت‌شده در فهرست بررسی کنید.</p>
          <Link to="/products">شروع جستجو ←</Link>
        </section>
        <section className="promo-card promo-card--gold">
          <span>دانستنی‌های سلامت</span>
          <h2>اطلاعات دارویی، با مرز روشن</h2>
          <p>اطلاعات این بخش آموزشی است و جایگزین مشاورهٔ دامپزشک نیست.</p>
          <Link to="/medicines">مطالعهٔ اطلاعات ←</Link>
        </section>
      </div>

      <section className="home-section site-container" aria-labelledby="newest-title">
        <div className="section-head">
          <div>
            <p className="section-eyebrow">تازه در فروشگاه</p>
            <h2 id="newest-title">جدیدترین محصولات</h2>
          </div>
          <Link to="/products">دیدن همه ←</Link>
        </div>
        {newest.isLoading && <LoadingState />}
        {newest.error && <ErrorState error={newest.error} onRetry={() => void newest.refetch()} />}
        {newest.data && newest.data.data.length === 0 && (
          <EmptyState text="هنوز محصولی برای نمایش وجود ندارد." />
        )}
        {newest.data && newest.data.data.length > 0 && (
          <div className="product-grid">
            {newest.data.data.map((card) => (
              <ProductCardView key={card.id} card={card} />
            ))}
          </div>
        )}
      </section>

      <section className="trust-strip" aria-label="ویژگی‌های تجربهٔ دکتر گوپت">
        <div className="trust-grid site-container">
          <div className="trust-item">
            <span className="trust-item__icon" aria-hidden="true">
              ✓
            </span>
            <div>
              <strong>اطلاعات روشن</strong>
              <span>ویژگی‌های محصول، در دسترس هنگام انتخاب</span>
            </div>
          </div>
          <div className="trust-item">
            <span className="trust-item__icon" aria-hidden="true">
              ⌕
            </span>
            <div>
              <strong>جستجوی ساده</strong>
              <span>مسیر روشن از جستجو تا جزئیات</span>
            </div>
          </div>
          <div className="trust-item">
            <span className="trust-item__icon" aria-hidden="true">
              ♡
            </span>
            <div>
              <strong>برای همراهان شما</strong>
              <span>تجربه‌ای فارسی و سازگار با موبایل</span>
            </div>
          </div>
        </div>
      </section>
      <section className="health-status site-container" aria-label="وضعیت سرویس">
        <strong>وضعیت اتصال فروشگاه</strong>
        {health.isLoading && <LoadingState text="در حال بررسی اتصال…" />}
        {health.data && (
          <p role="status">
            {health.data.status === 'ok' ? 'سرویس در دسترس است.' : 'وضعیت سرویس نیازمند بررسی است.'}
          </p>
        )}
        {health.error && <ErrorState error={health.error} onRetry={() => void health.refetch()} />}
      </section>
    </div>
  );
}
