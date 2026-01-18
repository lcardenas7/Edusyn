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
  }) {
    return this.prisma.galleryImage.create({
      data,
      include: { uploadedBy: true },
    });
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
  }>) {
    return this.prisma.galleryImage.update({
      where: { id },
      data,
      include: { uploadedBy: true },
    });
  }

  async delete(id: string) {
    return this.prisma.galleryImage.delete({ where: { id } });
  }
}
