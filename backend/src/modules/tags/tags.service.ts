import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TagType } from '@prisma/client';

@Injectable()
export class TagsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get tags filtered by type (ALLERGEN or DIET)
   */
  async findAll(type?: TagType) {
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
}