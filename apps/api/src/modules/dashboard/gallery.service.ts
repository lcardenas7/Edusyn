import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class GalleryService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    institutionId: string;
    title: string;
    description?: string;
    imageUrl: string;
    category?: string;
    uploadedById: string;
    visibleToRoles?: string[];
  }) {
    console.log('[GalleryService] Creating image with data:', data)
    try {
      const result = await this.prisma.galleryImage.create({
        data: {
          ...data,
          visibleToRoles: data.visibleToRoles || [],
        },
        include: { uploadedBy: true },
      });
      console.log('[GalleryService] Image created successfully:', result.id)
      return result
    } catch (error) {
      console.error('[GalleryService] Error creating image:', error)
      throw error
    }
  }

  async list(institutionId?: string, category?: string, onlyActive = true) {
    return this.prisma.galleryImage.findMany({
      where: {
        institutionId,
        category,
        ...(onlyActive && { isActive: true }),
      },
      include: { uploadedBy: true },
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    });
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
    console.log('[GalleryService] Updating image:', { id, data });
    try {
      // Remove institutionId from update data - it should not be changed
      const { institutionId, ...updateData } = data as any;
      
      const result = await this.prisma.galleryImage.update({
        where: { id },
        data: updateData,
        include: { uploadedBy: true },
      });
      console.log('[GalleryService] Image updated successfully:', result.id);
      return result;
    } catch (error) {
      console.error('[GalleryService] Error updating image:', error);
      throw error;
    }
  }

  async listForUser(institutionId: string, userRoles: string[], category?: string) {
    const images = await this.prisma.galleryImage.findMany({
      where: {
        institutionId,
        category,
        isActive: true,
      },
      include: { uploadedBy: true },
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    });

    return images.filter(img => {
      if (!img.visibleToRoles || img.visibleToRoles.length === 0) return true;
      return img.visibleToRoles.some(role => userRoles.includes(role));
    });
  }

  async delete(id: string) {
    return this.prisma.galleryImage.delete({ where: { id } });
  }
}
