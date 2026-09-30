import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/filters/all-exceptions.filter';
import { slugify } from '../../common/utils/slugify.util';

@Injectable()
export class PetTypesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get all active pet types
   */
  async findAll() {
    return this.prisma.petType.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Get breeds for a specific pet type
   */
  async findBreeds(petTypeId: number) {
    return this.prisma.breed.findMany({
      where: {
        petTypeId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  // -------------------------------------------------------------------
  // Admin
  // -------------------------------------------------------------------

  async findAllAdmin() {
    return this.prisma.petType.findMany({
      include: {
        _count: { select: { breeds: true, pets: true, products: true, medicines: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async create(data: { name: string; slug?: string; isActive?: boolean }) {
    const slug = slugify(data.slug || data.name);
    const exists = await this.prisma.petType.findFirst({
      where: { OR: [{ name: data.name }, { slug }] },
    });
    if (exists) {
      throw new AppException('CONFLICT', 'نوع حیوان با این نام یا slug وجود دارد', 409);
    }

    return this.prisma.petType.create({
      data: { name: data.name, slug, isActive: data.isActive ?? true },
    });
  }

  async update(id: number, data: Partial<{ name: string; isActive: boolean }>) {
    const petType = await this.prisma.petType.findUnique({ where: { id } });
    if (!petType) {
      throw new NotFoundException('نوع حیوان یافت نشد');
    }

    return this.prisma.petType.update({ where: { id }, data });
  }

  async remove(id: number) {
    const petType = await this.prisma.petType.findUnique({
      where: { id },
      include: {
        _count: { select: { breeds: true, pets: true, products: true, medicines: true } },
      },
    });
    if (!petType) {
      throw new NotFoundException('نوع حیوان یافت نشد');
    }

    const used =
      petType._count.breeds +
      petType._count.pets +
      petType._count.products +
      petType._count.medicines;
    if (used > 0) {
      const updated = await this.prisma.petType.update({
        where: { id },
        data: { isActive: false },
      });
      return { deleted: false, deactivated: true, petType: updated };
    }

    await this.prisma.petType.delete({ where: { id } });
    return { deleted: true, deactivated: false };
  }
}
