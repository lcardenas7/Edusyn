import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AnnouncementsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    institutionId: string;
    title: string;
    content: string;
    imageUrl?: string;
    priority?: number;
    expiresAt?: Date;
    authorId: string;
    visibleToRoles?: string[];
  }) {
    return this.prisma.announcement.create({
      data: {
        institutionId: data.institutionId,
        title: data.title,
        content: data.content,
        imageUrl: data.imageUrl,
        priority: data.priority ?? 0,
        expiresAt: data.expiresAt,
        authorId: data.authorId,
        visibleToRoles: data.visibleToRoles || [],
      },
      include: { author: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
  }

  async list(institutionId?: string, onlyActive = true, limit?: number) {
    const now = new Date();
    return this.prisma.announcement.findMany({
      where: {
        institutionId,
        ...(onlyActive && {
          isActive: true,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        }),
      },
      include: { author: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: [{ priority: 'desc' }, { publishedAt: 'desc' }],
      ...(limit && { take: limit }),
    });
  }

  async update(id: string, data: Partial<{
    title: string;
    content: string;
    imageUrl: string;
    priority: number;
    isActive: boolean;
    expiresAt: Date;
    visibleToRoles: string[];
    institutionId: string;
  }>) {
    // Remove institutionId from update data - it should not be changed
    const { institutionId, ...updateData } = data as any;
    
    return this.prisma.announcement.update({
      where: { id },
      data: updateData,
      include: { author: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
  }

  async listForUser(institutionId: string, userRoles: string[]) {
    const now = new Date();
    const announcements = await this.prisma.announcement.findMany({
      where: {
        institutionId,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      include: { author: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: [{ priority: 'desc' }, { publishedAt: 'desc' }],
    });

    // Filtrar por roles visibles
    return announcements.filter(a => {
      if (!a.visibleToRoles || a.visibleToRoles.length === 0) return true;
      return a.visibleToRoles.some(role => userRoles.includes(role));
    });
  }

  async delete(id: string) {
    return this.prisma.announcement.delete({ where: { id } });
  }
}
