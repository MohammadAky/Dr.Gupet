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
  async findAll(
    query: PaginationQueryDto & {
      city?: string;
      province?: string;
      is24h?: boolean | string;
    },
  ) {
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
      // query params arrive as strings ('true'/'false')
      where.is24h = is24h === true || is24h === 'true';
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
        orderBy: [{ isVerified: 'desc' }, { is24h: 'desc' }, { name: 'asc' }],
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

  // -------------------------------------------------------------------
  // Admin
  // -------------------------------------------------------------------

  /** All pharmacies including inactive */
  async findAllAdmin(query: {
    page?: number;
    limit?: number;
    q?: string;
    city?: string;
    province?: string;
    isActive?: boolean;
  }) {
    const { page = 1, limit = 20, q, city, province, isActive } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (isActive !== undefined) where.isActive = isActive;
    if (q) where.name = { contains: normalizeFa(q), mode: 'insensitive' };
    if (city) where.city = { contains: normalizeFa(city), mode: 'insensitive' };
    if (province) where.province = { contains: normalizeFa(province), mode: 'insensitive' };

    const [pharmacies, total] = await Promise.all([
      this.prisma.pharmacy.findMany({
        where,
        include: { _count: { select: { medicines: true } } },
        skip,
        take: limit,
        orderBy: { name: 'asc' },
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

  async findOneAdmin(id: number) {
    const pharmacy = await this.prisma.pharmacy.findUnique({
      where: { id },
      include: {
        medicines: {
          include: {
            medicine: { select: { id: true, name: true, isActive: true } },
          },
          orderBy: { lastConfirmedAt: 'desc' },
        },
      },
    });

    if (!pharmacy) {
      throw new NotFoundException('داروخانه یافت نشد');
    }

    return pharmacy;
  }

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
    isVerified?: boolean;
    isActive?: boolean;
  }) {
    return this.prisma.pharmacy.create({
      data: {
        name: data.name,
        province: data.province,
        city: data.city,
        address: data.address,
        lat: data.lat,
        lng: data.lng,
        phone: data.phone,
        workingHours: data.workingHours,
        is24h: data.is24h ?? false,
        isVerified: data.isVerified ?? false,
        isActive: data.isActive ?? true,
      },
    });
  }

  async update(
    id: number,
    data: Partial<{
      name: string;
      province: string;
      city: string;
      address: string;
      lat: number;
      lng: number;
      phone: string;
      workingHours: string;
      is24h: boolean;
      isVerified: boolean;
      isActive: boolean;
    }>,
  ) {
    const pharmacy = await this.prisma.pharmacy.findUnique({ where: { id } });
    if (!pharmacy) {
      throw new NotFoundException('داروخانه یافت نشد');
    }

    return this.prisma.pharmacy.update({ where: { id }, data });
  }

  async remove(id: number) {
    const pharmacy = await this.prisma.pharmacy.findUnique({ where: { id } });
    if (!pharmacy) {
      throw new NotFoundException('داروخانه یافت نشد');
    }

    await this.prisma.pharmacy.delete({ where: { id } });
    return { deleted: true };
  }

  /**
   * Link a medicine to a pharmacy (upsert; refreshes lastConfirmedAt)
   */
  async linkMedicine(pharmacyId: number, medicineId: number, note?: string) {
    const [pharmacy, medicine] = await Promise.all([
      this.prisma.pharmacy.findUnique({ where: { id: pharmacyId } }),
      this.prisma.medicine.findUnique({ where: { id: medicineId } }),
    ]);
    if (!pharmacy) throw new NotFoundException('داروخانه یافت نشد');
    if (!medicine) throw new NotFoundException('دارو یافت نشد');

    return this.prisma.pharmacyMedicine.upsert({
      where: { pharmacyId_medicineId: { pharmacyId, medicineId } },
      create: { pharmacyId, medicineId, note, lastConfirmedAt: new Date() },
      update: { note, lastConfirmedAt: new Date() },
    });
  }

  async unlinkMedicine(pharmacyId: number, medicineId: number) {
    const link = await this.prisma.pharmacyMedicine.findUnique({
      where: { pharmacyId_medicineId: { pharmacyId, medicineId } },
    });
    if (!link) {
      throw new NotFoundException('ارتباط دارو و داروخانه یافت نشد');
    }

    await this.prisma.pharmacyMedicine.delete({
      where: { pharmacyId_medicineId: { pharmacyId, medicineId } },
    });
    return { deleted: true };
  }
}
