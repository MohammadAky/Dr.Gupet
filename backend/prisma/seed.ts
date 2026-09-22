import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Pet Types
  const dog = await prisma.petType.upsert({
    where: { slug: 'dog' },
    update: {},
    create: { name: 'سگ', slug: 'dog' },
  });

  const cat = await prisma.petType.upsert({
    where: { slug: 'cat' },
    update: {},
    create: { name: 'گربه', slug: 'cat' },
  });

  console.log('✅ Pet types created');

  // 2. Breeds
  const dogBreeds = [
    'ژرمن شپرد', 'لابrador', 'بولدوگ', 'پودل', 'بیگل',
    'هاسکی', 'شیتزو', 'مالتیز', 'پomeranian', 'داکشوند',
  ];

  const catBreeds = [
    'پرشین', 'بنگال', 'سیامی', 'مین‌کوون', 'بریتیش شورت‌هیر',
    'سکاتیش فولد', 'راگدول', 'آبیسینیان', 'รกدoll', 'ترکی آنگورا',
  ];

  for (const name of dogBreeds) {
    await prisma.breed.upsert({
      where: { petTypeId_name: { petTypeId: dog.id, name } },
      update: {},
      create: { petTypeId: dog.id, name },
    });
  }

  for (const name of catBreeds) {
    await prisma.breed.upsert({
      where: { petTypeId_name: { petTypeId: cat.id, name } },
      update: {},
      create: { petTypeId: cat.id, name },
    });
  }

  console.log('✅ Breeds created');

  // 3. Tags
  const allergenTags = [
    { name: 'مرغ', slug: 'chicken' },
    { name: 'گاو', slug: 'beef' },
    { name: 'ماهی', slug: 'fish' },
    { name: 'بره', slug: 'lamb' },
    { name: 'گلوتن', slug: 'gluten' },
    { name: 'ذرت', slug: 'corn' },
    { name: 'سویا', slug: 'soy' },
    { name: 'لبنیات', slug: 'dairy' },
    { name: 'تخم‌مرغ', slug: 'egg' },
  ];

  const dietTags = [
    { name: 'بدون غلات', slug: 'grain-free' },
    { name: 'کنترل وزن', slug: 'weight-control' },
    { name: 'مراقبت ادراری', slug: 'urinary-care' },
    { name: 'هضم حساس', slug: 'sensitive-digestion' },
    { name: 'هیپوآلرژنیک', slug: 'hypoallergenic' },
    { name: 'پوست و مو', slug: 'skin-and-coat' },
    { name: 'مراقبت مفصل', slug: 'joint-care' },
    { name: 'بهداشت دهان', slug: 'dental-care' },
  ];

  for (const tag of allergenTags) {
    await prisma.tag.upsert({
      where: { slug: tag.slug },
      update: {},
      create: { ...tag, type: 'ALLERGEN' },
    });
  }

  for (const tag of dietTags) {
    await prisma.tag.upsert({
      where: { slug: tag.slug },
      update: {},
      create: { ...tag, type: 'DIET' },
    });
  }

  console.log('✅ Tags created');

  // 4. Brands
  const brands = [
    { name: 'رویال کنین', slug: 'royal-canin', country: 'فرانسه' },
    { name: 'پورینا', slug: 'purina', country: 'آمریکا' },
    { name: 'هیلز', slug: 'hills', country: 'آمریکا' },
    { name: 'ای姆س', slug: 'iams', country: 'آمریکا' },
    { name: 'برnds', slug: 'brands', country: 'آلمان' },
  ];

  for (const brand of brands) {
    await prisma.brand.upsert({
      where: { slug: brand.slug },
      update: {},
      create: brand,
    });
  }

  console.log('✅ Brands created');

  // 5. Categories
  const dogFood = await prisma.productCategory.upsert({
    where: { slug: 'dog-dry-food' },
    update: {},
    create: { name: 'غذای خشک سگ', slug: 'dog-dry-food', petTypeId: dog.id },
  });

  const catFood = await prisma.productCategory.upsert({
    where: { slug: 'cat-dry-food' },
    update: {},
    create: { name: 'غذای خشک گربه', slug: 'cat-dry-food', petTypeId: cat.id },
  });

  console.log('✅ Categories created');

  // 6. Sample Products
  const royalCanin = await prisma.brand.findUnique({ where: { slug: 'royal-canin' } });
  const purina = await prisma.brand.findUnique({ where: { slug: 'purina' } });

  // Dog products
  const dogProduct1 = await prisma.product.upsert({
    where: { slug: 'royal-canin-maxi-adult' },
    update: {},
    create: {
      name: 'رویال کنین مکسی ا adult',
      slug: 'royal-canin-maxi-adult',
      brandId: royalCanin!.id,
      categoryId: dogFood.id,
      petTypeId: dog.id,
      lifeStage: 'ADULT',
      sizeClass: 'LARGE',
      description: 'غذای خشک برای سگ‌های نژاد بزرگ بالغ',
      minPrice: 850000,
    },
  });

  const dogProduct2 = await prisma.product.upsert({
    where: { slug: 'royal-canin-mini-puppy' },
    update: {},
    create: {
      name: 'رویال کنین مینی پاپی',
      slug: 'royal-canin-mini-puppy',
      brandId: royalCanin!.id,
      categoryId: dogFood.id,
      petTypeId: dog.id,
      lifeStage: 'PUPPY_KITTEN',
      sizeClass: 'SMALL',
      description: 'غذای خشک برای توله سگ‌های نژاد کوچک',
      minPrice: 650000,
    },
  });

  // Cat product
  const catProduct1 = await prisma.product.upsert({
    where: { slug: 'royal-canin-indoor-adult' },
    update: {},
    create: {
      name: 'رویال کنین ایندور ا adult',
      slug: 'royal-canin-indoor-adult',
      brandId: royalCanin!.id,
      categoryId: catFood.id,
      petTypeId: cat.id,
      lifeStage: 'ADULT',
      description: 'غذای خشک برای گربه‌های خانگی بالغ',
      minPrice: 550000,
    },
  });

  console.log('✅ Products created');

  // 7. Product Variants
  const variants = [
    { productId: dogProduct1.id, sku: 'RC-MAXI-2KG', weightGram: 2000, price: 850000, stock: 50 },
    { productId: dogProduct1.id, sku: 'RC-MAXI-4KG', weightGram: 4000, price: 1500000, stock: 30 },
    { productId: dogProduct1.id, sku: 'RC-MAXI-10KG', weightGram: 10000, price: 3200000, stock: 20 },
    { productId: dogProduct2.id, sku: 'RC-MINI-2KG', weightGram: 2000, price: 650000, stock: 40 },
    { productId: dogProduct2.id, sku: 'RC-MINI-3KG', weightGram: 3000, price: 900000, stock: 25 },
    { productId: catProduct1.id, sku: 'RC-INDOOR-2KG', weightGram: 2000, price: 550000, stock: 35 },
    { productId: catProduct1.id, sku: 'RC-INDOOR-4KG', weightGram: 4000, price: 980000, stock: 20 },
  ];

  for (const variant of variants) {
    await prisma.productVariant.upsert({
      where: { sku: variant.sku },
      update: {},
      create: variant,
    });
  }

  console.log('✅ Product variants created');

  // 8. Product Tags
  const chickenTag = await prisma.tag.findUnique({ where: { slug: 'chicken' } });
  const grainFreeTag = await prisma.tag.findUnique({ where: { slug: 'grain-free' } });

  if (chickenTag && grainFreeTag) {
    await prisma.productTag.upsert({
      where: { productId_tagId_kind: { productId: dogProduct1.id, tagId: chickenTag.id, kind: 'CONTAINS' } },
      update: {},
      create: { productId: dogProduct1.id, tagId: chickenTag.id, kind: 'CONTAINS' },
    });

    await prisma.productTag.upsert({
      where: { productId_tagId_kind: { productId: dogProduct1.id, tagId: grainFreeTag.id, kind: 'SUITABLE_FOR' } },
      update: {},
      create: { productId: dogProduct1.id, tagId: grainFreeTag.id, kind: 'SUITABLE_FOR' },
    });
  }

  console.log('✅ Product tags created');

  // 9. Coupon
  await prisma.coupon.upsert({
    where: { code: 'SUMMER20' },
    update: {},
    create: {
      code: 'SUMMER20',
      type: 'PERCENT',
      value: 20,
      maxDiscount: 200000,
      minOrderAmount: 500000,
      isActive: true,
    },
  });

  await prisma.coupon.upsert({
    where: { code: 'FLAT50K' },
    update: {},
    create: {
      code: 'FLAT50K',
      type: 'FIXED',
      value: 50000,
      minOrderAmount: 300000,
      isActive: true,
    },
  });

  console.log('✅ Coupons created');

  // 10. Pharmacies
  const pharmacies = [
    {
      name: 'داروخانه مرکزی',
      province: 'تهران',
      city: 'تهران',
      address: 'خیابان ولیعصر، پلاک ۱۲۳',
      phone: '02112345678',
      is24h: true,
      isVerified: true,
    },
    {
      name: 'داروخانه شب',
      province: 'تهران',
      city: 'تهران',
      address: 'خیابان انقلاب، پلاک ۴۵۶',
      phone: '02198765432',
      is24h: true,
      isVerified: false,
    },
  ];

  for (const pharmacy of pharmacies) {
    await prisma.pharmacy.create({ data: pharmacy });
  }

  console.log('✅ Pharmacies created');

  // 11. Medicines
  const med1 = await prisma.medicine.create({
    data: {
      name: 'قرص ضد انگل سگ',
      activeIngredient: 'پراکسیکوانل',
      type: 'قرص',
      usage: 'درمان انگل‌های روده‌ای',
      requiresPrescription: false,
    },
  });

  const med2 = await prisma.medicine.create({
    data: {
      name: 'قطره گوش گربه',
      activeIngredient: 'کلوتریمازول',
      type: 'قطره',
      usage: 'درمان عفونت قارچی گوش',
      requiresPrescription: false,
    },
  });

  // Link medicines to pet types
  await prisma.$executeRaw`INSERT INTO _MedicineToPetType (A, B) VALUES (${med1.id}, ${dog.id}) ON CONFLICT DO NOTHING`;
  await prisma.$executeRaw`INSERT INTO _MedicineToPetType (A, B) VALUES (${med2.id}, ${cat.id}) ON CONFLICT DO NOTHING`;

  console.log('✅ Medicines created');

  // 12. Admin user
  await prisma.user.upsert({
    where: { phone: '09120000000' },
    update: {},
    create: {
      phone: '09120000000',
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
      isPhoneVerified: true,
    },
  });

  console.log('✅ Admin user created');

  console.log('🎉 Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });