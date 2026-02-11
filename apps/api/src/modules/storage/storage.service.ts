import { Injectable, Logger } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface StorageUploadResult {
  key: string;
  url: string;
  size: number;
  mimeType: string;
}

/**
 * Servicio de almacenamiento genérico basado en Cloudflare R2 (S3-compatible).
 *
 * Si mañana se cambia R2 por S3, MinIO u otro proveedor S3-compatible,
 * solo se modifican las variables de entorno. Ningún módulo funcional se toca.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private client: S3Client | null = null;
  private bucket: string;
  private publicBaseUrl: string | null = null;

  constructor() {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    this.bucket = process.env.R2_BUCKET || 'edusyn-files';

    if (!accountId || !accessKeyId || !secretAccessKey) {
      this.logger.warn(
        'R2 credentials not configured (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY). Storage disabled.',
      );
      return;
    }

    const endpoint =
      process.env.R2_ENDPOINT ||
      `https://${accountId}.r2.cloudflarestorage.com`;

    this.client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    // URL base pública (si se configura un dominio custom o R2 public bucket)
    this.publicBaseUrl = process.env.R2_PUBLIC_URL || null;

    this.logger.log(`Initialized with bucket "${this.bucket}" → ${endpoint}`);
  }

  isConfigured(): boolean {
    return !!this.client;
  }

  /**
   * Sube un archivo al bucket.
   * @param key - Ruta dentro del bucket (ej: "observador/inst123/2026/02/evidence.pdf")
   * @param body - Buffer o stream del archivo
   * @param contentType - MIME type
   * @returns Resultado con key y URL (firmada o pública)
   */
  async upload(
    key: string,
    body: Buffer,
    contentType: string,
    options?: { upsert?: boolean },
  ): Promise<StorageUploadResult> {
    this.ensureConfigured();

    await this.client!.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );

    // Si hay URL pública configurada, usarla; sino, generar URL firmada corta
    const url = this.publicBaseUrl
      ? `${this.publicBaseUrl}/${key}`
      : await this.getSignedUrl(key, 600);

    return {
      key,
      url,
      size: body.length,
      mimeType: contentType,
    };
  }

  /**
   * Genera una URL firmada (temporal) para descargar un archivo.
   * @param key - Ruta del archivo dentro del bucket
   * @param expiresIn - Segundos de validez (default: 600 = 10min)
   */
  async getSignedUrl(key: string, expiresIn = 600): Promise<string> {
    this.ensureConfigured();

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.client!, command, { expiresIn });
  }

  /**
   * Devuelve la URL pública si el bucket tiene acceso público configurado.
   * Caso contrario, genera una URL firmada.
   */
  async getUrl(key: string, expiresIn = 600): Promise<string> {
    if (this.publicBaseUrl) {
      return `${this.publicBaseUrl}/${key}`;
    }
    return this.getSignedUrl(key, expiresIn);
  }

  /**
   * Elimina un archivo del bucket.
   */
  async delete(key: string): Promise<void> {
    this.ensureConfigured();

    await this.client!.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  /**
   * Elimina múltiples archivos del bucket.
   */
  async deleteMany(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    this.ensureConfigured();

    await this.client!.send(
      new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: {
          Objects: keys.map((k) => ({ Key: k })),
        },
      }),
    );
  }

  /**
   * Lista archivos bajo un prefijo (carpeta virtual).
   * @param prefix - Prefijo de la ruta (ej: "observador/inst123/")
   * @param maxKeys - Máximo de resultados (default: 100)
   */
  async listFiles(
    prefix: string,
    maxKeys = 100,
  ): Promise<Array<{ key: string; size: number; lastModified?: Date }>> {
    this.ensureConfigured();

    const response = await this.client!.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        MaxKeys: maxKeys,
      }),
    );

    return (response.Contents || []).map((obj) => ({
      key: obj.Key || '',
      size: obj.Size || 0,
      lastModified: obj.LastModified,
    }));
  }

  private ensureConfigured(): void {
    if (!this.client) {
      throw new Error(
        'StorageService not configured. Check R2 environment variables.',
      );
    }
  }
}
