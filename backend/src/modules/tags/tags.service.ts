import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/filters/all-exceptions.filter';
import { slugify } from '../../common/utils/slugify.util';
import { normalizeFa } from '../../common/utils/normalize-fa.util';

@Injectable()
export class TagsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get tags filtered by type (ALLERGEN or DIET)
   */
  async findAll(type?: string) {
    const where = type ? { type } : {};

    return this.prisma.tag.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  // -------------------------------------------------------------------
  // Admin
  // -------------------------------------------------------------------

  async findAllAdmin(type?: string, opts: { search?: string; isActive?: boolean } = {}) {
    const where: any = {};
    if (type) where.type = type;
    if (opts.search) {
      where.OR = [
        { name: { contains: normalizeFa(opts.search), mode: 'insensitive' } },
        { slug: { contains: normalizeFa(opts.search), mode: 'insensitive' } },
      ];
    }
    // Note: Tag has no isActive column — opts.isActive is accepted for API
    // uniformity with the other reference entities but intentionally ignored.

    return this.prisma.tag.findMany({
      where,
      include: {
        _count: { select: { productTags: true, petTags: true } },
      },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
  }

  async create(data: { name: string; slug?: string; type: string }) {
    if (!['ALLERGEN', 'DIET'].includes(data.type)) {
      throw new AppException('VALIDATION_ERROR', 'نوع تگ باید ALLERGEN یا DIET باشد', 400);
    }

    const slug = slugify(data.slug || data.name);
    const exists = await this.prisma.tag.findFirst({
      where: { OR: [{ slug }, { name: data.name, type: data.type }] },
    });
    if (exists) {
      throw new AppException('CONFLICT', 'تگ با این نام یا slug وجود دارد', 409);
    }

    return this.prisma.tag.create({
      data: { name: data.name, slug, type: data.type },
    });
  }

  async update(id: number, data: Partial<{ name: string }>) {
    const tag = await this.prisma.tag.findUnique({ where: { id } });
    if (!tag) {
      throw new NotFoundException('تگ یافت نشد');
    }

    return this.prisma.tag.update({ where: { id }, data });
  }

  /**
   * Delete tag: refuse when referenced (deleting would silently strip
   * product/pet tags due to cascade rules).
   */
  async remove(id: number) {
    const tag = await this.prisma.tag.findUnique({
      where: { id },
      include: { _count: { select: { productTags: true, petTags: true } } },
    });
    if (!tag) {
      throw new NotFoundException('تگ یافت نشد');
    }

    const used = tag._count.productTags + tag._count.petTags;
    if (used > 0) {
      throw new AppException(
        'CONFLICT',
        'این تگ در محصولات یا پت‌ها استفاده شده است و قابل حذف نیست',
        409,
      );
    }

    await this.prisma.tag.delete({ where: { id } });
    return { deleted: true };
  }
}
