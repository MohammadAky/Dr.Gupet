import { AdminProductsService } from './admin-products.service';
import { ProductsService } from './products.service';
import { ProductsRecommendationService } from './products-recommendation.service';
import { FavoritesService } from '../favorites/favorites.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductVariantsService } from './product-variants.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

const gallery = [
  { id: 10, url: '/uploads/main.webp', sortOrder: 0 },
  { id: 20, url: '/uploads/old-hover.webp', sortOrder: 0 },
  { id: 30, url: '/uploads/chosen.webp', sortOrder: 7 },
];
function harness() {
  let stored = gallery.map((image) => ({ ...image }));
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: 1, isActive: true }]),
    productImage: {
      findMany: jest.fn(async () => stored.map((image) => ({ ...image }))),
      update: jest.fn(async ({ where, data }) => {
        const image = stored.find((value) => value.id === where.id)!;
        Object.assign(image, data);
        return image;
      }),
    },
  };
  const prisma = {
    $transaction: jest.fn(async (operation) => {
      const before = stored.map((image) => ({ ...image }));
      try {
        return await operation(tx);
      } catch (error) {
        stored = before;
        throw error;
      }
    }),
  };
  const service = new AdminProductsService(
    prisma as unknown as PrismaService,
    {} as ProductVariantsService,
  );
  return { service, prisma, tx, stored: () => stored };
}

describe('Administrator-selected real hover image', () => {
  it('keeps primary fixed, selects an owned image second and commits dense deterministic positions', async () => {
    const h = harness();
    const result = await h.service.setHoverImage(1, 30);
    expect(result).toEqual({
      hoverImage: '/uploads/chosen.webp',
      images: [
        { ...gallery[0], sortOrder: 0 },
        { ...gallery[2], sortOrder: 1 },
        { ...gallery[1], sortOrder: 2 },
      ],
    });
    expect(new Set(h.stored().map((image) => image.sortOrder)).size).toBe(3);
    expect(h.tx.$queryRaw.mock.calls[0][0].join('')).toContain('FOR UPDATE');
    expect(h.tx.productImage.findMany).toHaveBeenCalledWith({
      where: { productId: 1 },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: { id: true, url: true, sortOrder: true },
    });
  });
  it('rejects a foreign/missing image or the primary without writing', async () => {
    const h = harness();
    await expect(h.service.setHoverImage(1, 99)).rejects.toMatchObject({ status: 404 });
    await expect(h.service.setHoverImage(1, 10)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    expect(h.tx.productImage.update).not.toHaveBeenCalled();
    expect(h.stored()).toEqual(gallery);
  });
  it('rolls back every position if a later image write fails', async () => {
    const h = harness();
    h.tx.productImage.update
      .mockImplementationOnce(async ({ where, data }) => {
        Object.assign(
          h.stored().find((image) => image.id === where.id)!,
          data,
        );
        return h.stored()[0];
      })
      .mockRejectedValueOnce(new Error('simulated image write failure'));
    await expect(h.service.setHoverImage(1, 30)).rejects.toThrow('simulated image write failure');
    expect(h.stored()).toEqual(gallery);
    expect(h.prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe('Gallery mutations share the parent lock with hover selection', () => {
  function setup() {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 1, isActive: true }]),
      productImage: {
        findFirst: jest.fn().mockResolvedValue({ sortOrder: 7 }),
        findUnique: jest.fn().mockResolvedValue({ id: 30, productId: 1 }),
        create: jest.fn(async ({ data }) => ({ id: 40, ...data })),
        delete: jest.fn().mockResolvedValue({ id: 30 }),
      },
    };
    const prisma = {
      productImage: { findUnique: jest.fn().mockResolvedValue({ id: 30, productId: 1 }) },
      $transaction: jest.fn(async (operation) => operation(tx)),
    };
    const service = new AdminProductsService(
      prisma as unknown as PrismaService,
      {} as ProductVariantsService,
    );
    return { service, tx };
  }
  it('appends an implicit image after existing gallery positions without changing selected hover', async () => {
    const h = setup();
    expect(await h.service.addImage(1, '/uploads/new.webp')).toMatchObject({
      productId: 1,
      sortOrder: 8,
    });
    expect(h.tx.$queryRaw.mock.calls[0][0].join('')).toContain('FOR UPDATE');
    expect(h.tx.productImage.findFirst).toHaveBeenCalledWith({
      where: { productId: 1 },
      orderBy: [{ sortOrder: 'desc' }, { id: 'desc' }],
      select: { sortOrder: true },
    });
  });
  it('keeps explicit position semantics and starts an empty gallery at zero', async () => {
    const h = setup();
    expect(await h.service.addImage(1, '/uploads/explicit.webp', 0)).toMatchObject({
      sortOrder: 0,
    });
    expect(h.tx.productImage.findFirst).not.toHaveBeenCalled();
    h.tx.productImage.findFirst.mockResolvedValue(null);
    expect(await h.service.addImage(1, '/uploads/first.webp')).toMatchObject({ sortOrder: 0 });
  });
  it('re-reads deletion target under the same parent lock and rejects a concurrently removed image', async () => {
    const h = setup();
    h.tx.productImage.findUnique.mockResolvedValue(null);
    await expect(h.service.removeImage(30)).rejects.toMatchObject({ status: 404 });
    expect(h.tx.productImage.delete).not.toHaveBeenCalled();
    expect(h.tx.$queryRaw.mock.calls[0][1]).toBe(1);
    h.tx.productImage.findUnique.mockResolvedValue({ id: 30, productId: 1 });
    expect(await h.service.removeImage(30)).toEqual({ deleted: true });
  });
});

describe('Real second-image public card contract', () => {
  function setup(images: Array<{ url: string }>) {
    const product = {
      id: 1,
      name: 'خوراک',
      slug: 'food',
      isActive: true,
      brand: {},
      images,
      variants: [{ price: 123456, compareAtPrice: null, stock: 5 }],
      lifeStage: 'ALL',
      sizeClass: 'ALL',
      tags: [],
    };
    const prisma = {
      product: {
        findMany: jest.fn().mockResolvedValue([product]),
        count: jest.fn().mockResolvedValue(1),
      },
      favorite: {
        findMany: jest.fn().mockResolvedValue([{ product }]),
        count: jest.fn().mockResolvedValue(1),
      },
      pet: {
        findUnique: jest.fn().mockResolvedValue({
          userId: 7,
          petTypeId: 3,
          petType: { slug: 'bird', name: 'پرنده' },
          tags: [],
          birthDate: null,
          weightKg: null,
        }),
      },
    };
    return { prisma, client: prisma as unknown as PrismaService };
  }
  it('returns the same primary/hover in catalog, favorites and recommendations with ordered take-two queries', async () => {
    const h = setup([{ url: '/uploads/main.webp' }, { url: '/uploads/chosen.webp' }]);
    const catalog = await new ProductsService(h.client).findAll(new PaginationQueryDto());
    const favorites = await new FavoritesService(h.client).findAll(7, new PaginationQueryDto());
    const recommendations = await new ProductsRecommendationService(h.client).findForPet(7, 2);
    for (const response of [catalog, favorites, recommendations]) {
      expect(response.data[0]).toMatchObject({
        image: '/uploads/main.webp',
        hoverImage: '/uploads/chosen.webp',
        minPrice: 123456,
      });
    }
    for (const call of h.prisma.product.findMany.mock.calls) {
      expect(call[0].include.images).toEqual({
        take: 2,
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        select: { url: true },
      });
    }
    expect(h.prisma.favorite.findMany.mock.calls[0][0].include.product.include.images.take).toBe(2);
  });
  it.each([{ images: [] }, { images: [{ url: '/uploads/main.webp' }] }])(
    'returns null rather than inventing a hover picture for missing second image',
    async ({ images }) => {
      const h = setup(images);
      expect(
        (await new ProductsService(h.client).findAll(new PaginationQueryDto())).data[0].hoverImage,
      ).toBeNull();
      expect(
        (await new FavoritesService(h.client).findAll(7, new PaginationQueryDto())).data[0]
          .hoverImage,
      ).toBeNull();
      expect(
        (await new ProductsRecommendationService(h.client).findForPet(7, 2)).data[0].hoverImage,
      ).toBeNull();
    },
  );
});
