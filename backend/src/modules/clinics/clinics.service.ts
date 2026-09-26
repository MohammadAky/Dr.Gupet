import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizeFa } from '../../common/utils/normalize-fa.util';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@Injectable()
export class ClinicsService {
  constructor(private prisma: PrismaService) {}

  /**
   * List clinics with filtering
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

    const [clinics, total] = await Promise.all([
      this.prisma.clinic.findMany({
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
      this.prisma.clinic.count({ where }),
    ]);

    return {
      data: clinics,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get clinic detail
   */
  async findOne(id: number) {
    const clinic = await this.prisma.clinic.findUnique({
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

    if (!clinic) {
      throw new NotFoundException('کلینیک یافت نشد');
    }

    return clinic;
  }

  /**
   * Create clinic (admin only)
   */
  async create(data: {
    name: string;
    province: string;
    city: string;
    address: string;
    lat?: number;
    lng?: number;
    phone?: string;
    workingHours?: string;
    is24h?: boolean;
  }) {
    return this.prisma.clinic.create({
      data: {
        ...data,
        isVerified: false,
      },
    });
  }

  /**
   * Update clinic (admin only)
   */
  async update(id: number, data: Partial<{
    name: string;
    province: string;
    city: string;
    address: string;
    lat?: number;
    lng?: number;
    phone?: string;
    workingHours?: string;
    is24h?: boolean;
    isVerified?: boolean;
    isActive?: boolean;
  }>) {
    const clinic = await this.prisma.clinic.findUnique({ where: { id } });
    if (!clinic) {
      throw new NotFoundException('کلینیک یافت نشد');
    }

    return this.prisma.clinic.update({
      where: { id },
      data,
    });
  }

  /**
   * Delete clinic (admin only)
   */
  async delete(id: number) {
    const clinic = await this.prisma.clinic.findUnique({ where: { id } });
    if (!clinic) {
      throw new NotFoundException('کلینیک یافت نشد');
    }

    return this.prisma.clinic.delete({ where: { id } });
  }
}