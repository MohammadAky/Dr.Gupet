import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NextFunction, Request, Response } from 'express';
import { ProductReviewsController } from './product-reviews.controller';
import { ProductReviewsService } from './product-reviews.service';
import { AllExceptionsFilter } from '../../common/filters/all-exceptions.filter';

/**
 * HTTP contract for issue #37: shape validation (integer 1..5, bounded text,
 * unknown fields rejected) and identity taken from the session, never the body.
 */
describe('Product review HTTP contract', () => {
  let app: INestApplication;
  let url: string;
  const service = {
    list: jest.fn().mockResolvedValue({ data: [], summary: { average: null, count: 0 }, meta: {} }),
    eligibility: jest.fn().mockResolvedValue({ canReview: true, reason: null, review: null }),
    create: jest.fn().mockResolvedValue({ review: { id: 1, rating: 5 }, summary: {} }),
    update: jest.fn().mockResolvedValue({ review: { id: 1 }, summary: {} }),
    remove: jest.fn().mockResolvedValue({ deleted: true, summary: {} }),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ProductReviewsController],
      providers: [{ provide: ProductReviewsService, useValue: service }],
    }).compile();
    app = module.createNestApplication();
    app.use((req: Request, _res: Response, next: NextFunction) => {
      (req as any).user = { sub: 7, role: 'USER' };
      next();
    });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.listen(0, '127.0.0.1');
    url = await app.getUrl();
  });

  beforeEach(() => jest.clearAllMocks());
  afterAll(async () => app?.close());

  const post = (body: unknown) =>
    fetch(url + '/products/dog-food/reviews', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  it('serves the public list with the rating summary', async () => {
    const response = await fetch(url + '/products/dog-food/reviews?page=1&limit=10');
    expect(response.status).toBe(200);
    expect(service.list).toHaveBeenCalledWith('dog-food', expect.objectContaining({ limit: 10 }));
  });

  it('takes the writing identity from the session, not the body', async () => {
    const response = await post({ rating: 5, body: 'عالی بود' });
    expect(response.status).toBe(201);
    expect(service.create).toHaveBeenCalledWith(7, 'dog-food', { rating: 5, body: 'عالی بود' });
  });

  it.each([
    ['zero stars', { rating: 0, body: 'بد بود' }],
    ['six stars', { rating: 6, body: 'عالی' }],
    ['fractional stars', { rating: 4.5, body: 'خوب' }],
    ['string stars', { rating: '5', body: 'خوب' }],
    ['two-character body', { rating: 5, body: 'خو' }],
    ['too long body', { rating: 5, body: 'x'.repeat(1001) }],
    ['missing body', { rating: 5 }],
    ['injected userId', { rating: 5, body: 'عالی', userId: 99 }],
  ])('rejects %s with 400 before the service runs', async (_label, body) => {
    const response = await post(body);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(service.create).not.toHaveBeenCalled();
  });

  it('rejects an out-of-range page size on the public list', async () => {
    const response = await fetch(url + '/products/dog-food/reviews?limit=51');
    expect(response.status).toBe(400);
    expect(service.list).not.toHaveBeenCalled();
  });

  it('exposes eligibility and the user’s own edit/delete routes', async () => {
    expect((await fetch(url + '/products/dog-food/review-eligibility')).status).toBe(200);
    const patch = await fetch(url + '/products/dog-food/reviews/mine', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rating: 4 }),
    });
    expect(patch.status).toBe(200);
    expect(service.update).toHaveBeenCalledWith(7, 'dog-food', { rating: 4 });

    const del = await fetch(url + '/products/dog-food/reviews/mine', { method: 'DELETE' });
    expect(del.status).toBe(200);
    expect(service.remove).toHaveBeenCalledWith(7, 'dog-food');
  });
});
