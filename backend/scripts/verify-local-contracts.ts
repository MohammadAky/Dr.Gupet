/** Real MySQL service checks, explicitly named loopback test database only.
 * Every fixture and stock/settings change rolls back; no payment or SMS driver is called.
 * npx ts-node scripts/verify-local-contracts.ts --database=<named-local-db>
 */
import { strict as assert } from 'assert';
import { randomBytes } from 'crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/prisma/prisma.service';
import { SettingsService } from '../src/admin/settings/settings.service';
import { PetsService } from '../src/modules/pets/pets.service';
import { CartService } from '../src/modules/cart/cart.service';
import { CouponsService } from '../src/modules/coupons/coupons.service';
import { OrdersService } from '../src/modules/orders/orders.service';
import { OrderStockService } from '../src/modules/orders/order-stock.service';
import { assertLocalReferenceTarget } from '../src/reference-data/catalog';

async function main() {
  const expectedDatabase =
    process.argv.find((arg) => arg.startsWith('--database='))?.slice(11) ?? '';
  const databaseUrl = process.env.DATABASE_URL ?? '';
  const target = assertLocalReferenceTarget(databaseUrl, expectedDatabase, process.env.NODE_ENV);
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const marker = `rollback-contract-${randomBytes(8).toString('hex')}`;
  const rollback = new Error('ROLLBACK_VERIFIED_FIXTURES');
  let verified = false;
  try {
    await prisma.$transaction(
      async (tx) => {
        // Service transactions join this outer rollback scope; every query still hits real MySQL.
        const client = new Proxy(tx, {
          get(transaction, key) {
            if (key === '$transaction')
              return (operation: (scope: Prisma.TransactionClient) => Promise<unknown>) =>
                operation(tx);
            return Reflect.get(transaction, key);
          },
        }) as unknown as PrismaService;
        const species = await tx.petType.findFirstOrThrow({
          where: { name: 'سگ', isActive: true },
        });
        const user = await tx.user.create({
          data: { phone: marker, firstName: 'آزمون بازگشت تراکنش' },
        });
        const pet = await tx.pet.create({
          data: {
            userId: user.id,
            name: marker,
            petTypeId: species.id,
            birthDate: new Date('2020-01-01'),
          },
        });
        const pets = new PetsService(client);
        await pets.update(user.id, pet.id, { name: `${marker}-edited` });
        assert.equal(
          (await tx.pet.findUniqueOrThrow({ where: { id: pet.id } })).birthDate?.toISOString(),
          '2020-01-01T00:00:00.000Z',
        );
        assert.equal((await pets.update(user.id, pet.id, { birthDate: null })).lifeStage, 'ALL');
        assert.equal((await tx.pet.findUniqueOrThrow({ where: { id: pet.id } })).birthDate, null);
        const address = await tx.address.create({
          data: {
            userId: user.id,
            title: marker,
            receiverName: 'آزمون',
            receiverPhone: '09120000000',
            province: 'تهران',
            city: 'تهران',
            fullAddress: 'آدرس تاریخی '.repeat(300),
            postalCode: '1234567890',
          },
        });
        const brand = await tx.brand.create({ data: { name: marker, slug: marker } });
        const category = await tx.productCategory.create({
          data: { name: marker, slug: marker, petTypeId: species.id },
        });
        const product = await tx.product.create({
          data: {
            name: marker,
            slug: marker,
            brandId: brand.id,
            categoryId: category.id,
            petTypeId: species.id,
          },
        });
        const variant = await tx.productVariant.create({
          data: { productId: product.id, sku: marker, weightGram: 1000, price: 100000, stock: 5 },
        });
        const cart = await tx.cart.create({ data: { userId: user.id } });
        await tx.cartItem.create({ data: { cartId: cart.id, variantId: variant.id, quantity: 2 } });
        for (const [key, value] of Object.entries({
          ORDER_EXPIRE_MINUTES: '45',
          SHIPPING_FLAT_COST: '50000',
          FREE_SHIPPING_THRESHOLD: '1500000',
        }))
          await tx.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
        const config = new ConfigService({
          payment: { driver: 'mock' },
          app: { orderExpireMinutes: 20 },
        });
        const settings = new SettingsService(client);
        const orders = new OrdersService(
          client,
          new CartService(client, settings, config),
          new CouponsService(client),
          new OrderStockService(),
          config,
          settings,
        );
        const created = await orders.checkout(user.id, { addressId: address.id, note: marker });
        const stored = await tx.order.findUniqueOrThrow({ where: { id: created.id } });
        assert.equal(typeof stored.addressSnapshot, 'string');
        assert.ok(stored.addressSnapshot.length > 3000);
        assert.equal(JSON.parse(stored.addressSnapshot).fullAddress, address.fullAddress);
        assert.equal(created.addressSnapshot?.fullAddress, address.fullAddress);
        assert.equal(created.finalAmount, 250000);
        assert.equal(
          created.expiresAt,
          new Date(stored.createdAt.getTime() + 45 * 60000).toISOString(),
        );
        assert.equal(
          (await tx.productVariant.findUniqueOrThrow({ where: { id: variant.id } })).stock,
          3,
        );
        assert.equal(await tx.cartItem.count({ where: { cartId: cart.id } }), 0);
        await tx.address.update({ where: { id: address.id }, data: { fullAddress: 'آدرس جدید' } });
        assert.equal(
          (await orders.findOne(user.id, created.id)).addressSnapshot?.fullAddress,
          address.fullAddress,
        );
        assert.equal((await orders.cancel(user.id, created.id))?.expiresAt, null);
        assert.equal(
          (await tx.productVariant.findUniqueOrThrow({ where: { id: variant.id } })).stock,
          5,
        );
        verified = true;
        throw rollback;
      },
      { timeout: 30000 },
    );
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    await prisma.$disconnect();
  }
  assert.ok(verified);
  const after = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    assert.equal(await after.user.count({ where: { phone: marker } }), 0);
    assert.equal(await after.product.count({ where: { slug: marker } }), 0);
    assert.equal(await after.order.count({ where: { note: marker } }), 0);
  } finally {
    await after.$disconnect();
  }
  console.log(
    JSON.stringify({
      target,
      result: 'passed',
      checks: [
        'pet omission preserves / null clears',
        'real checkout TEXT snapshot / historic address / totals / stock / cart',
        'effective setting deadline / cancellation',
        'fixtures rolled back',
      ],
      externalPaymentOrSms: false,
    }),
  );
}

main().catch(() => {
  // Connection errors can contain credentials. Report only a safe operator failure.
  console.error('Local rollback contract checks failed; no fixture transaction was committed.');
  process.exitCode = 1;
});
