import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

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
}