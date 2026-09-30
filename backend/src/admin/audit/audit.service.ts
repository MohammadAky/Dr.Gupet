import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditEntry {
  adminId: number;
  action: string;
  entity: string;
  entityId?: string | number;
  summary?: string;
  ip?: string;
}

/**
 * Records admin mutations. Auditing must never break the main operation,
 * so write failures are logged and swallowed.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  async record(entry: AuditEntry) {
    try {
      await this.prisma.adminAuditLog.create({
        data: {
          adminId: entry.adminId,
          action: entry.action,
          entity: entry.entity,
          entityId: entry.entityId != null ? String(entry.entityId) : null,
          summary: entry.summary,
          ip: entry.ip,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to write audit log: ${error}`);
    }
  }

  async findAll(query: {
    page?: number;
    limit?: number;
    entity?: string;
    action?: string;
    adminId?: number;
  }) {
    const { page = 1, limit = 20, entity, action, adminId } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (entity) where.entity = entity;
    if (action) where.action = action;
    if (adminId) where.adminId = adminId;

    const [logs, total] = await Promise.all([
      this.prisma.adminAuditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.adminAuditLog.count({ where }),
    ]);

    return {
      data: logs,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
