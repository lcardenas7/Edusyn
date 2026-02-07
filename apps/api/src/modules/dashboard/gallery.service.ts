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
    return this.prisma.galleryImage.create({
      data: {
        ...data,
        visibleToRoles: data.visibleToRoles || [],
      },
      include: { uploadedBy: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
  }

  async list(institutionId?: string, category?: string, onlyActive = true, limit?: number) {
    return this.prisma.galleryImage.findMany({
      where: {
        institutionId,
        category,
        ...(onlyActive && { isActive: true }),
      },
      include: { uploadedBy: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
      ...(limit && { take: limit }),
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

    return images.filter(img => {
      if (!img.visibleToRoles || img.visibleToRoles.length === 0) return true;
      return img.visibleToRoles.some(role => userRoles.includes(role));
    });
  }

  async delete(id: string) {
    return this.prisma.galleryImage.delete({ where: { id } });
  }
}
