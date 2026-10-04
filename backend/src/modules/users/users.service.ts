import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/filters/all-exceptions.filter';
import { normalizeFa } from '../../common/utils/normalize-fa.util';
import { normalizePhone } from '../../common/utils/phone.util';

const USER_SAFE_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  phone: true,
  avatar: true,
  role: true,
  status: true,
  isPhoneVerified: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get current user profile
   */
  async getProfile(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('کاربر یافت نشد');
    }

    return user;
  }

  /**
   * Update current user profile
   * Only firstName, lastName, avatar are editable
   */
  async updateProfile(
    userId: number,
    data: {
      firstName?: string;
      lastName?: string;
      avatar?: string;
    },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException('کاربر یافت نشد');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  // -------------------------------------------------------------------
  // Admin
  // -------------------------------------------------------------------

  /**
   * List users (admin): search by phone/name, filter by role/status
   */
  async findAllAdmin(query: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    status?: string;
  }) {
    const { page = 1, limit = 20, search, role, status } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      const term = normalizeFa(search);
      where.OR = [
        { phone: { contains: term, mode: 'insensitive' } },
        { firstName: { contains: term, mode: 'insensitive' } },
        { lastName: { contains: term, mode: 'insensitive' } },
      ];
    }
    if (role) where.role = role;
    if (status) where.status = status;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          ...USER_SAFE_SELECT,
          _count: {
            select: {
              orders: true,
              pets: true,
              addresses: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * User detail (admin): profile + pets + addresses + recent orders
   */
  async findOneAdmin(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        ...USER_SAFE_SELECT,
        pets: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            gender: true,
            birthDate: true,
            weightKg: true,
            isNeutered: true,
            petType: { select: { id: true, name: true } },
            breed: { select: { id: true, name: true } },
          },
        },
        addresses: {
          select: {
            id: true,
            title: true,
            receiverName: true,
            receiverPhone: true,
            province: true,
            city: true,
            fullAddress: true,
            postalCode: true,
            isDefault: true,
          },
        },
        orders: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            orderNumber: true,
            status: true,
            finalAmount: true,
            createdAt: true,
          },
        },
        _count: {
          select: { orders: true, pets: true, addresses: true, favorites: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('کاربر یافت نشد');
    }

    return user;
  }

  /**
   * Create user (admin): phone + role (+ optional name) — issue #10.
   * Phone is normalized to `09xxxxxxxxx` and must be unique.
   */
  async createByAdmin(data: {
    phone: string;
    role?: string;
    firstName?: string;
    lastName?: string;
  }) {
    // Single source of truth for phone normalization (common/utils/phone.util).
    const phone = normalizePhone(String(data.phone ?? ''));
    if (!phone) {
      throw new AppException('VALIDATION_ERROR', 'شماره موبایل معتبر نیست', 400);
    }

    const role = data.role ?? 'USER';
    if (!['USER', 'ADMIN'].includes(role)) {
      throw new AppException('VALIDATION_ERROR', 'نقش نامعتبر است', 400);
    }

    const existing = await this.prisma.user.findUnique({ where: { phone } });
    if (existing) {
      throw new AppException('CONFLICT', 'کاربری با این شماره موبایل وجود دارد', 409);
    }

    return this.prisma.user.create({
      data: {
        phone,
        role,
        firstName: data.firstName,
        lastName: data.lastName,
      },
      select: USER_SAFE_SELECT,
    });
  }

  /**
   * Update user (admin): profile fields, role and status
   */
  async updateByAdmin(
    id: number,
    data: {
      firstName?: string;
      lastName?: string;
      avatar?: string;
      role?: string;
      status?: string;
    },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('کاربر یافت نشد');
    }

    if (data.role != null && !['USER', 'ADMIN'].includes(data.role)) {
      throw new AppException('VALIDATION_ERROR', 'نقش نامعتبر است', 400);
    }
    if (data.status != null && !['ACTIVE', 'BLOCKED'].includes(data.status)) {
      throw new AppException('VALIDATION_ERROR', 'وضعیت نامعتبر است', 400);
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        avatar: data.avatar,
        role: data.role,
        status: data.status,
      },
      select: USER_SAFE_SELECT,
    });
  }

  /**
   * Soft-delete user (admin)
   */
  async softDeleteByAdmin(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('کاربر یافت نشد');
    }

    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'BLOCKED' },
    });

    return { deleted: true };
  }

  /**
   * Restore a soft-deleted user (admin)
   */
  async restoreByAdmin(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('کاربر یافت نشد');
    }
    if (!user.deletedAt) {
      throw new AppException('CONFLICT', 'کاربر حذف نشده است', 409);
    }

    return this.prisma.user.update({
      where: { id },
      data: { deletedAt: null, status: 'ACTIVE' },
      select: USER_SAFE_SELECT,
    });
  }
}
