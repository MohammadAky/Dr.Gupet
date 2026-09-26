import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizeFa } from '../../common/utils/normalize-fa.util';
import { MEDICINE_DISCLAIMER } from '../../common/constants';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@Injectable()
export class MedicinesService {
  constructor(private prisma: PrismaService) {}

  /**
   * List medicines with filtering
   */
  async findAll(query: PaginationQueryDto & {
    q?: string;
    petTypeId?: number;
    requiresPrescription?: boolean;
  }) {
    const { page = 1, limit = 20, q, petTypeId, requiresPrescription } = query;
    const skip = (page - 1) * limit;

    const where: any = { isActive: true };

    if (q) {
      where.OR = [
        { name: { contains: normalizeFa(q), mode: 'insensitive' } },
        { activeIngredient: { contains: normalizeFa(q), mode: 'insensitive' } },
      ];
    }

    if (petTypeId) {
      where.petTypes = { some: { id: petTypeId } };
    }

    if (requiresPrescription !== undefined) {
      where.requiresPrescription = requiresPrescription;
    }

    const [medicines, total] = await Promise.all([
      this.prisma.medicine.findMany({
        where,
        include: {
          petTypes: { select: { id: true, name: true } },
        },
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.medicine.count({ where }),
    ]);

    return {
      data: medicines,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get medicine detail with pharmacies
   */
  async findOne(id: number, city?: string) {
    const medicine = await this.prisma.medicine.findUnique({
      where: { id, isActive: true },
      include: {
        petTypes: { select: { id: true, name: true } },
        pharmacies: {
          where: city ? { pharmacy: { city } } : {},
          include: {
            pharmacy: {
              select: {
                id: true,
                name: true,
                city: true,
                address: true,
                phone: true,
                is24h: true,
                isVerified: true,
              },
            },
          },
          orderBy: [
            { pharmacy: { isVerified: 'desc' } },
            { pharmacy: { is24h: 'desc' } },
            { lastConfirmedAt: 'desc' },
          ],
        },
      },
    });

    if (!medicine) {
      throw new NotFoundException('دارو یافت نشد');
    }

    return {
      ...medicine,
      disclaimer: MEDICINE_DISCLAIMER,
      pharmacies: medicine.pharmacies.map((pm) => ({
        ...pm.pharmacy,
        note: pm.note,
        lastConfirmedAt: pm.lastConfirmedAt,
      })),
    };
  }
}