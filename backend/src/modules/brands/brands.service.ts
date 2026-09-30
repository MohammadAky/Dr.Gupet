import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/filters/all-exceptions.filter';
import { slugify } from '../../common/utils/slugify.util';

@Injectable()
export class BrandsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get all active brands
   */
  async findAll() {
    return this.prisma.brand.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        logo: true,
        country: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  // -------------------------------------------------------------------
  // Admin
  // -------------------------------------------------------------------

  async findAllAdmin() {
    return this.prisma.brand.findMany({
      include: { _count: { select: { products: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async create(data: {
    name: string;
    slug?: string;
    logo?: string;
    country?: string;
    description?: string;
    isActive?: boolean;
  }) {
    const slug = slugify(data.slug || data.name);
    const exists = await this.prisma.brand.findFirst({
      where: { OR: [{ name: data.name }, { slug }] },
    });
    if (exists) {
      throw new AppException('CONFLICT', 'برند با این نام یا slug وجود دارد', 409);
    }

    return this.prisma.brand.create({
      data: {
        name: data.name,
        slug,
        logo: data.logo,
        country: data.country,
        description: data.description,
        isActive: data.isActive ?? true,
      },
    });
  }

  async update(
    id: number,
    data: Partial<{
      name: string;
      logo: string;
      country: string;
      description: string;
      isActive: boolean;
    }>,
  ) {
    const brand = await this.prisma.brand.findUnique({ where: { id } });
    if (!brand) {
      throw new NotFoundException('برند یافت نشد');
    }

    return this.prisma.brand.update({ where: { id }, data });
  }

  async remove(id: number) {
    const brand = await this.prisma.brand.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });
    if (!brand) {
      throw new NotFoundException('برند یافت نشد');
    }

    if (brand._count.products > 0) {
      const updated = await this.prisma.brand.update({
        where: { id },
        data: { isActive: false },
      });
      return { deleted: false, deactivated: true, brand: updated };
    }

    await this.prisma.brand.delete({ where: { id } });
    return { deleted: true, deactivated: false };
  }
}
