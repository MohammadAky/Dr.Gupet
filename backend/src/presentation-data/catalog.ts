import { canonicalSpeciesSlug } from '../common/utils/species.util';
import { Prisma } from '@prisma/client';
import { PRESENTATION_LABEL, PRESENTATION_PREFIX } from '../common/utils/presentation-sample.util';

export const PRESENTATION_PRODUCTS = [
  ['dog-food', 'غذای روزانه سگ', 'dog', 'meal'],
  ['cat-food', 'غذای روزانه گربه', 'cat', 'meal'],
  ['bird-food', 'خوراک پرندگان', 'bird', 'meal'],
  ['soft-treat', 'تشویقی نرم سگ', 'dog', 'treat'],
  ['crisp-treat', 'تشویقی ترد گربه', 'cat', 'treat'],
  ['wet-food', 'غذای مرطوب گربه', 'cat', 'meal'],
] as const;
export const PRESENTATION_PHARMACIES = ['سپید', 'مهر', 'همراه', 'سبز', 'آفتاب', 'آرام'] as const;
export const presentationName = (name: string) => `${name} — ${PRESENTATION_LABEL}`;

export function assertPresentationTarget(
  databaseUrl: string,
  database: string,
  production: boolean,
  backedUp: boolean,
) {
  const url = new URL(databaseUrl);
  const actualDatabase = decodeURIComponent(url.pathname.slice(1));
  if (url.protocol !== 'mysql:' || !database || actualDatabase !== database)
    throw new Error('The exact named MySQL database is required.');
  if (production) {
    if (!backedUp || process.env.NODE_ENV !== 'production')
      throw new Error(
        'Production requires an explicit completed backup and production environment.',
      );
  } else if (
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    !['test', 'development'].includes(process.env.NODE_ENV ?? '')
  ) {
    throw new Error('Local command requires a loopback test/development database.');
  }
  // Never return credentials or the complete connection URL.
  return { database: actualDatabase, production };
}

/** Create-only importer: existing records, even edited samples, are never silently overwritten. */
export async function importPresentationData(tx: Prisma.TransactionClient) {
  const created = { products: 0, medicines: 0, pharmacies: 0, species: 0 };
  const presentSpecies = await tx.petType.findMany();
  const speciesBySlug = new Map<string, { id: number; name: string; isActive: boolean }>();
  for (const [slug, name] of [
    ['dog', 'سگ'],
    ['cat', 'گربه'],
    ['bird', 'پرنده'],
  ]) {
    const matches = presentSpecies.filter(
      (row) => canonicalSpeciesSlug(row.slug, row.name) === slug,
    );
    if (matches.length > 1 || matches[0]?.isActive === false)
      throw new Error('Species identity conflict; existing rows preserved.');
    const species = matches[0] ?? (await tx.petType.create({ data: { slug, name } }));
    speciesBySlug.set(slug, species);
    if (!matches.length) created.species++;
  }
  const brandSlug = `${PRESENTATION_PREFIX}brand`;
  const brandName = presentationName('گوپت');
  const existingBrand = await tx.brand.findUnique({ where: { slug: brandSlug } });
  if (existingBrand && existingBrand.name !== brandName)
    throw new Error('Reserved brand identity conflict.');
  const brand =
    existingBrand ??
    (await tx.brand.create({
      data: {
        slug: brandSlug,
        name: brandName,
        description: 'برند ساختگی برای ارائه؛ محصولات قابل خرید نیستند.',
      },
    }));
  for (const [key, title, speciesSlug, illustration] of PRESENTATION_PRODUCTS) {
    const species = speciesBySlug.get(speciesSlug);
    if (!species || !species.isActive)
      throw new Error(`Active reference species required: ${speciesSlug}`);
    const categorySlug = `${PRESENTATION_PREFIX}${speciesSlug}`;
    const categoryName = presentationName(`خوراک ${species.name}`);
    const previousCategory = await tx.productCategory.findUnique({ where: { slug: categorySlug } });
    if (
      previousCategory &&
      (previousCategory.petTypeId !== species.id || previousCategory.name !== categoryName)
    )
      throw new Error('Reserved category identity conflict.');
    const category =
      previousCategory ??
      (await tx.productCategory.create({
        data: { slug: categorySlug, name: categoryName, petTypeId: species.id },
      }));
    const slug = `${PRESENTATION_PREFIX}${key}`;
    const previous = await tx.product.findUnique({ where: { slug } });
    if (previous) {
      if (!previous.name.endsWith(`— ${PRESENTATION_LABEL}`))
        throw new Error('Reserved product identity conflict.');
      continue;
    }
    await tx.product.create({
      data: {
        name: presentationName(title),
        slug,
        brandId: brand.id,
        categoryId: category.id,
        petTypeId: species.id,
        minPrice: 180000 + PRESENTATION_PRODUCTS.findIndex((item) => item[0] === key) * 25000,
        description:
          'محصول ساختگی برای ارائه و بررسی رابط کاربری. قیمت، وزن و بسته‌بندی نمونه هستند؛ این محصول قابل خرید نیست و توصیه تغذیه محسوب نمی‌شود.',
        variants: {
          create: {
            sku: `${PRESENTATION_PREFIX}${key}`,
            weightGram: 500,
            price: 180000 + PRESENTATION_PRODUCTS.findIndex((item) => item[0] === key) * 25000,
            stock: 0,
          },
        },
        images: { create: { url: `/brand/landing-${illustration}-mobile.webp` } },
      },
    });
    created.products++;
  }
  const allSpecies = [...speciesBySlug.values()];
  for (let index = 1; index <= 6; index++) {
    const name = presentationName(`اطلاعات دارویی ${index}`);
    const matches = await tx.medicine.findMany({ where: { name }, select: { id: true } });
    if (matches.length > 1)
      throw new Error('Duplicate presentation medicine; operator review required.');
    if (!matches.length) {
      await tx.medicine.create({
        data: {
          name,
          type: 'SAMPLE',
          image: '/brand/discovery-medicine-480.webp',
          notes: 'پرونده ساختگی برای ارائه؛ معرفی داروی واقعی، ترکیب، دوز یا توصیه درمان نیست.',
          petTypes: { connect: allSpecies.map(({ id }) => ({ id })) },
        },
      });
      created.medicines++;
    }
  }
  for (const title of PRESENTATION_PHARMACIES) {
    const name = presentationName(`داروخانه ${title}`);
    const matches = await tx.pharmacy.findMany({ where: { name }, select: { id: true } });
    if (matches.length > 1)
      throw new Error('Duplicate presentation pharmacy; operator review required.');
    if (!matches.length) {
      await tx.pharmacy.create({
        data: {
          name,
          city: PRESENTATION_LABEL,
          province: PRESENTATION_LABEL,
          address:
            'این داروخانه ساختگی است و نشانی، تلفن و موقعیت واقعی ندارد؛ برای مراجعه یا خرید استفاده نشود.',
          isVerified: false,
          is24h: false,
          onDuty: false,
        },
      });
      created.pharmacies++;
    }
  }
  return created;
}
