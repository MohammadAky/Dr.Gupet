import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';
import { queryKeys } from '../api/query-keys';

const brand = 'دکتر گوپت';
const pages: Record<string, [string, string, boolean]> = {
  '/': [
    brand,
    'محصولات حیوانات خانگی، اطلاعات داروها و راهنمای داروخانه‌ها و کلینیک‌های دامپزشکی.',
    true,
  ],
  '/products': [
    'محصولات',
    'محصولات حیوانات خانگی را بر اساس نوع حیوان، برند، وزن و قیمت بررسی کنید.',
    true,
  ],
  '/medicines': [
    'اطلاعات داروها',
    'اطلاعات دارویی حیوانات خانگی برای مطالعه؛ تصمیم درمانی با دامپزشک است.',
    true,
  ],
  '/pharmacies': [
    'داروخانه‌ها',
    'راهنمای داروخانه‌های دامپزشکی و اطلاعات تماس و موقعیت مراکز ثبت‌شده.',
    true,
  ],
  '/clinics': [
    'کلینیک‌ها',
    'راهنمای کلینیک‌های دامپزشکی و اطلاعات تماس، موقعیت و ساعات کاری ثبت‌شده.',
    true,
  ],
  '/login': ['ورود', 'ورود امن به حساب با شمارهٔ موبایل و کد یک‌بارمصرف.', false],
  '/verify': ['تأیید شماره', 'تأیید شمارهٔ موبایل برای ورود به حساب.', false],
  '/profile': ['حساب من', 'مدیریت اطلاعات حساب.', false],
  '/addresses': ['آدرس‌های من', 'مدیریت آدرس‌های تحویل حساب.', false],
  '/pets': ['حیوانات من', 'مدیریت اطلاعات حیوانات خانگی حساب.', false],
  '/recommendations': ['پیشنهادها', 'پیشنهادهای متناسب با اطلاعات حیوان خانگی.', false],
  '/favorites': ['علاقه‌مندی‌ها', 'محصولات ذخیره‌شده در حساب.', false],
  '/cart': ['سبد خرید', 'بررسی سبد خرید حساب.', false],
  '/checkout': ['تکمیل خرید', 'انتخاب آدرس و ثبت سفارش.', false],
  '/payment/result': ['نتیجهٔ پرداخت', 'بررسی وضعیت قطعی سفارش از سامانه.', false],
  '/orders': ['سفارش‌های من', 'پیگیری سفارش‌های حساب.', false],
};

function routeInfo(pathname: string) {
  const path = pathname.replace(/\/+$/, '') || '/';
  const exact = pages[path];
  if (exact)
    return {
      title: exact[0],
      description: exact[1],
      public: exact[2],
      key: ['page-metadata'] as readonly unknown[],
      detail: false,
    };
  const match = /^\/(products|medicines|pharmacies|clinics)\/([^/]+)$/.exec(path);
  if (match) {
    const kind = match[1]!;
    let value: string;
    try {
      value = decodeURIComponent(match[2]!);
    } catch {
      return missing();
    }
    const id = Number(value);
    if (kind !== 'products' && (!/^\d+$/.test(value) || !Number.isSafeInteger(id) || id <= 0))
      return missing();
    const key =
      kind === 'products'
        ? queryKeys.product(value)
        : kind === 'medicines'
          ? queryKeys.medicine(id)
          : kind === 'pharmacies'
            ? queryKeys.pharmacy(id)
            : queryKeys.clinic(id);
    const base = pages[`/${kind}`]!;
    return { title: base[0], description: base[1], public: true, key, detail: true };
  }
  for (const prefix of ['/addresses/', '/pets/', '/orders/']) {
    if (path.startsWith(prefix)) {
      const base = pages[prefix.slice(0, -1)]!;
      return {
        title: base[0],
        description: base[1],
        public: false,
        key: ['page-metadata'] as readonly unknown[],
        detail: false,
      };
    }
  }
  return missing();
}

function missing() {
  return {
    title: 'صفحه پیدا نشد',
    description: 'این صفحه در دسترس نیست.',
    public: false,
    key: ['page-metadata'] as readonly unknown[],
    detail: false,
  };
}

/** Observe already-fetched public data without changing its query options or fetching. */
export function PageMetadata() {
  const { pathname, search } = useLocation();
  const route = routeInfo(pathname);
  const queryClient = useQueryClient();
  const subscribe = useCallback(
    (changed: () => void) => queryClient.getQueryCache().subscribe(changed),
    [queryClient],
  );
  const record = useSyncExternalStore(
    subscribe,
    () => queryClient.getQueryData<{ name: string }>(route.key),
    () => undefined,
  );
  const name =
    route.detail && typeof record?.name === 'string' ? record.name.trim().slice(0, 100) : '';
  const title = name || route.title;
  const description = name ? `${name}؛ ${route.description}` : route.description;
  const indexable = route.public && !search && (!route.detail || !!name);

  useEffect(() => {
    document.title = title === brand ? brand : `${title} | ${brand}`;
    for (const [key, content] of [
      ['description', description],
      ['robots', indexable ? 'index, follow' : 'noindex, follow'],
    ]) {
      let meta = document.head.querySelector<HTMLMetaElement>(`meta[name="${key}"]`);
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = key!;
        document.head.append(meta);
      }
      meta.content = content!;
    }
  }, [title, description, indexable]);
  return null;
}
