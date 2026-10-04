import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/filters/all-exceptions.filter';
import { normalizeFa } from '../../common/utils/normalize-fa.util';

@Injectable()
export class BreedsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get all active breeds (with pet type info)
   */
  async findAll(petTypeId?: number) {
    const where: any = { isActive: true };

    if (petTypeId) {
      where.petTypeId = petTypeId;
    }

    return this.prisma.breed.findMany({
      where,
      select: {
        id: true,
        name: true,
        petType: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  // -------------------------------------------------------------------
  // Admin
  // -------------------------------------------------------------------

  async findAllAdmin(
    petTypeId?: number,
    opts: { search?: string; isActive?: boolean } = {},
  ) {
    const where: any = {};
    if (petTypeId) where.petTypeId = petTypeId;
    if (opts.search) {
      where.OR = [
        { name: { contains: normalizeFa(opts.search) } },
        { slug: { contains: normalizeFa(opts.search) } },
      ];
    }
    if (opts.isActive !== undefined) where.isActive = opts.isActive;

    return this.prisma.breed.findMany({
      where,
      include: {
        petType: { select: { id: true, name: true, slug: true } },
        _count: { select: { pets: true } },
      },
      orderBy: [{ petTypeId: 'asc' }, { name: 'asc' }],
    });
  }

  async create(data: { name: string; petTypeId: number; isActive?: boolean }) {
    const petType = await this.prisma.petType.findUnique({ where: { id: data.petTypeId } });
    if (!petType) {
      throw new NotFoundException('نوع حیوان یافت نشد');
    }

    const exists = await this.prisma.breed.findFirst({
      where: { petTypeId: data.petTypeId, name: data.name },
    });
    if (exists) {
      throw new AppException('CONFLICT', 'نژاد با این نام برای این نوع وجود دارد', 409);
    }

    return this.prisma.breed.create({
      data: {
        name: data.name,
        petTypeId: data.petTypeId,
        isActive: data.isActive ?? true,
      },
    });
  }

  async update(id: number, data: Partial<{ name: string; isActive: boolean }>) {
    const breed = await this.prisma.breed.findUnique({ where: { id } });
    if (!breed) {
      throw new NotFoundException('نژاد یافت نشد');
    }

    return this.prisma.breed.update({ where: { id }, data });
  }

  async remove(id: number) {
    const breed = await this.prisma.breed.findUnique({
      where: { id },
      include: { _count: { select: { pets: true } } },
    });
    if (!breed) {
      throw new NotFoundException('نژاد یافت نشد');
    }

    if (breed._count.pets > 0) {
      const updated = await this.prisma.breed.update({
        where: { id },
        data: { isActive: false },
      });
      return { deleted: false, deactivated: true, breed: updated };
    }

    await this.prisma.breed.delete({ where: { id } });
    return { deleted: true, deactivated: false };
  }
}
