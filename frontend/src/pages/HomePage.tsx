import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { shopApi } from '../api/endpoints-shop';
import { api } from '../api/endpoints';
import { queryKeys } from '../api/query-keys';
import { ProductCardView } from '../components/ProductCardView';
import { EmptyState, ErrorState, LoadingState } from '../components/states';

const journeys = [
  {
    number: '۰۱',
    title: 'محصول مناسبش را پیدا کنم',
    description: 'فهرست محصولات را ببینید و با فیلترهای دقیق‌تر به انتخاب نزدیک شوید.',
    to: '/products',
    action: 'رفتن به محصولات',
    className: 'home-journey--shop',
  },
  {
    number: '۰۲',
    title: 'دربارهٔ دارو بیشتر بدانم',
    description: 'اطلاعات ثبت‌شدهٔ داروها را برای مطالعه مرور کنید؛ تصمیم درمانی با دامپزشک است.',
    to: '/medicines',
    action: 'دیدن اطلاعات داروها',
    className: 'home-journey--medicine',
  },
  {
    number: '۰۳',
    title: 'مرکز نزدیکم را پیدا کنم',
    description: 'داروخانه‌ها و کلینیک‌های ثبت‌شده را بر اساس موقعیت جستجو کنید.',
    to: '/clinics',
    action: 'جستجوی کلینیک‌ها',
    className: 'home-journey--care',
  },
] as const;

const discoveryLinks = [
  {
    to: '/medicines',
    title: 'اطلاعات داروها',
    description: 'پیش از تصمیم درمانی، آگاه‌تر شوید.',
    image: 'medicine',
  },
  {
    to: '/pharmacies',
    title: 'داروخانه‌ها',
    description: 'مسیر پیدا کردن داروخانهٔ نزدیک شما.',
    image: 'pharmacy',
  },
  {
    to: '/clinics',
    title: 'کلینیک‌ها',
    description: 'یک قدم نزدیک‌تر به مراقبت از همراهتان.',
    image: 'clinic',
  },
] as const;

export function HomePage() {
  const [activeDiscovery, setActiveDiscovery] = useState(0);
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
  const allUnavailable = Boolean(
    categories.error && petTypes.error && newest.error && health.error,
  );

  useEffect(() => {
    if (
      !('IntersectionObserver' in window) ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return;
    const sections = document.querySelectorAll<HTMLElement>('[data-home-reveal]');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px 24px 0px' },
    );
    sections.forEach((section) => observer.observe(section));
    document.documentElement.classList.add('home-motion-ready');
    return () => {
      observer.disconnect();
      document.documentElement.classList.remove('home-motion-ready');
    };
  }, []);

  return (
    <div className="home-page">
      <section className="home-hero" aria-labelledby="hero-title">
        <div className="home-hero__inner site-container">
          <div className="home-hero__copy">
            <p className="home-hero__eyebrow">
              <span aria-hidden="true" /> دنیای بهتر برای همراهان ما
            </p>
            <h1 id="hero-title">
              هر انتخاب،
              <br />
              <em>یک حالِ بهتر.</em>
            </h1>
            <p className="home-hero__lead">
              برای خرید، شناخت دارو و پیدا کردن مراکز مراقبت، از همین‌جا شروع کنید. هر مسیر، با
              اطلاعات روشن و انتخاب در دست شما.
            </p>
            <div className="home-hero__actions">
              <Link className="button-primary" to="/products">
                کشف محصولات <span aria-hidden="true">←</span>
              </Link>
              <a className="button-secondary" href="#home-paths">
                مسیرهای دیگر <span aria-hidden="true">↓</span>
              </a>
            </div>
            <p className="home-hero__footnote">از انتخاب روزمره تا پرسش‌های مهم‌تر دربارهٔ سلامت</p>
          </div>
          <div className="home-hero__visual" aria-hidden="true">
            <div className="home-hero__orb" />
            <img
              className="home-hero__dog"
              src="/brand/dog-portrait.jpg"
              width="415"
              height="415"
              alt=""
              fetchPriority="high"
            />
            <img
              className="home-hero__cat"
              src="/brand/cat-portrait.jpg"
              width="145"
              height="145"
              alt=""
            />
            <span className="home-hero__visual-label">
              دکتر گوپت <span>برای زندگی کنار هم</span>
            </span>
          </div>
        </div>
        <div className="home-hero__scroll site-container" aria-hidden="true">
          <span>پایین‌تر بروید</span>
          <span className="home-hero__scroll-line" />
        </div>
      </section>

      <section
        id="home-paths"
        className="home-chapter site-container"
        aria-labelledby="paths-title"
        data-home-reveal
      >
        <div className="home-chapter__intro">
          <p className="section-eyebrow">از نیاز شما شروع می‌کنیم / ۰۱</p>
          <h2 id="paths-title">
            امروز برای همراهتان
            <br />
            <span>دنبال چه هستید؟</span>
          </h2>
          <p>یک نقطهٔ شروع ساده؛ جزئیات هر موضوع را در صفحهٔ خودش ببینید.</p>
        </div>
        <div className="home-journeys">
          {journeys.map((journey) => (
            <Link
              key={journey.number}
              to={journey.to}
              className={`home-journey ${journey.className}`}
            >
              <span className="home-journey__number">{journey.number}</span>
              <span className="home-journey__content">
                <strong>{journey.title}</strong>
                <span>{journey.description}</span>
              </span>
              <span className="home-journey__action">
                {journey.action} <span aria-hidden="true">←</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="home-companions" aria-labelledby="companions-title" data-home-reveal>
        <div className="site-container">
          {allUnavailable && (
            <ErrorState
              error="ارتباط با سرویس فروشگاه برقرار نشد. بخش‌های زنده پس از اتصال نمایش داده می‌شوند."
              onRetry={() => {
                void Promise.all([
                  categories.refetch(),
                  petTypes.refetch(),
                  newest.refetch(),
                  health.refetch(),
                ]);
              }}
            />
          )}
          <div className="section-head">
            <div>
              <p className="section-eyebrow">برای هر همراه، انتخاب خودش / ۰۲</p>
              <h2 id="companions-title">
                دنیای کوچک آن‌ها،
                <br />
                تمام دنیای ماست.
              </h2>
            </div>
            <Link to="/products">
              همهٔ محصولات <span aria-hidden="true">←</span>
            </Link>
          </div>
          <div className="home-companions__grid" aria-busy={petTypes.isLoading}>
            {[
              { type: dogType, image: 'companion-dog-960.webp', title: 'برای سگ‌ها', number: '۰۱' },
              {
                type: catType,
                image: 'companion-cat-960.webp',
                title: 'برای گربه‌ها',
                number: '۰۲',
              },
            ].map(({ type, image, title, number }) => {
              const content = (
                <>
                  <img
                    src={`/brand/${image}`}
                    width="960"
                    height="720"
                    loading="lazy"
                    decoding="async"
                    alt=""
                  />
                  <span className="home-companion__shade" />
                  <span className="home-companion__number">{number}</span>
                  <span className="home-companion__caption">
                    <strong>{title}</strong>
                    <span>
                      {type
                        ? 'محصولات را کشف کنید'
                        : petTypes.isLoading
                          ? 'در حال آماده‌سازی…'
                          : 'دسته‌بندی در دسترس نیست'}
                    </span>
                  </span>
                  {type && (
                    <span className="home-companion__arrow" aria-hidden="true">
                      ←
                    </span>
                  )}
                </>
              );
              return type ? (
                <Link
                  key={title}
                  className="home-companion"
                  to={`/products?petTypeId=${type.id}`}
                  aria-label={`${title}، مرور محصولات`}
                >
                  {content}
                </Link>
              ) : (
                <div key={title} className="home-companion">
                  {content}
                </div>
              );
            })}
          </div>
          {!allUnavailable && petTypes.error && (
            <ErrorState error={petTypes.error} onRetry={() => void petTypes.refetch()} />
          )}
          {categories.isLoading && <LoadingState />}
          {!allUnavailable && categories.error && (
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
        </div>
      </section>

      <section
        className="home-discovery site-container"
        aria-labelledby="discovery-title"
        data-home-reveal
      >
        <div className="home-discovery__backdrop" aria-hidden="true">
          {discoveryLinks.map((item, index) => (
            <img
              key={item.image}
              className={activeDiscovery === index ? 'is-active' : ''}
              src={`/brand/discovery-${item.image}-960.webp`}
              srcSet={`/brand/discovery-${item.image}-480.webp 480w, /brand/discovery-${item.image}-960.webp 960w`}
              sizes="(max-width: 760px) 100vw, 1240px"
              width="960"
              height="720"
              loading="lazy"
              decoding="async"
              alt=""
            />
          ))}
        </div>
        <div className="home-discovery__statement">
          <p className="section-eyebrow">انتخاب آگاهانه / ۰۳</p>
          <h2 id="discovery-title">
            کمتر حدس بزنید.
            <br />
            <span>بیشتر بدانید.</span>
          </h2>
          <p>
            اطلاعات محصول، دارو و مراکز را در مسیرهای جداگانه ببینید؛ هر وقت آماده بودید، وارد
            جزئیات شوید.
          </p>
        </div>
        <div className="home-discovery__links">
          {discoveryLinks.map((item, index) => (
            <Link
              key={item.to}
              to={item.to}
              className={activeDiscovery === index ? 'is-active' : ''}
              onPointerEnter={() => setActiveDiscovery(index)}
              onFocus={() => setActiveDiscovery(index)}
            >
              <span className="home-discovery__label">
                <strong>{item.title}</strong>
                <span>{item.description}</span>
              </span>
              <span className="home-discovery__arrow" aria-hidden="true">
                ↖
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section
        className="home-products site-container"
        aria-labelledby="newest-title"
        data-home-reveal
      >
        <div className="section-head">
          <div>
            <p className="section-eyebrow">تازه در فروشگاه / ۰۴</p>
            <h2 id="newest-title">برای شروع، این‌ها را ببینید.</h2>
          </div>
          <Link to="/products">
            فهرست کامل <span aria-hidden="true">←</span>
          </Link>
        </div>
        {newest.isLoading && <LoadingState />}
        {!allUnavailable && newest.error && (
          <ErrorState error={newest.error} onRetry={() => void newest.refetch()} />
        )}
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

      <section className="home-ending" data-home-reveal>
        <div className="site-container home-ending__inner">
          <span className="home-ending__mark" aria-hidden="true">
            ✳
          </span>
          <p className="section-eyebrow">همراهی از همین‌جا آغاز می‌شود</p>
          <h2>
            حال خوبشان،
            <br />
            از انتخاب‌های کوچک ما شروع می‌شود.
          </h2>
          <Link className="button-primary" to="/products">
            شروع جستجو <span aria-hidden="true">←</span>
          </Link>
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
        {!allUnavailable && health.error && (
          <ErrorState error={health.error} onRetry={() => void health.refetch()} />
        )}
      </section>
    </div>
  );
}
