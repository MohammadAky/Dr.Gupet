import { canonicalSpeciesSlug, normalizeReferenceName } from '../common/utils/species.util';

/** Reference vocabulary only. No sample products, stock, accounts, venues, or prescriptions. */
// Common named breeds plus explicit domestic/mixed/unknown selections.
// Bird entries use the existing generic Breed relation as varieties, not taxonomy.
// Vocabulary scope and primary references: backend/docs/REFERENCE_VOCABULARY.md.
export const REFERENCE_SPECIES = [
  {
    name: 'سگ',
    slug: 'dog',
    breeds: [
      'ژرمن شپرد',
      'لابرادور',
      'بولدوگ',
      'پودل',
      'بیگل',
      'هاسکی',
      'شیتزو',
      'مالتیز',
      'پامرانین',
      'داکشوند',
      'گلدن رتریور',
      'روتوایلر',
      'دوبرمن',
      'باکسر',
      'گریت دین',
      'سنت برنارد',
      'شیبا اینو',
      'آکیتا',
      'ساموید',
      'آلاسکن مالاموت',
      'چی‌واوا',
      'پاگ',
      'فرنچ بولدوگ',
      'بوستون تریر',
      'یورکشایر تریر',
      'جک راسل تریر',
      'وست هایلند وایت تریر',
      'اسکاتیش تریر',
      'بول تریر',
      'استافوردشایر بول تریر',
      'امریکن استافوردشایر تریر',
      'کوکر اسپانیل انگلیسی',
      'کوکر اسپانیل آمریکایی',
      'کاوالیر کینگ چارلز اسپانیل',
      'اسپرینگر اسپانیل انگلیسی',
      'بردر کولی',
      'کولی مو‌بلند',
      'استرالیان شپرد',
      'ولش کورگی پمبروک',
      'ولش کورگی کاردیگان',
      'دالمیشن',
      'باست هاند',
      'گری‌هاند',
      'ویپت',
      'افغان هاند',
      'سالوکی',
      'باسنجی',
      'رودژین ریج‌بک',
      'بیچون فرایز',
      'هاوانیز',
      'بومی / محلی',
      'دورگه / میکس',
      'نامشخص',
    ],
  },
  {
    name: 'گربه',
    slug: 'cat',
    breeds: [
      'پرشین',
      'بنگال',
      'سیامی',
      'مین‌کوون',
      'بریتیش شورت‌هیر',
      'سکاتیش فولد',
      'راگدول',
      'آبیسینیان',
      'ترکی آنگورا',
      'اگزوتیک شورت‌هیر',
      'اسفینکس',
      'روسی آبی',
      'نروژی جنگلی',
      'سیبری',
      'بیرمن',
      'برمه‌ای',
      'بمبئی',
      'بالینیز',
      'اورینتال',
      'تونکینیز',
      'سومالی',
      'امریکن شورت‌هیر',
      'امریکن وایرهیر',
      'امریکن کرل',
      'امریکن بابتیل',
      'ژاپنی بابتیل',
      'کورنیش رکس',
      'دوون رکس',
      'سلکرک رکس',
      'مانکس',
      'اوسی‌کت',
      'مصری مائو',
      'سنگاپورا',
      'ترکی وان',
      'کورات',
      'خانگی کوتاه‌مو',
      'خانگی مو‌متوسط',
      'خانگی بلندمو',
      'دورگه / میکس',
      'نامشخص',
    ],
  },
  {
    name: 'پرنده',
    slug: 'bird',
    breeds: [
      'مرغ عشق',
      'عروس هلندی',
      'قناری',
      'کاسکو',
      'طوطی برزیلی',
      'فنچ زبرا',
      'فنچ گلدین',
      'طوطی ملنگو',
      'شاه‌طوطی',
      'طوطی خورشیدی',
      'کاکادو',
      'ماکائو',
      'نامشخص',
    ],
  },
] as const;

// Existing domain tags are shared reference labels, not species-specific medical advice.
export const REFERENCE_TAGS = [
  ...[
    { name: 'مرغ', slug: 'chicken' },
    { name: 'گاو', slug: 'beef' },
    { name: 'ماهی', slug: 'fish' },
    { name: 'بره', slug: 'lamb' },
    { name: 'گلوتن', slug: 'gluten' },
    { name: 'ذرت', slug: 'corn' },
    { name: 'سویا', slug: 'soy' },
    { name: 'لبنیات', slug: 'dairy' },
    { name: 'تخم‌مرغ', slug: 'egg' },
  ].map((tag) => ({ ...tag, type: 'ALLERGEN' as const })),
  ...[
    { name: 'بدون غلات', slug: 'grain-free' },
    { name: 'کنترل وزن', slug: 'weight-control' },
    { name: 'مراقبت ادراری', slug: 'urinary-care' },
    { name: 'هضم حساس', slug: 'sensitive-digestion' },
    { name: 'هیپوآلرژنیک', slug: 'hypoallergenic' },
    { name: 'پوست و مو', slug: 'skin-and-coat' },
    { name: 'مراقبت مفصل', slug: 'joint-care' },
    { name: 'بهداشت دهان', slug: 'dental-care' },
  ].map((tag) => ({ ...tag, type: 'DIET' as const })),
];

export interface ReferenceState {
  petTypes: { id: number; name: string; slug: string; isActive: boolean }[];
  breeds: { petTypeId: number; name: string; isActive: boolean }[];
  tags: { name: string; slug: string; type: string }[];
}

const BREED_NAME_ALIASES: Record<string, Record<string, string>> = {
  dog: {
    لابرادوررتریور: 'لابرادور',
    هاسکیسیبری: 'هاسکی',
    هاسکیسیبرین: 'هاسکی',
    سیبرینهاسکی: 'هاسکی',
    گلدن: 'گلدنرتریور',
    پامرانیان: 'پامرانین',
    بومی: 'بومیمحلی',
    محلی: 'بومیمحلی',
    میکس: 'دورگهمیکس',
    دورگه: 'دورگهمیکس',
    نامعلوم: 'نامشخص',
  },
  cat: {
    مینکون: 'مینکوون',
    میکس: 'دورگهمیکس',
    دورگه: 'دورگهمیکس',
    نامعلوم: 'نامشخص',
  },
  bird: { نامعلوم: 'نامشخص' },
};

/** Formatting/known aliases reuse existing IDs; duplicate identities require review. */
export function referenceBreedIdentity(species: string, name: string) {
  const key = normalizeReferenceName(name).replace(
    /\s|\u200c|\u200d|\u200e|\u200f|\u0640|[-/]/g,
    '',
  );
  return BREED_NAME_ALIASES[species]?.[key] ?? key;
}

export function planReferenceData(state: ReferenceState) {
  const conflicts: string[] = [];
  const petTypes: { name: string; slug: string }[] = [];
  const breeds: { name: string; petTypeSlug: string }[] = [];
  const tags: typeof REFERENCE_TAGS = [];
  for (const species of REFERENCE_SPECIES) {
    const candidates = state.petTypes.filter(
      (row) => canonicalSpeciesSlug(row.slug, row.name) === species.slug,
    );
    const existing = candidates.find((row) => row.slug === species.slug) ?? candidates[0];
    if (candidates.length > 1)
      conflicts.push(`نوع «${species.name}» چند شناسه دارد؛ ادغام خودکار انجام نمی‌شود.`);
    if (existing && (normalizeReferenceName(existing.name) !== species.name || !existing.isActive))
      conflicts.push(`نوع «${species.slug}» نیاز به بررسی نام یا فعال‌بودن دارد.`);
    else if (!existing) {
      if (state.petTypes.some((row) => row.name === species.name))
        conflicts.push(`نام «${species.name}» با شناسهٔ دیگری وجود دارد.`);
      else petTypes.push({ name: species.name, slug: species.slug });
    }
    for (const name of species.breeds) {
      const matches = existing
        ? state.breeds.filter(
            (row) =>
              row.petTypeId === existing.id &&
              referenceBreedIdentity(species.slug, row.name) ===
                referenceBreedIdentity(species.slug, name),
          )
        : [];
      const breed = matches[0];
      if (matches.length > 1)
        conflicts.push(`نژاد «${name}» چند شناسهٔ هم‌معنا دارد؛ ادغام خودکار انجام نمی‌شود.`);
      else if (breed && !breed.isActive) conflicts.push(`نژاد «${name}» قبلاً غیرفعال شده است.`);
      else if (!breed) breeds.push({ name, petTypeSlug: existing?.slug ?? species.slug });
    }
  }
  for (const tag of REFERENCE_TAGS) {
    const existing =
      state.tags.find((row) => row.slug === tag.slug) ??
      state.tags.find(
        (row) =>
          normalizeReferenceName(row.name) === normalizeReferenceName(tag.name) &&
          row.type === tag.type,
      );
    if (
      existing &&
      (normalizeReferenceName(existing.name) !== normalizeReferenceName(tag.name) ||
        existing.type !== tag.type)
    )
      conflicts.push(`برچسب «${tag.slug}» با نام یا نوع متفاوت وجود دارد.`);
    else if (!existing) {
      if (state.tags.some((row) => row.name === tag.name && row.type === tag.type))
        conflicts.push(`برچسب «${tag.name}» با شناسهٔ دیگری وجود دارد.`);
      else tags.push(tag);
    }
  }
  const malformedBreeds = state.breeds
    .filter((breed) => /[a-zA-Z\u0e00-\u0e7f]/.test(breed.name))
    .map((breed) => breed.name);
  return { petTypes, breeds, tags, conflicts, malformedBreeds };
}

/** Apply is allowed only to an explicitly named local nonproduction MySQL database. */
export function assertLocalReferenceTarget(
  databaseUrl: string,
  expectedDatabase: string,
  environment: string | undefined,
) {
  let target: URL;
  try {
    target = new URL(databaseUrl);
  } catch {
    throw new Error('A valid private MySQL configuration is required.');
  }
  if (
    !['development', 'test'].includes(environment ?? '') ||
    target.protocol !== 'mysql:' ||
    !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) ||
    !expectedDatabase ||
    decodeURIComponent(target.pathname.slice(1)) !== expectedDatabase
  ) {
    throw new Error('Only the explicitly named local nonproduction MySQL target is allowed.');
  }
  return { host: target.hostname, database: expectedDatabase };
}

/** Production is a separate explicit operator action, never an automatic release seed. */
export function assertReferenceOperatorTarget(
  databaseUrl: string,
  expectedDatabase: string,
  environment: string | undefined,
  allowProduction: boolean,
  backupConfirmed: boolean,
) {
  if (!allowProduction) {
    return {
      ...assertLocalReferenceTarget(databaseUrl, expectedDatabase, environment),
      production: false,
    };
  }
  let target: URL;
  try {
    target = new URL(databaseUrl);
  } catch {
    throw new Error('A valid private MySQL configuration is required.');
  }
  if (
    environment !== 'production' ||
    !backupConfirmed ||
    target.protocol !== 'mysql:' ||
    !expectedDatabase ||
    decodeURIComponent(target.pathname.slice(1)) !== expectedDatabase
  )
    throw new Error(
      'Production references require exact named MySQL database and completed backup confirmation.',
    );
  return { host: target.hostname, database: expectedDatabase, production: true };
}
