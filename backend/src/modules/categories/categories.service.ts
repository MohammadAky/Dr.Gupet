import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

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
}