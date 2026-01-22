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
      include: { author: true },
    });
  }

  async list(institutionId?: string, onlyActive = true) {
    const now = new Date();
    return this.prisma.announcement.findMany({
      where: {
        institutionId,
        ...(onlyActive && {
          isActive: true,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        }),
      },
      include: { author: true },
      orderBy: [{ priority: 'desc' }, { publishedAt: 'desc' }],
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
  }>) {
    return this.prisma.announcement.update({
      where: { id },
      data,
      include: { author: true },
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
      include: { author: true },
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
