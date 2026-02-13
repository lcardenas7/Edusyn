import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SupabaseStorageService } from '../storage/supabase-storage.service';

@Injectable()
export class GalleryService {
  private readonly logger = new Logger(GalleryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: SupabaseStorageService,
  ) {}

  /**
   * Regenera URLs firmadas frescas para las imágenes de galería.
   */
  private async refreshImageUrls<T extends { imageUrl?: string | null }>(items: T[]): Promise<T[]> {
    return Promise.all(
      items.map(async (item) => {
        if (!item.imageUrl) return item;
        try {
          const freshUrl = await this.storage.resolveFileUrl(item.imageUrl);
          return { ...item, imageUrl: freshUrl };
        } catch (err) {
          this.logger.warn(`Failed to refresh image URL for gallery: ${err.message}`);
        }
        return item;
      }),
    );
  }

  async create(data: {
    institutionId: string;
    title: string;
    description?: string;
    imageUrl: string;
    category?: string;
    uploadedById: string;
    visibleToRoles?: string[];
  }) {
    return this.prisma.galleryImage.create({
      data: {
        ...data,
        visibleToRoles: data.visibleToRoles || [],
      },
      include: { uploadedBy: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
  }

  async list(institutionId?: string, category?: string, onlyActive = true, limit?: number) {
    const items = await this.prisma.galleryImage.findMany({
      where: {
        institutionId,
        category,
        ...(onlyActive && { isActive: true }),
      },
      include: { uploadedBy: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
      ...(limit && { take: limit }),
    });
    return this.refreshImageUrls(items);
  }

  async update(id: string, data: Partial<{
    title: string;
    description: string;
    imageUrl: string;
    category: string;
    isActive: boolean;
    order: number;
    visibleToRoles: string[];
    institutionId: string;
  }>) {
    // Remove institutionId from update data - it should not be changed
    const { institutionId, ...updateData } = data as any;
    
    return this.prisma.galleryImage.update({
      where: { id },
      data: updateData,
      include: { uploadedBy: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
  }

  async listForUser(institutionId: string, userRoles: string[], category?: string) {
    const images = await this.prisma.galleryImage.findMany({
      where: {
        institutionId,
        category,
        isActive: true,
      },
      include: { uploadedBy: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    });

    const filtered = images.filter(img => {
      if (!img.visibleToRoles || img.visibleToRoles.length === 0) return true;
      return img.visibleToRoles.some(role => userRoles.includes(role));
    });
    return this.refreshImageUrls(filtered);
  }

  async delete(id: string) {
    return this.prisma.galleryImage.delete({ where: { id } });
  }
}
