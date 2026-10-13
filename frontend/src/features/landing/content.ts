/** Shared, dependency-free sample content. Publication requires the landing CMS contract. */
export interface LandingFocus {
  x: number;
  y: number;
}
export interface LandingSlide {
  id: string;
  enabled: boolean;
  title: string;
  description: string;
  ctaLabel: string;
  href: string;
  image: string;
  mobileImage?: string;
  alt: string;
  desktopFocus: LandingFocus;
  mobileFocus: LandingFocus;
}
export interface LandingItem {
  id: string;
  title: string;
  description: string;
  image: string;
  href: string;
  price?: number;
  badge?: string;
}
export const landingSectionOrder = ['products', 'clinics', 'pharmacies', 'medicines'] as const;
export type LandingSectionKey = (typeof landingSectionOrder)[number];
export interface LandingSection {
  title: string;
  demo: boolean;
  items: LandingItem[];
}
export interface LandingContent {
  version: 1;
  announcement: { enabled: boolean; text: string; href: string };
  slides: LandingSlide[];
  ranking: { metric: 'paid_units' | 'paid_revenue'; days: number; limit: number };
  sections: Record<LandingSectionKey, LandingSection>;
}
export function safeLandingLink(value: string): boolean {
  return (
    value === '' ||
    (/^\/(?!\/)/.test(value) &&
      !/[\\\s]/u.test(value) &&
      !Array.from(value).some(
        (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
      ))
  );
}
export const landingSample: LandingContent = {
  version: 1,
  announcement: {
    enabled: true,
    text: 'دکتر گوپت؛ همراه سگ، گربه و پرندهٔ شما',
    href: '',
  },
  slides: [
    {
      id: 'family',
      enabled: true,
      title: 'کنار هم، حالِ بهتر.',
      description: 'از انتخاب غذا تا پیدا کردن مراقبت؛ برای سگ، گربه و پرندهٔ شما.',
      ctaLabel: 'کشف محصولات',
      href: '/products',
      image: '/brand/landing-family-1600.webp',
      mobileImage: '/brand/landing-family-mobile.webp',
      alt: 'تصویرسازی یک خانم جوان خندان در کنار سگ، گربه و پرنده',
      desktopFocus: { x: 50, y: 0 },
      mobileFocus: { x: 50, y: 50 },
    },
    {
      id: 'meal',
      enabled: true,
      title: 'غذایش را آگاهانه انتخاب کن.',
      description: 'انتخاب غذا از شناخت همراهت شروع می‌شود.',
      ctaLabel: 'انتخاب غذا',
      href: '/products',
      image: '/brand/landing-meal-1600.webp',
      mobileImage: '/brand/landing-meal-mobile.webp',
      alt: 'تصویرسازی نمونهٔ یک بستهٔ غذای حیوانات خانگی',
      desktopFocus: { x: 50, y: 0 },
      mobileFocus: { x: 50, y: 50 },
    },
    {
      id: 'treat',
      enabled: true,
      title: 'یک تشویقی، یک لحظهٔ خوش.',
      description: 'برای لحظه‌های کوچکِ کنار هم بودن.',
      ctaLabel: 'کشف خوراکی‌ها',
      href: '/products',
      image: '/brand/landing-treat-1600.webp',
      mobileImage: '/brand/landing-treat-mobile.webp',
      alt: 'تصویرسازی نمونهٔ یک بستهٔ تشویقی و خوراکی حیوانات خانگی',
      desktopFocus: { x: 50, y: 0 },
      mobileFocus: { x: 50, y: 50 },
    },
  ],
  ranking: { metric: 'paid_units', days: 30, limit: 8 },
  sections: {
    products: {
      title: 'پرفروش‌ترین محصولات',
      demo: true,
      items: [
        'غذای روزانهٔ سگ',
        'غذای روزانهٔ گربه',
        'خوراک پرندگان',
        'تشویقی نرم',
        'تشویقی ترد',
        'غذای مرطوب',
      ].map((title, index) => ({
        id: `product-sample-${index + 1}`,
        title,
        description: 'نمونهٔ چیدمان برای ارائه؛ این محصول قابل خرید نیست.',
        image: `/brand/landing-${index < 3 ? 'meal' : 'treat'}-mobile.webp`,
        href: '/products',
        price: 180000 + index * 25000,
        badge: 'نمونهٔ طراحی',
      })),
    },
    clinics: {
      title: 'کلینیک‌های نزدیک من',
      demo: true,
      items: [
        'کلینیک نمونهٔ سپید',
        'کلینیک نمونهٔ مهر',
        'کلینیک نمونهٔ همراه',
        'کلینیک نمونهٔ سبز',
        'کلینیک نمونهٔ آفتاب',
        'کلینیک نمونهٔ آرام',
      ].map((title, index) => ({
        id: `clinic-sample-${index + 1}`,
        title,
        description: 'نمونهٔ طراحی؛ نام و نشانی یک مرکز واقعی نیست.',
        image:
          index % 2 ? '/brand/clinic-care-reception-480.webp' : '/brand/clinic-care-dog-480.webp',
        href: '/clinics',
        badge: 'نمونهٔ طراحی',
      })),
    },
    pharmacies: {
      title: 'داروخانه‌ها',
      demo: true,
      items: [
        'داروخانهٔ نمونهٔ سپید',
        'داروخانهٔ نمونهٔ مهر',
        'داروخانهٔ نمونهٔ همراه',
        'داروخانهٔ نمونهٔ سبز',
        'داروخانهٔ نمونهٔ آفتاب',
        'داروخانهٔ نمونهٔ آرام',
      ].map((title, index) => ({
        id: `pharmacy-sample-${index + 1}`,
        title,
        description: 'نمونهٔ طراحی؛ نام و نشانی یک داروخانهٔ واقعی نیست.',
        image: '/brand/discovery-pharmacy-480.webp',
        href: '/pharmacies',
        badge: 'نمونهٔ طراحی',
      })),
    },
    medicines: {
      title: 'داروها',
      demo: true,
      items: [
        'اطلاعات دارویی — نمونهٔ ۱',
        'اطلاعات دارویی — نمونهٔ ۲',
        'اطلاعات دارویی — نمونهٔ ۳',
        'اطلاعات دارویی — نمونهٔ ۴',
        'اطلاعات دارویی — نمونهٔ ۵',
        'اطلاعات دارویی — نمونهٔ ۶',
      ].map((title, index) => ({
        id: `medicine-sample-${index + 1}`,
        title,
        description: 'نمونهٔ چیدمان اطلاعات؛ معرفی یا توصیهٔ یک داروی واقعی نیست.',
        image: '/brand/discovery-medicine-480.webp',
        href: '/medicines',
        badge: 'نمونهٔ طراحی',
      })),
    },
  },
};
