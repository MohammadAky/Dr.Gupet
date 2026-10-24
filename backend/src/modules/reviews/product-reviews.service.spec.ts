import { ProductReviewsService, cleanReviewBody } from './product-reviews.service';
import { ratingSummaries, summariseRatings } from './rating.util';

type Review = {
  id?: number;
  productId: number;
  userId: number;
  rating: number;
  body: string;
  isVisible?: boolean;
};

function harness(options: {
  product?: { id: number; slug: string; isActive: boolean } | null;
  review?: Review | null;
  deliveredFor?: number[]; // productIds with a DELIVERED order
  createError?: { code: string };
  grouped?: Array<{ productId: number; rating: number; _count: { _all: number } }>;
} = {}) {
  const product = options.product === undefined ? { id: 4, slug: 'dog-food', isActive: true } : options.product;
  const delivered = options.deliveredFor ?? [4];
  const reviews: Review[] = options.review ? [options.review] : [];

  const productReview = {
    findUnique: jest.fn(async ({ where }: any) => {
      const key = where.userId_productId ?? where;
      const found = reviews.find(
        (row) =>
          (!key.productId || row.productId === key.productId) &&
          (!key.userId || row.userId === key.userId),
      );
      return found ? { isVisible: true, ...found } : null;
    }),
    findMany: jest.fn(async () => []),
    count: jest.fn(async () => 0),
    create: jest.fn(async ({ data }: any) => {
      if (options.createError) throw options.createError;
      const row = { id: 11, ...data, isVisible: true };
      reviews.push(row);
      return row;
    }),
    update: jest.fn(async ({ data }: any) => ({ id: 11, productId: product?.id, userId: 1, ...data })),
    delete: jest.fn(async () => ({ id: 11 })),
    groupBy: jest.fn(async () => options.grouped ?? []),
  };

  const prisma = {
    product: { findUnique: jest.fn(async () => product) },
    productReview,
    order: {
      findFirst: jest.fn(async ({ where }: any) => {
        const productId = where?.items?.some?.variant?.productId;
        return delivered.includes(productId) ? { id: 900 } : null;
      }),
    },
  };

  return { service: new ProductReviewsService(prisma as any), prisma, reviews };
}

describe('cleanReviewBody', () => {
  it('strips markup, control characters and collapses whitespace', () => {
    expect(cleanReviewBody('  <b>عالی</b>\n بود\u200c  ')).toBe('عالی بود');
  });

  it('keeps ordinary Persian text intact', () => {
    expect(cleanReviewBody('کیفیت خوب بود، سگم دوست داشت')).toBe('کیفیت خوب بود، سگم دوست داشت');
  });
});

describe('rating aggregates (issue #37)', () => {
  it('returns a null average and zero count when nothing is rated', () => {
    expect(summariseRatings([])).toEqual({ average: null, count: 0 });
  });

  it('rounds the weighted average to one decimal', () => {
    expect(
      summariseRatings([
        { rating: 5, count: 2 },
        { rating: 4, count: 1 },
      ]),
    ).toEqual({ average: 4.7, count: 3 });
  });

  it('reads every product of a page in a single grouped query', async () => {
    const groupBy = jest.fn().mockResolvedValue([
      { productId: 4, rating: 5, _count: { _all: 2 } },
      { productId: 9, rating: 3, _count: { _all: 1 } },
    ]);
    const map = await ratingSummaries({ productReview: { groupBy } }, [4, 9, 4]);
    expect(groupBy).toHaveBeenCalledTimes(1);
    expect(map.get(4)).toEqual({ average: 5, count: 2 });
    expect(map.get(9)).toEqual({ average: 3, count: 1 });
  });

  it('degrades to empty ratings when the delegate is missing (test doubles)', async () => {
    const map = await ratingSummaries({}, [4]);
    expect(map.get(4)).toEqual({ average: null, count: 0 });
  });
});

describe('ProductReviewsService.eligibility', () => {
  it('allows a buyer with a delivered order and no review yet', async () => {
    const h = harness();
    await expect(h.service.eligibility(1, 'dog-food')).resolves.toEqual({
      canReview: true,
      reason: null,
      review: null,
    });
  });

  it('explains a missing delivered purchase', async () => {
    const h = harness({ deliveredFor: [] });
    await expect(h.service.eligibility(1, 'dog-food')).resolves.toMatchObject({
      canReview: false,
      reason: 'NO_DELIVERED_PURCHASE',
    });
  });

  it('returns the existing review and blocks a second one', async () => {
    const h = harness({ review: { id: 3, productId: 4, userId: 1, rating: 4, body: 'خوب' } });
    await expect(h.service.eligibility(1, 'dog-food')).resolves.toMatchObject({
      canReview: false,
      reason: 'ALREADY_REVIEWED',
      review: { id: 3, rating: 4 },
    });
  });

  it('never allows reviews on presentation samples', async () => {
    const h = harness({ product: { id: 4, slug: 'presentation-v1-dog-food', isActive: true } });
    await expect(h.service.eligibility(1, 'presentation-v1-dog-food')).resolves.toMatchObject({
      canReview: false,
      reason: 'SAMPLE_PRODUCT',
    });
  });

  it('404s for an unknown or inactive product', async () => {
    const h = harness({ product: null });
    await expect(h.service.eligibility(1, 'nope')).rejects.toMatchObject({ status: 404 });
  });
});

describe('ProductReviewsService.create', () => {
  it('rejects a buyer without a delivered order with 403 before writing', async () => {
    const h = harness({ deliveredFor: [] });
    await expect(h.service.create(1, 'dog-food', { rating: 5, body: 'عالی بود' })).rejects.toMatchObject({
      code: 'REVIEW_NOT_ELIGIBLE',
      status: 403,
    });
    expect(h.prisma.productReview.create).not.toHaveBeenCalled();
  });

  it('refuses a body that becomes empty after stripping markup', async () => {
    const h = harness();
    await expect(h.service.create(1, 'dog-food', { rating: 5, body: '<b></b>' })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    expect(h.prisma.productReview.create).not.toHaveBeenCalled();
  });

  it('stores the sanitized body and returns the fresh summary', async () => {
    const h = harness({
      grouped: [{ productId: 4, rating: 5, _count: { _all: 1 } }],
    });
    const result = await h.service.create(1, 'dog-food', { rating: 5, body: '  <i>عالی</i> بود ' });
    expect(h.prisma.productReview.create).toHaveBeenCalledWith({
      data: { productId: 4, userId: 1, rating: 5, body: 'عالی بود' },
    });
    expect(result.summary).toEqual({ average: 5, count: 1 });
  });

  it('maps the unique-index race to a 409 conflict', async () => {
    const h = harness({ createError: { code: 'P2002' } });
    await expect(h.service.create(1, 'dog-food', { rating: 5, body: 'عالی بود' })).rejects.toMatchObject({
      code: 'REVIEW_ALREADY_EXISTS',
      status: 409,
    });
  });
});

describe('ProductReviewsService.update/remove', () => {
  it('404s when the user has no review for the product', async () => {
    const h = harness();
    await expect(h.service.update(1, 'dog-food', { rating: 3 })).rejects.toMatchObject({ status: 404 });
    await expect(h.service.remove(1, 'dog-food')).rejects.toMatchObject({ status: 404 });
  });

  it('rejects an update without any field', async () => {
    const h = harness({ review: { id: 3, productId: 4, userId: 1, rating: 4, body: 'خوب بود' } });
    await expect(h.service.update(1, 'dog-food', {})).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('does not let a hidden review be edited', async () => {
    const h = harness({
      review: { id: 3, productId: 4, userId: 1, rating: 4, body: 'خوب بود', isVisible: false },
    });
    await expect(h.service.update(1, 'dog-food', { body: 'ویرایش' })).rejects.toMatchObject({
      code: 'REVIEW_NOT_EDITABLE',
    });
  });
});
