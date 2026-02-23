import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ApdAuditAction } from '@prisma/client';

@Injectable()
export class ApdAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    institutionId: string;
    userId: string;
    action: ApdAuditAction;
    entityType: string;
    entityId: string;
    details?: any;
    ipAddress?: string;
  }) {
    return this.prisma.apdAuditLog.create({
      data: {
        institutionId: params.institutionId,
        userId: params.userId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        details: params.details || undefined,
        ipAddress: params.ipAddress || undefined,
      },
    });
  }

  async getByEntity(entityType: string, entityId: string) {
    return this.prisma.apdAuditLog.findMany({
      where: { entityType, entityId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getByInstitution(institutionId: string, options?: {
    action?: ApdAuditAction;
    limit?: number;
    offset?: number;
  }) {
    return this.prisma.apdAuditLog.findMany({
      where: {
        institutionId,
        ...(options?.action && { action: options.action }),
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 50,
      skip: options?.offset || 0,
    });
  }
}
