import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SupabaseStorageService } from '../storage/supabase-storage.service';
import { InstitutionalDocumentCategory } from '@prisma/client';

export interface CreateDocumentDto {
  institutionId: string;
  title: string;
  description?: string;
  category: InstitutionalDocumentCategory;
  visibleToRoles?: string[];
}

export interface UpdateDocumentDto {
  title?: string;
  description?: string;
  category?: InstitutionalDocumentCategory;
  visibleToRoles?: string[];
  isActive?: boolean;
}

@Injectable()
export class InstitutionalDocumentsService {
  // Límite de tamaño por archivo: 10MB
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024;
  
  // Tipos MIME permitidos
  private readonly ALLOWED_MIME_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg',
    'image/png',
    'image/webp',
  ];

  constructor(
    private prisma: PrismaService,
    private storageService: SupabaseStorageService,
  ) {}

  async create(
    dto: CreateDocumentDto,
    file: Express.Multer.File,
    uploadedById: string,
  ) {
    // Validar archivo
    this.validateFile(file);
    
    // Verificar límite de almacenamiento
    await this.checkStorageLimit(dto.institutionId, file.size);
    
    // Subir archivo a Supabase
    const uploadResult = await this.uploadDocument(dto.institutionId, file, dto.category);
    
    // Crear registro en BD
    try {
      const document = await this.prisma.institutionalDocument.create({
        data: {
          institutionId: dto.institutionId,
          title: dto.title,
          description: dto.description,
          category: dto.category,
          fileUrl: uploadResult.url,
          fileName: uploadResult.fileName,
          fileSize: uploadResult.fileSize,
          mimeType: uploadResult.mimeType,
          visibleToRoles: dto.visibleToRoles || [],
          uploadedById,
        },
        include: {
          uploadedBy: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      });
      
      // Actualizar uso de almacenamiento
      await this.updateStorageUsage(dto.institutionId, file.size);
      
      return document;
    } catch (error) {
      console.error('[InstitutionalDocuments] Error creating document in DB:', error);
      // Intentar eliminar el archivo subido si falla la BD
      try {
        await this.storageService.deleteByKey(uploadResult.path);
      } catch (deleteError) {
        console.error('[InstitutionalDocuments] Error cleaning up file:', deleteError);
      }
      throw error;
    }
  }

  async findAll(institutionId: string, userRoles?: string[]) {
    const documents = await this.prisma.institutionalDocument.findMany({
      where: {
        institutionId,
        isActive: true,
      },
      include: {
        uploadedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: [
        { category: 'asc' },
        { createdAt: 'desc' },
      ],
    });
    
    // Filtrar por visibilidad de rol si no es admin
    let filtered = documents;
    if (userRoles && !userRoles.some(r => ['SUPERADMIN', 'ADMIN_INSTITUTIONAL'].includes(r))) {
      filtered = documents.filter(doc => {
        if (doc.visibleToRoles.length === 0) return true; // Visible para todos
        return doc.visibleToRoles.some(role => userRoles.includes(role));
      });
    }
    
    // Regenerar URLs firmadas frescas para los archivos
    return this.refreshFileUrls(filtered);
  }

  async findOne(id: string) {
    const document = await this.prisma.institutionalDocument.findUnique({
      where: { id },
      include: {
        uploadedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
    
    if (!document) {
      throw new NotFoundException('Documento no encontrado');
    }
    
    // Regenerar URL firmada fresca
    const freshUrl = await this.storageService.resolveFileUrl(document.fileUrl, 15 * 60);
    return { ...document, fileUrl: freshUrl };
  }

  /**
   * Regenera URLs firmadas frescas para los archivos de documentos.
   */
  private async refreshFileUrls<T extends { fileUrl: string }>(items: T[]): Promise<T[]> {
    return Promise.all(
      items.map(async (item) => {
        try {
          const freshUrl = await this.storageService.resolveFileUrl(item.fileUrl, 15 * 60);
          return { ...item, fileUrl: freshUrl };
        } catch {
          return item;
        }
      }),
    );
  }

  async update(id: string, dto: UpdateDocumentDto) {
    const document = await this.findOne(id);
    
    return this.prisma.institutionalDocument.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        category: dto.category,
        visibleToRoles: dto.visibleToRoles,
        isActive: dto.isActive,
      },
      include: {
        uploadedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async delete(id: string) {
    // Leer raw de la DB para obtener la key original (sin resolver URL)
    const document = await this.prisma.institutionalDocument.findUnique({
      where: { id },
      select: { id: true, fileUrl: true, fileSize: true, institutionId: true },
    });
    if (!document) throw new NotFoundException('Documento no encontrado');
    
    // Eliminar archivo de R2 — fileUrl ya es la key completa (ej: documentos/institucion/xxx/...)
    try {
      await this.storageService.deleteByKey(document.fileUrl);
    } catch (error) {
      console.error('[InstitutionalDocuments] Error deleting file:', error);
    }
    
    // Actualizar uso de almacenamiento
    await this.updateStorageUsage(document.institutionId, -document.fileSize);
    
    // Eliminar registro
    await this.prisma.institutionalDocument.delete({ where: { id } });
    
    return { success: true };
  }

  async getCategories() {
    return Object.values(InstitutionalDocumentCategory).map(category => ({
      value: category,
      label: this.getCategoryLabel(category),
    }));
  }

  private getCategoryLabel(category: InstitutionalDocumentCategory): string {
    const labels: Record<InstitutionalDocumentCategory, string> = {
      MANUAL: 'Manual',
      REGLAMENTO: 'Reglamento',
      FORMATO: 'Formato',
      CIRCULAR: 'Circular',
      PEI: 'PEI',
      SIEE: 'SIEE',
      OTRO: 'Otro',
    };
    return labels[category] || category;
  }

  private validateFile(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Archivo requerido');
    }
    
    if (file.size > this.MAX_FILE_SIZE) {
      throw new BadRequestException(`El archivo excede el límite de ${this.MAX_FILE_SIZE / 1024 / 1024}MB`);
    }
    
    if (!this.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Tipo de archivo no permitido');
    }
  }

  private async uploadDocument(
    institutionId: string,
    file: Express.Multer.File,
    category: InstitutionalDocumentCategory,
  ) {
    const ext = file.originalname.split('.').pop() || 'pdf';
    const fileName = `${category.toLowerCase()}_${Date.now()}.${ext}`;
    const path = `institucion/${institutionId}/institucionales/${category.toLowerCase()}/${fileName}`;

    return this.storageService.uploadGenericFile(
      this.storageService.buckets.documentos,
      path,
      file,
    );
  }

  private async checkStorageLimit(institutionId: string, fileSize: number) {
    const usage = await this.prisma.institutionStorageUsage.findUnique({
      where: { institutionId },
    });
    
    if (!usage) {
      // Crear registro de uso si no existe
      await this.prisma.institutionStorageUsage.create({
        data: { institutionId },
      });
      return;
    }
    
    const currentUsage = Number(usage.documentsUsage);
    const limit = Number(usage.documentsLimit);
    
    if (limit > 0 && currentUsage + fileSize > limit) {
      throw new ForbiddenException(
        `Límite de almacenamiento alcanzado. Uso: ${(currentUsage / 1024 / 1024).toFixed(2)}MB / ${(limit / 1024 / 1024).toFixed(2)}MB`
      );
    }
  }

  private async updateStorageUsage(institutionId: string, sizeChange: number) {
    await this.prisma.institutionStorageUsage.upsert({
      where: { institutionId },
      create: {
        institutionId,
        documentsUsage: BigInt(Math.max(0, sizeChange)),
      },
      update: {
        documentsUsage: {
          increment: BigInt(sizeChange),
        },
        lastCalculatedAt: new Date(),
      },
    });
  }

  async getStorageUsage(institutionId: string) {
    const usage = await this.prisma.institutionStorageUsage.findUnique({
      where: { institutionId },
    });
    
    if (!usage) {
      return {
        documentsUsage: 0,
        documentsLimit: 524288000,
        documentsUsagePercent: 0,
        evidencesUsage: 0,
        evidencesLimit: 1073741824,
        evidencesUsagePercent: 0,
      };
    }
    
    return {
      documentsUsage: Number(usage.documentsUsage),
      documentsLimit: Number(usage.documentsLimit),
      documentsUsagePercent: Number(usage.documentsLimit) > 0 
        ? (Number(usage.documentsUsage) / Number(usage.documentsLimit)) * 100 
        : 0,
      evidencesUsage: Number(usage.evidencesUsage),
      evidencesLimit: Number(usage.evidencesLimit),
      evidencesUsagePercent: Number(usage.evidencesLimit) > 0 
        ? (Number(usage.evidencesUsage) / Number(usage.evidencesLimit)) * 100 
        : 0,
    };
  }

  /**
   * Limpia archivos huérfanos de Supabase (archivos sin registro en BD)
   * y recalcula el uso de almacenamiento basado en los documentos reales
   */
  async cleanupOrphanedFiles(institutionId: string): Promise<{ 
    deletedFiles: string[]; 
    recalculatedUsage: number;
    message: string;
  }> {
    // 1. Obtener todos los documentos registrados en BD para esta institución
    const dbDocuments = await this.prisma.institutionalDocument.findMany({
      where: { institutionId },
      select: { fileUrl: true, fileSize: true },
    });
    
    // Extraer paths de los documentos en BD
    const dbPaths = new Set(
      dbDocuments.map(doc => {
        const urlParts = doc.fileUrl.split('/storage/v1/object/public/documentos/');
        return urlParts.length > 1 ? urlParts[1] : doc.fileUrl;
      })
    );
    
    // 2. Listar archivos en Supabase para esta institución
    const basePath = `institucion/${institutionId}/institucionales`;
    let orphanedFiles: string[] = [];
    let allStorageFiles: string[] = [];
    
    try {
      const folders = await this.storageService.listFiles(
        this.storageService.buckets.documentos,
        basePath,
      );
      
      if (folders && folders.length > 0) {
        for (const folder of folders) {
          const categoryPath = `${basePath}/${folder.name}`;
          const files = await this.storageService.listFiles(
            this.storageService.buckets.documentos,
            categoryPath,
          );
          
          if (files) {
            for (const file of files) {
              if (file.name && !file.name.startsWith('.')) {
                const fullPath = `${categoryPath}/${file.name}`;
                allStorageFiles.push(fullPath);
                if (!dbPaths.has(fullPath)) {
                  orphanedFiles.push(fullPath);
                }
              }
            }
          }
        }
      }
      
    } catch (error) {
      console.error('[InstitutionalDocuments] Error scanning storage:', error);
    }
    
    // 3. Eliminar archivos huérfanos
    const deletedFiles: string[] = [];
    for (const filePath of orphanedFiles) {
      try {
        await this.storageService.deleteFile(
          this.storageService.buckets.documentos,
          filePath,
        );
        deletedFiles.push(filePath);
      } catch (error) {
        console.error('[InstitutionalDocuments] Error deleting file:', filePath, error);
      }
    }
    
    // 4. Recalcular uso de almacenamiento basado en documentos reales
    const totalSize = dbDocuments.reduce((sum, doc) => sum + doc.fileSize, 0);
    
    await this.prisma.institutionStorageUsage.upsert({
      where: { institutionId },
      create: {
        institutionId,
        documentsUsage: BigInt(totalSize),
      },
      update: {
        documentsUsage: BigInt(totalSize),
        lastCalculatedAt: new Date(),
      },
    });
    
    
    return {
      deletedFiles,
      recalculatedUsage: totalSize,
      message: `Limpieza completada. ${deletedFiles.length} archivos huérfanos eliminados. Uso recalculado: ${(totalSize / 1024 / 1024).toFixed(2)} MB`,
    };
  }

  /**
   * Genera una URL firmada temporal para descargar/ver un documento
   * Esto es necesario porque el bucket 'documentos' no es público
   */
  async getDownloadUrl(id: string): Promise<{ url: string; expiresIn: number }> {
    // Leer directamente de la DB para obtener la key/url original sin resolver
    const document = await this.prisma.institutionalDocument.findUnique({
      where: { id },
      select: { fileUrl: true },
    });

    if (!document) {
      throw new NotFoundException('Documento no encontrado');
    }

    try {
      // resolveFileUrl maneja correctamente tanto keys de R2 como URLs antiguas de Supabase
      const signedUrl = await this.storageService.resolveFileUrl(document.fileUrl, 900);
      return {
        url: signedUrl,
        expiresIn: 900,
      };
    } catch (error) {
      console.error('[InstitutionalDocuments] Error generating signed URL:', error);
      return {
        url: document.fileUrl,
        expiresIn: 0,
      };
    }
  }
}
