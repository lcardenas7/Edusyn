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
    console.log('[InstitutionalDocuments] Creating document:', { dto, uploadedById, fileName: file?.originalname });
    
    // Validar archivo
    this.validateFile(file);
    
    // Verificar límite de almacenamiento
    await this.checkStorageLimit(dto.institutionId, file.size);
    
    // Subir archivo a Supabase
    console.log('[InstitutionalDocuments] Uploading to Supabase...');
    const uploadResult = await this.uploadDocument(dto.institutionId, file, dto.category);
    console.log('[InstitutionalDocuments] Upload result:', uploadResult);
    
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
      
      console.log('[InstitutionalDocuments] Document created:', document.id);
      
      // Actualizar uso de almacenamiento
      await this.updateStorageUsage(dto.institutionId, file.size);
      
      return document;
    } catch (error) {
      console.error('[InstitutionalDocuments] Error creating document in DB:', error);
      // Intentar eliminar el archivo subido si falla la BD
      try {
        await this.storageService.deleteFile('documentos', uploadResult.url);
      } catch (deleteError) {
        console.error('[InstitutionalDocuments] Error cleaning up file:', deleteError);
      }
      throw error;
    }
  }

  async findAll(institutionId: string, userRoles?: string[]) {
    console.log('[InstitutionalDocuments] findAll - institutionId:', institutionId, 'userRoles:', userRoles);
    
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
    
    console.log('[InstitutionalDocuments] Found documents:', documents.length);
    
    // Filtrar por visibilidad de rol si no es admin
    if (userRoles && !userRoles.some(r => ['SUPERADMIN', 'ADMIN_INSTITUTIONAL'].includes(r))) {
      return documents.filter(doc => {
        if (doc.visibleToRoles.length === 0) return true; // Visible para todos
        return doc.visibleToRoles.some(role => userRoles.includes(role));
      });
    }
    
    return documents;
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
    
    return document;
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
    const document = await this.findOne(id);
    
    // Eliminar archivo de Supabase
    try {
      await this.storageService.deleteFile('documentos', document.fileUrl);
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
    
    const { data, error } = await (this.storageService as any).supabase.storage
      .from('documentos')
      .upload(path, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });
    
    if (error) {
      console.error('[InstitutionalDocuments] Upload error:', error);
      throw new BadRequestException(`Error al subir archivo: ${error.message}`);
    }
    
    // Obtener URL pública
    const { data: urlData } = (this.storageService as any).supabase.storage
      .from('documentos')
      .getPublicUrl(path);
    
    return {
      url: urlData.publicUrl,
      path,
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
    };
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
    console.log('[InstitutionalDocuments] Cleaning up orphaned files for institution:', institutionId);
    
    // 1. Obtener todos los documentos registrados en BD para esta institución
    const dbDocuments = await this.prisma.institutionalDocument.findMany({
      where: { institutionId },
      select: { fileUrl: true, fileSize: true },
    });
    
    console.log('[InstitutionalDocuments] Documents in DB:', dbDocuments.length);
    
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
      console.log('[InstitutionalDocuments] Scanning Supabase path:', basePath);
      
      const { data: folders, error: foldersError } = await (this.storageService as any).supabase.storage
        .from('documentos')
        .list(basePath);
      
      console.log('[InstitutionalDocuments] Folders found:', folders?.length || 0, folders?.map((f: any) => f.name));
      
      if (foldersError) {
        console.error('[InstitutionalDocuments] Error listing folders:', foldersError);
      } else if (folders && folders.length > 0) {
        // Iterar sobre cada carpeta de categoría
        for (const folder of folders) {
          if (folder.name && folder.id) { // folder.id indica que es una carpeta
            const categoryPath = `${basePath}/${folder.name}`;
            console.log('[InstitutionalDocuments] Scanning category:', categoryPath);
            
            const { data: files, error: filesError } = await (this.storageService as any).supabase.storage
              .from('documentos')
              .list(categoryPath);
            
            console.log('[InstitutionalDocuments] Files in', folder.name, ':', files?.length || 0);
            
            if (!filesError && files) {
              for (const file of files) {
                if (file.name && !file.name.startsWith('.') && !file.id) { // !file.id indica que es un archivo, no carpeta
                  const fullPath = `${categoryPath}/${file.name}`;
                  allStorageFiles.push(fullPath);
                  // Si el archivo no está en la BD, es huérfano
                  if (!dbPaths.has(fullPath)) {
                    orphanedFiles.push(fullPath);
                    console.log('[InstitutionalDocuments] Orphaned file found:', fullPath);
                  }
                }
              }
            }
          }
        }
      }
      
      console.log('[InstitutionalDocuments] Total files in storage:', allStorageFiles.length);
      console.log('[InstitutionalDocuments] Orphaned files:', orphanedFiles.length);
      
    } catch (error) {
      console.error('[InstitutionalDocuments] Error scanning storage:', error);
    }
    
    // 3. Eliminar archivos huérfanos
    const deletedFiles: string[] = [];
    for (const filePath of orphanedFiles) {
      try {
        console.log('[InstitutionalDocuments] Deleting:', filePath);
        const { error } = await (this.storageService as any).supabase.storage
          .from('documentos')
          .remove([filePath]);
        
        if (!error) {
          deletedFiles.push(filePath);
          console.log('[InstitutionalDocuments] Deleted orphaned file:', filePath);
        }
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
    
    console.log('[InstitutionalDocuments] Cleanup complete:', {
      deletedFiles: deletedFiles.length,
      recalculatedUsage: totalSize,
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
    const document = await this.findOne(id);
    
    // Extraer el path del fileUrl (quitar la parte base de Supabase)
    // El fileUrl guardado es la URL pública, necesitamos extraer el path
    const urlParts = document.fileUrl.split('/storage/v1/object/public/documentos/');
    const path = urlParts.length > 1 ? urlParts[1] : document.fileUrl;
    
    try {
      const signedUrl = await this.storageService.getSignedUrl('documentos', path, 900); // 15 minutos
      return {
        url: signedUrl,
        expiresIn: 900,
      };
    } catch (error) {
      console.error('[InstitutionalDocuments] Error generating signed URL:', error);
      // Fallback: devolver la URL original (por si el bucket es público)
      return {
        url: document.fileUrl,
        expiresIn: 0,
      };
    }
  }
}
