import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizeFa } from '../../common/utils/normalize-fa.util';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@Injectable()
export class PharmaciesService {
  constructor(private prisma: PrismaService) {}

  /**
   * List pharmacies with filtering
   */
  async findAll(query: PaginationQueryDto & {
    city?: string;
    province?: string;
    is24h?: boolean;
  }) {
    const { page = 1, limit = 20, city, province, is24h } = query;
    const skip = (page - 1) * limit;

    const where: any = { isActive: true };

    if (city) {
      where.city = { contains: normalizeFa(city), mode: 'insensitive' };
    }

    if (province) {
      where.province = { contains: normalizeFa(province), mode: 'insensitive' };
    }

    if (is24h !== undefined) {
      where.is24h = is24h;
    }

    const [pharmacies, total] = await Promise.all([
      this.prisma.pharmacy.findMany({
        where,
        select: {
          id: true,
          name: true,
          city: true,
          province: true,
          address: true,
          phone: true,
          is24h: true,
          isVerified: true,
        },
        skip,
        take: limit,
        orderBy: [
          { isVerified: 'desc' },
          { is24h: 'desc' },
          { name: 'asc' },
        ],
      }),
      this.prisma.pharmacy.count({ where }),
    ]);

    return {
      data: pharmacies,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get pharmacy detail
   */
  async findOne(id: number) {
    const pharmacy = await this.prisma.pharmacy.findUnique({
      where: { id, isActive: true },
      select: {
        id: true,
        name: true,
        city: true,
        province: true,
        address: true,
        lat: true,
        lng: true,
        phone: true,
        workingHours: true,
        is24h: true,
        isVerified: true,
      },
    });

    if (!pharmacy) {
      throw new NotFoundException('داروخانه یافت نشد');
    }

    return pharmacy;
  }
}