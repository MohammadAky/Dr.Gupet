import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/filters/all-exceptions.filter';
import { slugify } from '../../common/utils/slugify.util';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get categories as tree (parent → children)
   * Optional filter by petTypeId
   */
  async findAll(petTypeId?: number) {
    const where: any = {
      isActive: true,
      parentId: null, // Only root categories
    };

    if (petTypeId) {
      where.petTypeId = petTypeId;
    }

    const categories = await this.prisma.productCategory.findMany({
      where,
      include: {
        children: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            slug: true,
            image: true,
          },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    return categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      image: cat.image,
      children: cat.children,
    }));
  }

  // -------------------------------------------------------------------
  // Admin
  // -------------------------------------------------------------------

  /** Flat list including inactive, with parent/children info */
  async findAllAdmin(petTypeId?: number) {
    const where: any = {};
    if (petTypeId) where.petTypeId = petTypeId;

    return this.prisma.productCategory.findMany({
      where,
      include: {
        parent: { select: { id: true, name: true } },
        _count: { select: { children: true, products: true } },
      },
      orderBy: [{ parentId: 'asc' }, { name: 'asc' }],
    });
  }

  async create(data: {
    name: string;
    slug?: string;
    petTypeId?: number;
    parentId?: number;
    image?: string;
    isActive?: boolean;
  }) {
    const slug = slugify(data.slug || data.name);
    const exists = await this.prisma.productCategory.findUnique({ where: { slug } });
    if (exists) {
      throw new AppException('CONFLICT', 'slug دسته‌بندی تکراری است', 409);
    }
    if (data.parentId) {
      const parent = await this.prisma.productCategory.findUnique({
        where: { id: data.parentId },
      });
      if (!parent) throw new NotFoundException('دسته والد یافت نشد');
    }

    return this.prisma.productCategory.create({
      data: {
        name: data.name,
        slug,
        petTypeId: data.petTypeId,
        parentId: data.parentId,
        image: data.image,
        isActive: data.isActive ?? true,
      },
    });
  }

  async update(
    id: number,
    data: Partial<{
      name: string;
      petTypeId: number;
      parentId: number;
      image: string;
      isActive: boolean;
    }>,
  ) {
    const category = await this.prisma.productCategory.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException('دسته‌بندی یافت نشد');
    }
    if (data.parentId) {
      if (data.parentId === id) {
        throw new BadRequestException('دسته نمی‌تواند والد خودش باشد');
      }
      const parent = await this.prisma.productCategory.findUnique({
        where: { id: data.parentId },
      });
      if (!parent) throw new NotFoundException('دسته والد یافت نشد');
    }

    return this.prisma.productCategory.update({ where: { id }, data });
  }

  async remove(id: number) {
    const category = await this.prisma.productCategory.findUnique({
      where: { id },
      include: { _count: { select: { children: true, products: true } } },
    });
    if (!category) {
      throw new NotFoundException('دسته‌بندی یافت نشد');
    }

    if (category._count.children > 0 || category._count.products > 0) {
      const updated = await this.prisma.productCategory.update({
        where: { id },
        data: { isActive: false },
      });
      return { deleted: false, deactivated: true, category: updated };
    }

    await this.prisma.productCategory.delete({ where: { id } });
    return { deleted: true, deactivated: false };
  }
}
