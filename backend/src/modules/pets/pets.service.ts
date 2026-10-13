import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MAX_PETS_PER_USER } from '../../common/constants';
import { canonicalSpeciesSlug } from '../../common/utils/species.util';

@Injectable()
export class PetsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get all pets for current user with type, breed, and tags
   */
  async findAll(userId: number) {
    const pets = await this.prisma.pet.findMany({
      where: { userId, deletedAt: null },
      include: {
        petType: { select: { id: true, name: true, slug: true } },
        breed: { select: { id: true, name: true } },
        tags: {
          include: {
            tag: { select: { id: true, name: true, slug: true, type: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return pets.map((pet) => ({
      ...pet,
      lifeStage: this.computeLifeStage(pet.birthDate, pet.petType),
      tags: pet.tags.map((pt) => pt.tag),
    }));
  }

  /**
   * Get single pet by ID (ownership check)
   */
  async findOne(userId: number, petId: number) {
    const pet = await this.prisma.pet.findUnique({
      where: { id: petId, deletedAt: null },
      include: {
        petType: { select: { id: true, name: true, slug: true } },
        breed: { select: { id: true, name: true } },
        tags: {
          include: {
            tag: { select: { id: true, name: true, slug: true, type: true } },
          },
        },
      },
    });

    if (!pet || pet.userId !== userId) {
      throw new NotFoundException('حیوان یافت نشد');
    }

    return {
      ...pet,
      lifeStage: this.computeLifeStage(pet.birthDate, pet.petType),
      tags: pet.tags.map((pt) => pt.tag),
    };
  }

  /**
   * Create new pet
   */
  async create(userId: number, data: any) {
    // Check limit
    const count = await this.prisma.pet.count({
      where: { userId, deletedAt: null },
    });

    if (count >= MAX_PETS_PER_USER) {
      throw new ForbiddenException(`حداکثر ${MAX_PETS_PER_USER} حیوان مجاز است`);
    }

    // Validate pet type exists
    const petType = await this.prisma.petType.findUnique({
      where: { id: data.petTypeId },
    });

    if (!petType || !petType.isActive) {
      throw new BadRequestException('نوع حیوان معتبر نیست');
    }

    // Validate breed belongs to pet type (if provided)
    if (data.breedId) {
      const breed = await this.prisma.breed.findUnique({
        where: { id: data.breedId },
      });

      if (!breed || !breed.isActive || breed.petTypeId !== data.petTypeId) {
        throw new BadRequestException('نژاد معتبر نیست');
      }
    }

    // Validate birth date not in future
    if (data.birthDate && new Date(data.birthDate) > new Date()) {
      throw new BadRequestException('تاریخ تولد نمی‌تواند در آینده باشد');
    }

    // Validate weight
    if (data.weightKg !== undefined && data.weightKg !== null) {
      if (data.weightKg < 0.1 || data.weightKg > 200) {
        throw new BadRequestException('وزن باید بین ۰.۱ و ۲۰۰ کیلوگرم باشد');
      }
    }

    const pet = await this.prisma.pet.create({
      data: {
        userId,
        name: data.name,
        petTypeId: data.petTypeId,
        breedId: data.breedId || null,
        birthDate: data.birthDate ? new Date(data.birthDate) : null,
        gender: data.gender || null,
        isNeutered: data.isNeutered || false,
        weightKg: data.weightKg || null,
        photo: data.photo || null,
      },
      include: {
        petType: { select: { id: true, name: true, slug: true } },
        breed: { select: { id: true, name: true } },
      },
    });

    return {
      ...pet,
      lifeStage: this.computeLifeStage(pet.birthDate, pet.petType),
      tags: [],
    };
  }

  /**
   * Update pet (ownership check)
   */
  async update(userId: number, petId: number, data: any) {
    const pet = await this.prisma.pet.findUnique({
      where: { id: petId, deletedAt: null },
    });

    if (!pet || pet.userId !== userId) {
      throw new NotFoundException('حیوان یافت نشد');
    }

    const petTypeId = data.petTypeId === undefined ? pet.petTypeId : data.petTypeId;
    if (data.petTypeId !== undefined) {
      if (!Number.isInteger(petTypeId) || petTypeId <= 0) {
        throw new BadRequestException('نوع حیوان معتبر نیست');
      }
      const petType = await this.prisma.petType.findUnique({ where: { id: petTypeId } });
      if (!petType || !petType.isActive) {
        throw new BadRequestException('نوع حیوان معتبر نیست');
      }
    }
    // A breed must belong to the selected species, including when only it changes.
    if (data.breedId !== undefined && data.breedId !== null) {
      if (!Number.isInteger(data.breedId) || data.breedId <= 0) {
        throw new BadRequestException('نژاد معتبر نیست');
      }
      const breed = await this.prisma.breed.findUnique({
        where: { id: data.breedId },
      });

      if (!breed || !breed.isActive || breed.petTypeId !== petTypeId) {
        throw new BadRequestException('نژاد معتبر نیست');
      }
    }

    // Explicit null clears; an omitted field preserves the current value.
    const birthDate =
      data.birthDate === null
        ? null
        : data.birthDate === undefined
          ? undefined
          : new Date(data.birthDate);
    if (birthDate && !Number.isFinite(birthDate.getTime())) {
      throw new BadRequestException('تاریخ تولد معتبر نیست');
    }
    if (birthDate && birthDate > new Date()) {
      throw new BadRequestException('تاریخ تولد نمی‌تواند در آینده باشد');
    }

    // Validate weight
    if (data.weightKg !== undefined && data.weightKg !== null) {
      if (data.weightKg < 0.1 || data.weightKg > 200) {
        throw new BadRequestException('وزن باید بین ۰.۱ و ۲۰۰ کیلوگرم باشد');
      }
    }

    const updated = await this.prisma.pet.update({
      where: { id: petId },
      data: {
        ...data,
        // Changing species cannot retain a breed from the previous species.
        breedId: data.breedId === undefined && petTypeId !== pet.petTypeId ? null : data.breedId,
        birthDate,
      },
      include: {
        petType: { select: { id: true, name: true, slug: true } },
        breed: { select: { id: true, name: true } },
        tags: {
          include: {
            tag: { select: { id: true, name: true, slug: true, type: true } },
          },
        },
      },
    });

    return {
      ...updated,
      lifeStage: this.computeLifeStage(updated.birthDate, updated.petType),
      tags: updated.tags.map((pt) => pt.tag),
    };
  }

  /**
   * Replace all tags for a pet (in a transaction)
   */
  async setTags(
    userId: number,
    petId: number,
    data: { allergenTagIds: number[]; dietTagIds: number[] },
  ) {
    const pet = await this.prisma.pet.findUnique({
      where: { id: petId, deletedAt: null },
    });

    if (!pet || pet.userId !== userId) {
      throw new NotFoundException('حیوان یافت نشد');
    }

    // Validate all tag IDs exist with correct type
    if (data.allergenTagIds.length > 0) {
      const allergenTags = await this.prisma.tag.findMany({
        where: { id: { in: data.allergenTagIds }, type: 'ALLERGEN' },
      });

      if (allergenTags.length !== data.allergenTagIds.length) {
        throw new BadRequestException('یک یا چند برچسب آلرژن نامعتبر است');
      }
    }

    if (data.dietTagIds.length > 0) {
      const dietTags = await this.prisma.tag.findMany({
        where: { id: { in: data.dietTagIds }, type: 'DIET' },
      });

      if (dietTags.length !== data.dietTagIds.length) {
        throw new BadRequestException('یک یا چند برچسب رژیمی نامعتبر است');
      }
    }

    // Replace all tags in a transaction
    await this.prisma.$transaction(async (tx) => {
      // Delete existing tags
      await tx.petTag.deleteMany({
        where: { petId },
      });

      // Create new tags
      const tagData = [
        ...data.allergenTagIds.map((tagId) => ({ petId, tagId })),
        ...data.dietTagIds.map((tagId) => ({ petId, tagId })),
      ];

      if (tagData.length > 0) {
        await tx.petTag.createMany({
          data: tagData,
        });
      }
    });

    // Return updated pet with tags
    return this.findOne(userId, petId);
  }

  /**
   * Soft delete pet
   */
  async remove(userId: number, petId: number) {
    const pet = await this.prisma.pet.findUnique({
      where: { id: petId, deletedAt: null },
    });

    if (!pet || pet.userId !== userId) {
      throw new NotFoundException('حیوان یافت نشد');
    }

    await this.prisma.pet.update({
      where: { id: petId },
      data: { deletedAt: new Date() },
    });

    return { ok: true };
  }

  /**
   * Compute life stage from birth date
   */
  private computeLifeStage(
    birthDate: Date | null,
    petType?: { slug: string; name: string },
  ): string {
    const species = canonicalSpeciesSlug(petType?.slug ?? '', petType?.name);
    // The accepted age thresholds describe dogs/cats; other species require explicit policy.
    if (species !== 'dog' && species !== 'cat') return 'ALL';
    if (!birthDate) return 'ALL';

    const now = new Date();
    const birth = new Date(birthDate);
    const monthsDiff =
      (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());

    if (monthsDiff < 12) return 'PUPPY_KITTEN';
    if (monthsDiff >= 84) return 'SENIOR';
    return 'ADULT';
  }
}
