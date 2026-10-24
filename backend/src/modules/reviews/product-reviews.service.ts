import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/filters/all-exceptions.filter';
import { PRESENTATION_PREFIX } from '../../common/utils/presentation-sample.util';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { UpdateReviewDto, WriteReviewDto } from './dto/review.dto';
import { RatingSummary, ratingSummaries, ratingSummary } from './rating.util';

export type { RatingSummary };
export type EligibilityReason =
  | 'NO_DELIVERED_PURCHASE'
  | 'ALREADY_REVIEWED'
  | 'SAMPLE_PRODUCT'
  | null;

export const GUEST_DISPLAY_NAME = 'خریدار گوپت';

/** Strip markup/control characters: review bodies are stored and shown as text. */
export function cleanReviewBody(raw: string): string {
  return (raw ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Issue #37 — real product reviews, only from buyers whose order for this
 * product reached DELIVERED. Aggregates always read visible rows, so hiding a
 * review never leaves a stale public rating.
 */
@Injectable()
export class ProductReviewsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Rating summaries for a page of product cards, in one grouped query so a
   * list never turns into an N+1 (issue #37 acceptance).
   */
  async summariesFor(productIds: number[]): Promise<Map<number, RatingSummary>> {
    return ratingSummaries(this.prisma, productIds);
  }

  async summaryFor(productId: number): Promise<RatingSummary> {
    return ratingSummary(this.prisma, productId);
  }

  /** Public, paginated list — no phone, username, address, email or order data. */
  async list(slug: string, query: PaginationQueryDto) {
    const product = await this.requireProduct(slug);
    const { page = 1, limit = 20 } = query;
    const where = { productId: product.id, isVisible: true };

    const [rows, total] = await Promise.all([
      this.prisma.productReview.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          rating: true,
          body: true,
          createdAt: true,
          updatedAt: true,
          user: { select: { firstName: true } },
        },
      }),
      this.prisma.productReview.count({ where }),
    ]);

    return {
      data: rows.map((row) => ({
        id: row.id,
        rating: row.rating,
        body: row.body,
        author: { name: row.user?.firstName?.trim() || GUEST_DISPLAY_NAME },
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        verifiedPurchase: true,
      })),
      summary: await this.summaryFor(product.id),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async eligibility(userId: number, slug: string) {
    const product = await this.requireProduct(slug);
    const review = await this.prisma.productReview.findUnique({
      where: { userId_productId: { userId, productId: product.id } },
      select: { id: true, rating: true, body: true, isVisible: true, updatedAt: true },
    });

    if (product.slug.startsWith(PRESENTATION_PREFIX)) {
      return { canReview: false, reason: 'SAMPLE_PRODUCT' as EligibilityReason, review };
    }
    if (review) {
      return { canReview: false, reason: 'ALREADY_REVIEWED' as EligibilityReason, review };
    }
    const purchased = await this.prisma.order.findFirst({
      where: {
        userId,
        status: 'DELIVERED',
        items: { some: { variant: { productId: product.id } } },
      },
      select: { id: true },
    });
    return {
      canReview: Boolean(purchased),
      reason: purchased ? null : ('NO_DELIVERED_PURCHASE' as EligibilityReason),
      review,
    };
  }

  async create(userId: number, slug: string, dto: WriteReviewDto) {
    const product = await this.requireProduct(slug);
    if (product.slug.startsWith(PRESENTATION_PREFIX)) {
      throw new AppException('REVIEW_NOT_ELIGIBLE', 'برای محصول نمونه نمی‌توان نظر ثبت کرد', 403);
    }

    const body = this.requireCleanBody(dto.body);
    const existing = await this.prisma.productReview.findUnique({
      where: { userId_productId: { userId, productId: product.id } },
      select: { id: true },
    });
    if (existing) {
      throw new AppException('REVIEW_ALREADY_EXISTS', 'برای این محصول قبلاً نظر ثبت کرده‌اید', 409);
    }

    const purchased = await this.prisma.order.findFirst({
      where: {
        userId,
        status: 'DELIVERED',
        items: { some: { variant: { productId: product.id } } },
      },
      select: { id: true },
    });
    if (!purchased) {
      throw new AppException(
        'REVIEW_NOT_ELIGIBLE',
        'ثبت نظر فقط برای خریدارانی است که سفارششان تحویل داده شده است',
        403,
      );
    }

    try {
      const review = await this.prisma.productReview.create({
        data: { productId: product.id, userId, rating: dto.rating, body },
      });
      return { review, summary: await this.summaryFor(product.id) };
    } catch (error) {
      // Two parallel submits: the unique (userId, productId) index wins once.
      if ((error as { code?: string })?.code === 'P2002') {
        throw new AppException('REVIEW_ALREADY_EXISTS', 'برای این محصول قبلاً نظر ثبت کرده‌اید', 409);
      }
      throw error;
    }
  }

  async update(userId: number, slug: string, dto: UpdateReviewDto) {
    const product = await this.requireProduct(slug);
    const review = await this.prisma.productReview.findUnique({
      where: { userId_productId: { userId, productId: product.id } },
    });
    if (!review) throw new NotFoundException('نظر یافت نشد');
    if (!review.isVisible) {
      throw new AppException('REVIEW_NOT_EDITABLE', 'این نظر قابل ویرایش نیست', 409);
    }

    const data: { rating?: number; body?: string } = {};
    if (dto.rating !== undefined) data.rating = dto.rating;
    if (dto.body !== undefined) data.body = this.requireCleanBody(dto.body);
    if (Object.keys(data).length === 0) {
      throw new AppException('VALIDATION_ERROR', 'تغییری برای ذخیره ارسال نشده است', 400);
    }

    const updated = await this.prisma.productReview.update({ where: { id: review.id }, data });
    return { review: updated, summary: await this.summaryFor(product.id) };
  }

  async remove(userId: number, slug: string) {
    const product = await this.requireProduct(slug);
    const review = await this.prisma.productReview.findUnique({
      where: { userId_productId: { userId, productId: product.id } },
      select: { id: true },
    });
    if (!review) throw new NotFoundException('نظر یافت نشد');
    await this.prisma.productReview.delete({ where: { id: review.id } });
    return { deleted: true, summary: await this.summaryFor(product.id) };
  }

  private requireCleanBody(raw: string) {
    const body = cleanReviewBody(raw);
    if (body.length < 3) {
      throw new AppException('VALIDATION_ERROR', 'متن نظر معتبر نیست', 400);
    }
    return body;
  }

  private async requireProduct(slug: string) {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      select: { id: true, slug: true, isActive: true },
    });
    if (!product || !product.isActive) throw new NotFoundException('محصول یافت نشد');
    return product;
  }
}
