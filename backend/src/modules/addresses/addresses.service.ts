import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MAX_ADDRESSES_PER_USER } from '../../common/constants';

@Injectable()
export class AddressesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get all addresses for current user (default first)
   */
  async findAll(userId: number) {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Create new address
   * First address becomes default automatically
   */
  async create(userId: number, data: any) {
    // Check limit
    const count = await this.prisma.address.count({ where: { userId } });
    if (count >= MAX_ADDRESSES_PER_USER) {
      throw new ForbiddenException(`حداکثر ${MAX_ADDRESSES_PER_USER} آدرس مجاز است`);
    }

    // First address becomes default
    const isFirst = count === 0;

    if (isFirst) {
      // Create as default
      return this.prisma.address.create({
        data: {
          ...data,
          userId,
          isDefault: true,
        },
      });
    }

    return this.prisma.address.create({
      data: {
        ...data,
        userId,
        isDefault: false,
      },
    });
  }

  /**
   * Update address (ownership check)
   */
  async update(userId: number, addressId: number, data: any) {
    const address = await this.prisma.address.findUnique({
      where: { id: addressId },
    });

    if (!address || address.userId !== userId) {
      throw new NotFoundException('آدرس یافت نشد');
    }

    return this.prisma.address.update({
      where: { id: addressId },
      data,
    });
  }

  /**
   * Set address as default (unset others in one transaction)
   */
  async setDefault(userId: number, addressId: number) {
    const address = await this.prisma.address.findUnique({
      where: { id: addressId },
    });

    if (!address || address.userId !== userId) {
      throw new NotFoundException('آدرس یافت نشد');
    }

    // Unset all defaults and set the new one in a transaction
    return this.prisma.$transaction(async (tx) => {
      // Unset all defaults for this user
      await tx.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });

      // Set the new default
      return tx.address.update({
        where: { id: addressId },
        data: { isDefault: true },
      });
    });
  }

  /**
   * Delete address
   * If it was default, promote the most recent remaining address
   */
  async remove(userId: number, addressId: number) {
    const address = await this.prisma.address.findUnique({
      where: { id: addressId },
    });

    if (!address || address.userId !== userId) {
      throw new NotFoundException('آدرس یافت نشد');
    }

    const wasDefault = address.isDefault;

    // Delete the address
    await this.prisma.address.delete({
      where: { id: addressId },
    });

    // If it was default and there are remaining addresses, promote the most recent
    if (wasDefault) {
      const mostRecent = await this.prisma.address.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      if (mostRecent) {
        await this.prisma.address.update({
          where: { id: mostRecent.id },
          data: { isDefault: true },
        });
      }
    }

    return { ok: true };
  }
}