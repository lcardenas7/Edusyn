import { Injectable, BadRequestException } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface UploadResult {
  url: string;
  path: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

@Injectable()
export class SupabaseStorageService {
  private supabase: SupabaseClient;
  private readonly buckets = {
    boletines: 'boletines',           // Boletines de notas (PDF)
    evidencias: 'evidencias',         // Evidencias académicas
    reportes: 'reportes',             // Reportes e informes (PIAR, actas)
    importaciones: 'importaciones',   // Archivos de carga masiva
    exportaciones: 'exportaciones',   // Archivos exportados
    perfiles: 'perfiles',             // Fotos de perfil (estudiantes, docentes)
    documentos: 'documentos',         // Documentos de estudiantes (RC, EPS, etc.)
    galeria: 'galeria',               // Imágenes del dashboard institucional
  };

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    // Usar SERVICE_ROLE_KEY (nombre estandarizado) con fallback a SERVICE_KEY (legacy)
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.warn('[SupabaseStorage] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured');
      return;
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    console.log('[SupabaseStorage] Initialized successfully');
  }

  private isConfigured(): boolean {
    return !!this.supabase;
  }

  /**
   * Sube un documento de estudiante
   * Ruta: institucion/{institutionId}/estudiantes/{studentId}/documentos/{fileName}
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
   * Ruta: institucion/{institutionId}/gallery/{fileName}
   */
  async uploadGalleryImage(
    institutionId: string,
    file: Express.Multer.File,
    category?: string,
  ): Promise<UploadResult> {
    if (!this.isConfigured()) {
      throw new BadRequestException('Storage no configurado');
    }

    this.validateFile(file, ['image/jpeg', 'image/png', 'image/webp'], 0.5); // Max 500KB

    const ext = this.getFileExtension(file.originalname);
    const categoryPath = category ? `${category}/` : '';
    const fileName = `img_${Date.now()}.${ext}`;
    const path = `institucion/${institutionId}/gallery/${categoryPath}${fileName}`;

    return this.uploadFile(this.buckets.galeria, path, file);
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
   * Sube el boletín final anual de un estudiante
   * Ruta: institucion/{institutionId}/estudiantes/{studentId}/boletin_final_{year}.pdf
   */
  async uploadFinalReportCard(
    institutionId: string,
    studentId: string,
    year: number,
    pdfBuffer: Buffer,
  ): Promise<UploadResult> {
    if (!this.isConfigured()) {
      throw new BadRequestException('Storage no configurado');
    }

    const fileName = `boletin_final_${year}.pdf`;
    const path = `institucion/${institutionId}/estudiantes/${studentId}/${fileName}`;

    const { data, error } = await this.supabase.storage
      .from(this.buckets.boletines)
      .upload(path, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true, // Sobrescribir si existe
      });

    if (error) {
      console.error('[SupabaseStorage] Upload error:', error);
      throw new BadRequestException(`Error al subir archivo: ${error.message}`);
    }

    const { data: urlData } = this.supabase.storage
      .from(this.buckets.boletines)
      .getPublicUrl(path);

    return {
      url: urlData.publicUrl,
      path: data.path,
      fileName,
      fileSize: pdfBuffer.length,
      mimeType: 'application/pdf',
    };
  }

  /**
   * Obtiene una URL firmada (temporal) para acceso privado
   */
  async getSignedUrl(bucket: string, path: string, expiresIn = 3600): Promise<string> {
    if (!this.isConfigured()) {
      throw new BadRequestException('Storage no configurado');
    }

    const { data, error } = await this.supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);

    if (error) {
      throw new BadRequestException(`Error al generar URL: ${error.message}`);
    }

    return data.signedUrl;
  }

  /**
   * Elimina un archivo
   */
  async deleteFile(bucket: string, path: string): Promise<void> {
    if (!this.isConfigured()) {
      throw new BadRequestException('Storage no configurado');
    }

    const { error } = await this.supabase.storage.from(bucket).remove([path]);

    if (error) {
      console.error('[SupabaseStorage] Delete error:', error);
      throw new BadRequestException(`Error al eliminar archivo: ${error.message}`);
    }
  }

  /**
   * Lista archivos en una ruta
   */
  async listFiles(bucket: string, path: string): Promise<any[]> {
    if (!this.isConfigured()) {
      return [];
    }

    const { data, error } = await this.supabase.storage.from(bucket).list(path);

    if (error) {
      console.error('[SupabaseStorage] List error:', error);
      return [];
    }

    return data || [];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS PRIVADOS
  // ═══════════════════════════════════════════════════════════════════════════

  private async uploadFile(
    bucket: string,
    path: string,
    file: Express.Multer.File,
  ): Promise<UploadResult> {
    const { data, error } = await this.supabase.storage
      .from(bucket)
      .upload(path, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) {
      console.error('[SupabaseStorage] Upload error:', error);
      throw new BadRequestException(`Error al subir archivo: ${error.message}`);
    }

    const { data: urlData } = this.supabase.storage.from(bucket).getPublicUrl(path);

    return {
      url: urlData.publicUrl,
      path: data.path,
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
}
