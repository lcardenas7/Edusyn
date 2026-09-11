import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ApdAuditAction } from '@prisma/client';

@Injectable()
export class ApdAuditService {
  constructor(private readonly prisma: PrismaService) {}

  private assertInstitution(institutionId: string) {
    if (!institutionId) throw new NotFoundException('Institución no encontrada.');
  }

  async log(params: {
    institutionId: string;
    userId: string;
    action: ApdAuditAction;
    entityType: string;
    entityId: string;
    details?: any;
    ipAddress?: string;
  }) {
    this.assertInstitution(params.institutionId);
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

  async getByEntity(entityType: string, entityId: string, institutionId: string) {
    this.assertInstitution(institutionId);
    if (!entityType || !entityId) throw new NotFoundException('Recurso no encontrado.');
    return this.prisma.apdAuditLog.findMany({
      where: { institutionId, entityType, entityId },
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
    this.assertInstitution(institutionId);
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
