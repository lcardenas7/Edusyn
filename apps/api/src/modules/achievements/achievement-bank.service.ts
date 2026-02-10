import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AchievementBankService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Buscar logros en el banco con filtros
   */
  async search(params: {
    institutionId: string;
    userId: string;
    subjectId?: string;
    areaId?: string;
    gradeId?: string;
    achievementType?: string;
    performanceLevel?: string;
    category?: string;
    query?: string;
    page?: number;
    limit?: number;
  }) {
    const {
      institutionId,
      userId,
      subjectId,
      areaId,
      gradeId,
      achievementType,
      performanceLevel,
      category,
      query,
      page = 1,
      limit = 50,
    } = params;

    const where: any = {
      institutionId,
      OR: [
        { isShared: true },
        { createdById: userId },
      ],
    };

    if (subjectId) where.subjectId = subjectId;
    if (areaId) where.areaId = areaId;
    if (gradeId) where.gradeId = gradeId;
    if (achievementType) where.achievementType = achievementType;
    if (performanceLevel) where.performanceLevel = performanceLevel;
    if (category) where.category = category;

    if (query) {
      where.AND = [
        {
          OR: [
            { description: { contains: query, mode: 'insensitive' } },
            { tags: { contains: query, mode: 'insensitive' } },
            { category: { contains: query, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.achievementBank.findMany({
        where,
        include: {
          subject: { select: { id: true, name: true } },
          area: { select: { id: true, name: true } },
          grade: { select: { id: true, name: true, stage: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: [{ usageCount: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.achievementBank.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  /**
   * Obtener categorías disponibles para filtros
   */
  async getCategories(institutionId: string) {
    const results = await this.prisma.achievementBank.findMany({
      where: { institutionId, category: { not: null } },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });
    return results.map(r => r.category).filter(Boolean);
  }

  /**
   * Crear entrada en el banco de logros
   */
  async create(data: {
    institutionId: string;
    createdById: string;
    subjectId?: string;
    areaId?: string;
    gradeId?: string;
    description: string;
    achievementType?: string;
    performanceLevel?: string;
    category?: string;
    tags?: string;
    isShared?: boolean;
  }) {
    return this.prisma.achievementBank.create({
      data: {
        institutionId: data.institutionId,
        createdById: data.createdById,
        subjectId: data.subjectId || null,
        areaId: data.areaId || null,
        gradeId: data.gradeId || null,
        description: data.description,
        achievementType: (data.achievementType as any) || 'ACADEMIC',
        performanceLevel: (data.performanceLevel as any) || null,
        category: data.category || null,
        tags: data.tags || null,
        isShared: data.isShared ?? true,
      },
      include: {
        subject: { select: { id: true, name: true } },
        area: { select: { id: true, name: true } },
        grade: { select: { id: true, name: true, stage: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  /**
   * Crear múltiples entradas en el banco (bulk)
   */
  async bulkCreate(entries: Array<{
    institutionId: string;
    createdById: string;
    subjectId?: string;
    areaId?: string;
    gradeId?: string;
    description: string;
    achievementType?: string;
    performanceLevel?: string;
    category?: string;
    tags?: string;
    isShared?: boolean;
  }>) {
    const results = await Promise.all(
      entries.map(entry => this.create(entry)),
    );
    return { created: results.length, items: results };
  }

  /**
   * Actualizar entrada del banco
   */
  async update(id: string, userId: string, data: {
    description?: string;
    achievementType?: string;
    performanceLevel?: string;
    category?: string;
    tags?: string;
    isShared?: boolean;
    subjectId?: string;
    areaId?: string;
    gradeId?: string;
  }) {
    // Solo el autor puede editar
    const entry = await this.prisma.achievementBank.findUnique({ where: { id } });
    if (!entry || entry.createdById !== userId) {
      return null;
    }

    return this.prisma.achievementBank.update({
      where: { id },
      data: {
        description: data.description,
        achievementType: data.achievementType as any,
        performanceLevel: data.performanceLevel as any,
        category: data.category,
        tags: data.tags,
        isShared: data.isShared,
        subjectId: data.subjectId,
        areaId: data.areaId,
        gradeId: data.gradeId,
      },
      include: {
        subject: { select: { id: true, name: true } },
        area: { select: { id: true, name: true } },
        grade: { select: { id: true, name: true, stage: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  /**
   * Eliminar entrada del banco
   */
  async delete(id: string, userId: string, isAdmin: boolean) {
    const entry = await this.prisma.achievementBank.findUnique({ where: { id } });
    if (!entry) return null;
    // Solo el autor o un admin puede eliminar
    if (entry.createdById !== userId && !isAdmin) return null;

    await this.prisma.achievementBank.delete({ where: { id } });
    return { deleted: true };
  }

  /**
   * Incrementar contador de uso cuando se selecciona un logro del banco
   */
  async incrementUsage(id: string) {
    return this.prisma.achievementBank.update({
      where: { id },
      data: { usageCount: { increment: 1 } },
    });
  }
}
