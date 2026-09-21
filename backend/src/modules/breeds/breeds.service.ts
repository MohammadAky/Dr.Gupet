import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

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
}