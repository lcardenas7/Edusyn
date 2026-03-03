import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { StorageService } from './storage.service';

export interface UploadResult {
  url: string;
  path: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

// Información de auditoría para tracking de archivos
export interface FileAuditInfo {
  bucket: string;
  path: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedBy?: string;      // userId que subió el archivo
  uploadedAt: Date;
  module: string;           // Módulo desde donde se subió (boletines, reportes, etc.)
  metadata?: Record<string, any>;
}

/**
 * Fachada de alto nivel que expone métodos de negocio para subir/descargar archivos.
 * Internamente delega a StorageService (Cloudflare R2).
 *
 * Los antiguos "buckets" de Supabase ahora son prefijos de carpeta dentro
 * del único bucket de R2 (ej: "boletines/...", "mensajes/...").
 */
@Injectable()
export class SupabaseStorageService {
  // Prefijos de carpeta (antes eran buckets separados en Supabase)
  readonly buckets = {
    boletines: 'boletines',
    evidencias: 'evidencias',
    reportes: 'reportes',
    importaciones: 'importaciones',
    exportaciones: 'exportaciones',
    perfiles: 'perfiles',
    documentos: 'documentos',
    galeria: 'galeria',
    mensajes: 'mensajes',
    firmas: 'firmas',
  };

  // Tiempos de expiración para URLs firmadas (en segundos)
  private readonly signedUrlExpiration = {
    boletines: 5 * 60,      // 5 minutos - muy sensible
    evidencias: 10 * 60,    // 10 minutos
    reportes: 10 * 60,      // 10 minutos
    documentos: 15 * 60,    // 15 minutos
    importaciones: 30 * 60, // 30 minutos (archivos de trabajo)
    exportaciones: 60 * 60, // 1 hora (descargas)
    perfiles: 600,           // 10 minutos (antes público)
    galeria: 600,            // 10 minutos (antes público)
    mensajes: 15 * 60,      // 15 minutos - adjuntos de mensajes
  };

  constructor(private readonly storage: StorageService) {}

  private isConfigured(): boolean {
    return this.storage.isConfigured();
  }

  /** Construye la key completa: bucket-prefix/path */
  private buildKey(bucket: string, path: string): string {
    return `${bucket}/${path}`;
  }

  /**
   * Sube un documento de estudiante
   * Ruta: documentos/institucion/{institutionId}/estudiantes/{studentId}/documentos/{fileName}
   */
  async uploadStudentDocument(
    institutionId: string,
    studentId: string,
    file: Express.Multer.File,
    documentType: string,
  ): Promise<UploadResult> {
    if (!this.isConfigured()) {
      throw new BadRequestException('Storage no configurado');
    }

    this.validateFile(file, ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'], 5);

    const ext = this.getFileExtension(file.originalname);
    const fileName = `${documentType}_${Date.now()}.${ext}`;
    const path = `institucion/${institutionId}/estudiantes/${studentId}/documentos/${fileName}`;

    return this.uploadFile(this.buckets.documentos, path, file);
  }

  /**
   * Sube una imagen para la galería del dashboard
   * Ruta: galeria/institucion/{institutionId}/gallery/{fileName}
   */
  async uploadGalleryImage(
    institutionId: string,
    file: Express.Multer.File,
    category?: string,
  ): Promise<UploadResult> {
    if (!this.isConfigured()) {
      throw new BadRequestException('Storage no configurado');
    }

    this.validateFile(file, ['image/jpeg', 'image/png', 'image/webp'], 2); // Max 2MB

    const ext = this.getFileExtension(file.originalname);
    const categoryPath = category ? `${category}/` : '';
    const fileName = `img_${Date.now()}.${ext}`;
    const path = `institucion/${institutionId}/gallery/${categoryPath}${fileName}`;

    return this.uploadFile(this.buckets.galeria, path, file);
  }

  /**
   * Tipos permitidos para materiales del aula virtual
   * PDF, Word, Excel, PowerPoint, imágenes. Máximo 10MB
   */
  static readonly CLASSROOM_ALLOWED_TYPES = [
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
  static readonly CLASSROOM_MAX_SIZE_MB = 10;

  /**
   * Sube un material para el aula virtual
   * Ruta: galeria/institucion/{institutionId}/classroom/{fileName}
   * Tipos: PDF, Word, Excel, PowerPoint, imágenes. Máximo 10MB
   */
  async uploadClassroomMaterial(
    institutionId: string,
    file: Express.Multer.File,
  ): Promise<UploadResult> {
    if (!this.isConfigured()) {
      throw new BadRequestException('Storage no configurado');
    }

    this.validateFile(
      file,
      SupabaseStorageService.CLASSROOM_ALLOWED_TYPES,
      SupabaseStorageService.CLASSROOM_MAX_SIZE_MB,
    );

    const ext = this.getFileExtension(file.originalname);
    const safeName = this.slugify(file.originalname.replace(/\.[^.]+$/, ''));
    const fileName = `${safeName}_${Date.now()}.${ext}`;
    const path = `institucion/${institutionId}/classroom/${fileName}`;

    return this.uploadFile(this.buckets.galeria, path, file);
  }

  /**
   * Sube un adjunto de mensaje/comunicación
   * Ruta: institucion/{institutionId}/mensajes/{messageId}/{fileName}
   * Tipos: PDF, Word, imágenes. Máximo 5MB
   */
  static readonly MESSAGE_ALLOWED_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/webp',
  ];
  static readonly MESSAGE_MAX_SIZE_MB = 5;
  static readonly MESSAGE_MAX_ATTACHMENTS = 3;

  async uploadMessageAttachment(
    institutionId: string,
    messageId: string,
    file: Express.Multer.File,
  ): Promise<UploadResult> {
    if (!this.isConfigured()) {
      throw new BadRequestException('Storage no configurado');
    }

    this.validateFile(
      file,
      SupabaseStorageService.MESSAGE_ALLOWED_TYPES,
      SupabaseStorageService.MESSAGE_MAX_SIZE_MB,
    );

    const ext = this.getFileExtension(file.originalname);
    const safeName = this.slugify(file.originalname.replace(/\.[^.]+$/, ''));
    const fileName = `${safeName}_${Date.now()}.${ext}`;
    const path = `institucion/${institutionId}/mensajes/${messageId}/${fileName}`;

    return this.uploadFile(this.buckets.mensajes, path, file);
  }

  /**
   * Elimina todos los adjuntos de un mensaje
   */
  async deleteMessageAttachments(institutionId: string, messageId: string): Promise<void> {
    if (!this.isConfigured()) return;

    const prefix = this.buildKey(
      this.buckets.mensajes,
      `institucion/${institutionId}/mensajes/${messageId}/`,
    );
    const files = await this.storage.listFiles(prefix);

    if (files.length > 0) {
      await this.storage.deleteMany(files.map((f) => f.key));
    }
  }

  /**
   * Sube un informe especial (PIAR, actas, diagnósticos)
   * Ruta: institucion/{institutionId}/informes/{year}/{fileName}
   */
  async uploadReport(
    institutionId: string,
    file: Express.Multer.File,
    reportType: string,
    year?: number,
  ): Promise<UploadResult> {
    if (!this.isConfigured()) {
      throw new BadRequestException('Storage no configurado');
    }

    this.validateFile(file, ['application/pdf'], 10);

    const ext = this.getFileExtension(file.originalname);
    const yearPath = year || new Date().getFullYear();
    const fileName = `${reportType}_${Date.now()}.${ext}`;
    const path = `institucion/${institutionId}/informes/${yearPath}/${fileName}`;

    return this.uploadFile(this.buckets.reportes, path, file);
  }

  /**
   * Sube el boletín de un estudiante
   * Estructura: boletines/{institutionId}/{year}/{gradeName}/{periodName}/{studentId}.pdf
   */
  async uploadReportCard(
    institutionId: string,
    studentId: string,
    year: number,
    gradeName: string,
    periodName: string,
    pdfBuffer: Buffer,
    uploadedBy?: string,
  ): Promise<UploadResult & { auditInfo: FileAuditInfo }> {
    if (!this.isConfigured()) {
      throw new BadRequestException('Storage no configurado');
    }

    const gradeSlug = this.slugify(gradeName);
    const periodSlug = this.slugify(periodName);
    const fileName = `${studentId}.pdf`;
    const path = `${institutionId}/${year}/${gradeSlug}/${periodSlug}/${fileName}`;
    const key = this.buildKey(this.buckets.boletines, path);

    await this.storage.upload(key, pdfBuffer, 'application/pdf');

    // Para boletines, usar URL firmada (contenido sensible)
    const signedUrl = await this.getSignedUrlForBucket(this.buckets.boletines, path);

    const auditInfo: FileAuditInfo = {
      bucket: this.buckets.boletines,
      path: key,
      fileName,
      fileSize: pdfBuffer.length,
      mimeType: 'application/pdf',
      uploadedBy,
      uploadedAt: new Date(),
      module: 'boletines',
      metadata: { year, gradeName, periodName, studentId, institutionId },
    };

    return {
      url: signedUrl,
      path: key,
      fileName,
      fileSize: pdfBuffer.length,
      mimeType: 'application/pdf',
      auditInfo,
    };
  }

  /**
   * Sube el boletín final anual de un estudiante (legacy - mantener compatibilidad)
   */
  async uploadFinalReportCard(
    institutionId: string,
    studentId: string,
    year: number,
    pdfBuffer: Buffer,
  ): Promise<UploadResult> {
    const result = await this.uploadReportCard(
      institutionId,
      studentId,
      year,
      'final',
      'anual',
      pdfBuffer,
    );
    return result;
  }

  /**
   * Resuelve una URL/key almacenada en la DB a una URL firmada fresca.
   * Maneja 3 casos:
   *  1. Key directa (ej: "galeria/institucion/xxx/gallery/img.jpg") → genera signed URL
   *  2. URL firmada expirada de R2 → extrae key y genera signed URL fresca
   *  3. URL pública (http sin firma) → la devuelve tal cual
   *
   * @param storedValue - El valor de fileUrl/imageUrl almacenado en la DB
   * @param expiresIn - Segundos de validez (default: 600 = 10min)
   */
  async resolveFileUrl(storedValue: string, expiresIn = 600): Promise<string> {
    if (!this.isConfigured() || !storedValue) return storedValue;

    try {
      // Caso 1: Es una key directa (no empieza con http)
      if (!storedValue.startsWith('http')) {
        return this.storage.getSignedUrl(storedValue, expiresIn);
      }

      // Caso 2: URL firmada de R2 (contiene X-Amz- params)
      if (storedValue.includes('X-Amz-')) {
        const key = this.extractKeyFromSignedUrl(storedValue);
        if (key) {
          return this.storage.getSignedUrl(key, expiresIn);
        }
      }

      // Caso 3: URL pública o externa → devolver tal cual
      return storedValue;
    } catch {
      return storedValue;
    }
  }

  /**
   * Extrae la key del archivo desde una URL firmada de R2.
   * URL: https://xxx.r2.cloudflarestorage.com/edusyn-files/galeria/institucion/xxx/img.jpg?X-Amz-...
   * Key: galeria/institucion/xxx/img.jpg
   */
  private extractKeyFromSignedUrl(signedUrl: string): string | null {
    try {
      const url = new URL(signedUrl);
      const path = decodeURIComponent(url.pathname);
      // Quitar /bucket-name/ del inicio → la key es todo lo que sigue
      const parts = path.split('/').filter(Boolean);
      if (parts.length > 1) {
        return parts.slice(1).join('/');
      }
    } catch {
      // URL inválida
    }
    return null;
  }

  /**
   * Obtiene una URL firmada con tiempo de expiración según el bucket
   * Usa tiempos cortos para contenido sensible (boletines: 5min, reportes: 10min)
   */
  async getSignedUrlForBucket(bucket: string, path: string): Promise<string> {
    if (!this.isConfigured()) {
      throw new BadRequestException('Storage no configurado');
    }

    const expiresIn =
      this.signedUrlExpiration[bucket as keyof typeof this.signedUrlExpiration] || 600;
    const key = this.buildKey(bucket, path);

    return this.storage.getSignedUrl(key, expiresIn);
  }

  /**
   * Obtiene una URL firmada (temporal) para acceso privado
   * @param expiresIn - Tiempo en segundos (default: 10 minutos)
   */
  async getSignedUrl(bucket: string, path: string, expiresIn = 600): Promise<string> {
    if (!this.isConfigured()) {
      throw new BadRequestException('Storage no configurado');
    }

    const key = this.buildKey(bucket, path);
    return this.storage.getSignedUrl(key, expiresIn);
  }

  /**
   * Genera URL de descarga para boletín (con expiración corta de 5 min)
   */
  async getReportCardDownloadUrl(
    institutionId: string,
    year: number,
    gradeName: string,
    periodName: string,
    studentId: string,
  ): Promise<string> {
    const gradeSlug = this.slugify(gradeName);
    const periodSlug = this.slugify(periodName);
    const path = `${institutionId}/${year}/${gradeSlug}/${periodSlug}/${studentId}.pdf`;

    return this.getSignedUrlForBucket(this.buckets.boletines, path);
  }

  /**
   * Elimina un archivo por bucket + path (agrega prefijo de bucket)
   */
  async deleteFile(bucket: string, path: string): Promise<void> {
    if (!this.isConfigured()) {
      throw new BadRequestException('Storage no configurado');
    }

    const key = this.buildKey(bucket, path);
    await this.storage.delete(key);
  }

  /**
   * Elimina un archivo por su key completa de R2 (sin agregar prefijo)
   */
  async deleteByKey(key: string): Promise<void> {
    if (!this.isConfigured()) {
      throw new BadRequestException('Storage no configurado');
    }
    await this.storage.delete(key);
  }

  /**
   * Lista archivos en una ruta
   */
  async listFiles(bucket: string, path: string): Promise<any[]> {
    if (!this.isConfigured()) {
      return [];
    }

    const prefix = this.buildKey(bucket, path);
    const files = await this.storage.listFiles(prefix);

    // Compatibilidad: devolver con propiedad "name" como lo hacía Supabase
    return files.map((f) => ({
      name: f.key.split('/').pop() || f.key,
      key: f.key,
      size: f.size,
      lastModified: f.lastModified,
    }));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UPLOAD GENÉRICO (para módulos que necesitan subir a cualquier bucket/path)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Método genérico para subir un archivo a cualquier bucket/prefijo.
   * Usado por módulos que manejan rutas custom (documentos institucionales, tareas, etc.)
   */
  async uploadGenericFile(
    bucket: string,
    path: string,
    file: Express.Multer.File,
  ): Promise<UploadResult> {
    if (!this.isConfigured()) {
      throw new BadRequestException('Storage no configurado');
    }
    return this.uploadFile(bucket, path, file);
  }

  /**
   * Método genérico para subir un Buffer a cualquier bucket/prefijo.
   */
  async uploadGenericBuffer(
    bucket: string,
    path: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<UploadResult> {
    if (!this.isConfigured()) {
      throw new BadRequestException('Storage no configurado');
    }
    const key = this.buildKey(bucket, path);
    const result = await this.storage.upload(key, buffer, contentType);
    return {
      url: result.url,
      path: result.key,
      fileName: path.split('/').pop() || path,
      fileSize: buffer.length,
      mimeType: contentType,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FIRMAS (imágenes de firma para boletines)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Sube una imagen de firma (rector, coordinador, docente/tutor)
   * Ruta: firmas/institucion/{institutionId}/{role}_{timestamp}.{ext}
   * Max 200KB, solo PNG/JPG
   */
  async uploadSignatureImage(
    institutionId: string,
    role: string,
    file: Express.Multer.File,
  ): Promise<UploadResult> {
    if (!this.isConfigured()) {
      throw new BadRequestException('Storage no configurado');
    }

    this.validateFile(file, ['image/jpeg', 'image/png'], 0.2); // Max 200KB

    const ext = this.getFileExtension(file.originalname);
    const safeRole = this.slugify(role);
    const fileName = `${safeRole}_${Date.now()}.${ext}`;
    const path = `institucion/${institutionId}/${fileName}`;

    return this.uploadFile(this.buckets.firmas, path, file);
  }

  /**
   * Obtiene URL firmada para una imagen de firma
   */
  async getSignatureUrl(key: string): Promise<string> {
    if (!this.isConfigured()) {
      throw new BadRequestException('Storage no configurado');
    }
    return this.storage.getUrl(key, 600); // 10 min
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS PRIVADOS
  // ═══════════════════════════════════════════════════════════════════════════

  private async uploadFile(
    bucket: string,
    path: string,
    file: Express.Multer.File,
  ): Promise<UploadResult> {
    const key = this.buildKey(bucket, path);
    const result = await this.storage.upload(key, file.buffer, file.mimetype);

    return {
      url: result.url,
      path: result.key,
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
    };
  }

  private validateFile(
    file: Express.Multer.File,
    allowedMimeTypes: string[],
    maxSizeMB: number,
  ): void {
    if (!file) {
      throw new BadRequestException('No se proporcionó archivo');
    }

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Tipo de archivo no permitido. Permitidos: ${allowedMimeTypes.join(', ')}`,
      );
    }

    const maxBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      throw new BadRequestException(`El archivo excede el tamaño máximo de ${maxSizeMB}MB`);
    }
  }

  private getFileExtension(filename: string): string {
    return filename.split('.').pop()?.toLowerCase() || 'bin';
  }

  /**
   * Convierte texto a slug (URL-friendly)
   * "Grado 9°" -> "grado-9"
   * "Período 1" -> "periodo-1"
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
      .replace(/[°º]/g, '')            // Quitar símbolos de grado
      .replace(/[^a-z0-9]+/g, '-')     // Reemplazar no-alfanuméricos por guión
      .replace(/^-+|-+$/g, '')         // Quitar guiones al inicio/final
      .substring(0, 50);               // Limitar longitud
  }
}
