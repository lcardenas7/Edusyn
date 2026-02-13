import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SupabaseStorageService } from '../storage/supabase-storage.service';

@Injectable()
export class AnnouncementsService {
  private readonly logger = new Logger(AnnouncementsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: SupabaseStorageService,
  ) {}

  /**
   * Regenera URLs firmadas frescas para las imágenes de anuncios.
   * Las URLs firmadas de R2 expiran, así que se regeneran al servir datos.
   */
  private async refreshImageUrls<T extends { imageUrl?: string | null }>(items: T[]): Promise<T[]> {
    return Promise.all(
      items.map(async (item) => {
        if (!item.imageUrl) return item;
        try {
          const freshUrl = await this.storage.resolveFileUrl(item.imageUrl);
          return { ...item, imageUrl: freshUrl };
        } catch (err) {
          this.logger.warn(`Failed to refresh image URL for announcement: ${err.message}`);
        }
        return item;
      }),
    );
  }

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
    const items = await this.prisma.announcement.findMany({
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
    return this.refreshImageUrls(items);
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
    const filtered = announcements.filter(a => {
      if (!a.visibleToRoles || a.visibleToRoles.length === 0) return true;
      return a.visibleToRoles.some(role => userRoles.includes(role));
    });
    return this.refreshImageUrls(filtered);
  }

  async delete(id: string) {
    return this.prisma.announcement.delete({ where: { id } });
  }
}
