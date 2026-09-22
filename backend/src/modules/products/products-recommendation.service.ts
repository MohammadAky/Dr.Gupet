import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  PUPPY_KITTEN_MAX_MONTHS,
  SENIOR_MIN_MONTHS,
  DOG_SMALL_MAX_KG,
  DOG_MEDIUM_MAX_KG,
} from '../../common/constants';

@Injectable()
export class ProductsRecommendationService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get product recommendations for a pet
   */
  async findForPet(
    userId: number,
    petId: number,
    page: number = 1,
    limit: number = 20,
  ) {
    // Verify pet belongs to user
    const pet = await this.prisma.pet.findUnique({
      where: { id: petId, deletedAt: null },
      include: {
        petType: { select: { slug: true } },
        tags: {
          include: {
            tag: { select: { id: true, type: true, slug: true } },
          },
        },
      },
    });

    if (!pet || pet.userId !== userId) {
      throw new NotFoundException('حیوان یافت نشد');
    }

    // Compute life stage
    const lifeStage = this.computeLifeStage(pet.birthDate);

    // Compute size class (dogs only)
    const sizeClass = this.computeSizeClass(pet.petType.slug, pet.weightKg);

    // Get pet's allergen tag IDs
    const allergenTagIds = pet.tags
      .filter((pt) => pt.tag.type === 'ALLERGEN')
      .map((pt) => pt.tag.id);

    // Get pet's diet tag IDs
    const dietTagIds = pet.tags
      .filter((pt) => pt.tag.type === 'DIET')
      .map((pt) => pt.tag.id);

    // Build where clause
    const where: any = {
      isActive: true,
      petTypeId: pet.petTypeId,
      // Must have at least one active in-stock variant
      variants: {
        some: {
          isActive: true,
          stock: { gt: 0 },
        },
      },
    };

    // Life stage filter
    if (lifeStage) {
      where.lifeStage = { in: [lifeStage, 'ALL'] };
    }

    // Size class filter (dogs only)
    if (sizeClass) {
      where.sizeClass = { in: [sizeClass, 'ALL'] };
    }

    // Neuter suitability filter
    if (pet.isNeutered) {
      where.neuterSuitability = { in: ['ANY', 'NEUTERED_ONLY'] };
    }

    // Exclude products with allergen tags that match pet's allergens
    if (allergenTagIds.length > 0) {
      where.tags = {
        none: {
          tagId: { in: allergenTagIds },
          kind: 'CONTAINS',
        },
      };
    }

    const skip = (page - 1) * limit;

    // Execute queries in parallel
    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: {
          brand: { select: { id: true, name: true } },
          images: { take: 1, select: { url: true } },
          variants: {
            where: { isActive: true, stock: { gt: 0 } },
            select: { price: true },
            orderBy: { price: 'asc' },
            take: 1,
          },
          tags: {
            where: { kind: 'SUITABLE_FOR' },
            include: {
              tag: { select: { id: true, name: true } },
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    // Calculate match score and transform
    const items = products.map((product) => {
      const productDietTagIds = product.tags.map((pt) => pt.tag.id);
      const matchedDietTagIds = dietTagIds.filter((id) =>
        productDietTagIds.includes(id),
      );
      const matchedTags = product.tags
        .filter((pt) => matchedDietTagIds.includes(pt.tag.id))
        .map((pt) => pt.tag.name);

      return {
        id: product.id,
        name: product.name,
        slug: product.slug,
        brand: product.brand,
        image: product.images[0]?.url || null,
        minPrice: product.variants[0]?.price || 0,
        inStock: true,
        lifeStage: product.lifeStage,
        sizeClass: product.sizeClass,
        matchedTags,
        matchScore: matchedDietTagIds.length,
      };
    });

    // Sort by match score (descending), then by newest
    items.sort((a, b) => {
      if (b.matchScore !== a.matchScore) {
        return b.matchScore - a.matchScore;
      }
      return 0;
    });

    return {
      data: items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Compute life stage from birth date
   */
  private computeLifeStage(birthDate: Date | null): string | null {
    if (!birthDate) return null;

    const now = new Date();
    const birth = new Date(birthDate);
    const monthsDiff =
      (now.getFullYear() - birth.getFullYear()) * 12 +
      (now.getMonth() - birth.getMonth());

    if (monthsDiff < PUPPY_KITTEN_MAX_MONTHS) return 'PUPPY_KITTEN';
    if (monthsDiff >= SENIOR_MIN_MONTHS) return 'SENIOR';
    return 'ADULT';
  }

  /**
   * Compute size class (dogs only)
   */
  private computeSizeClass(petTypeSlug: string, weightKg: any): string | null {
    if (petTypeSlug !== 'dog' || !weightKg) return null;

    const weight = Number(weightKg);

    if (weight < DOG_SMALL_MAX_KG) return 'SMALL';
    if (weight <= DOG_MEDIUM_MAX_KG) return 'MEDIUM';
    return 'LARGE';
  }
}