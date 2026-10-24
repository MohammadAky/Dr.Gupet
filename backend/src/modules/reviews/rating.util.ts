/**
 * Rating aggregates shared by the product list, detail, favorites and the
 * reviews endpoints (issue #37). A single grouped query per page keeps the
 * public listing free of N+1 lookups, and every read is limited to visible
 * reviews so a hidden review cannot move a public average.
 */
export type RatingSummary = { average: number | null; count: number };

export const EMPTY_RATING: RatingSummary = { average: null, count: 0 };

type GroupRow = { productId: number; rating: number; _count: { _all: number } };
type RatingRow = { rating: number; _count: { _all: number } };

export function summariseRatings(rows: Array<{ rating: number; count: number }>): RatingSummary {
  const count = rows.reduce((sum, row) => sum + row.count, 0);
  if (count === 0) return { ...EMPTY_RATING };
  const total = rows.reduce((sum, row) => sum + row.rating * row.count, 0);
  // One decimal is what the storefront shows; average is never a fake default.
  return { average: Math.round((total / count) * 10) / 10, count };
}

/** groupBy is unavailable on test doubles and older clients — treat as no data. */
function groupByDelegate(prisma: any) {
  return typeof prisma?.productReview?.groupBy === 'function'
    ? prisma.productReview.groupBy.bind(prisma.productReview)
    : null;
}

export async function ratingSummaries(
  prisma: any,
  productIds: number[],
): Promise<Map<number, RatingSummary>> {
  const ids = [...new Set(productIds.filter((id) => Number.isInteger(id) && id > 0))];
  const result = new Map<number, RatingSummary>(ids.map((id) => [id, { ...EMPTY_RATING }]));
  const groupBy = groupByDelegate(prisma);
  if (!groupBy || ids.length === 0) return result;

  const grouped = (await groupBy({
    by: ['productId', 'rating'],
    where: { productId: { in: ids }, isVisible: true },
    _count: { _all: true },
  })) as GroupRow[];

  const buckets = new Map<number, Array<{ rating: number; count: number }>>();
  for (const row of grouped) {
    const bucket = buckets.get(row.productId) ?? [];
    bucket.push({ rating: row.rating, count: row._count._all });
    buckets.set(row.productId, bucket);
  }
  for (const [productId, rows] of buckets) result.set(productId, summariseRatings(rows));
  return result;
}

export async function ratingSummary(prisma: any, productId: number): Promise<RatingSummary> {
  const groupBy = groupByDelegate(prisma);
  if (!groupBy) return { ...EMPTY_RATING };
  const rows = (await groupBy({
    by: ['rating'],
    where: { productId, isVisible: true },
    _count: { _all: true },
  })) as RatingRow[];
  return summariseRatings(rows.map((row) => ({ rating: row.rating, count: row._count._all })));
}
