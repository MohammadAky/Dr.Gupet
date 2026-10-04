import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Read-side for the SMS delivery log (phase 2). Supports the admin panel's
 * "did the code actually go out?" investigation with phone/kind/status filters.
 */
@Injectable()
export class SmsLogsService {
  constructor(private prisma: PrismaService) {}

  async findAllAdmin(query: {
    page?: number;
    limit?: number;
    phone?: string;
    kind?: string;
    status?: string;
  }) {
    const { page = 1, limit = 20, phone, kind, status } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (phone) where.phone = { contains: phone, mode: 'insensitive' };
    if (kind) where.kind = kind;
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      this.prisma.smsLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.smsLog.count({ where }),
    ]);

    return {
      data: items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
