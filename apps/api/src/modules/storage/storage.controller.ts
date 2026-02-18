import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  BadRequestException,
  UseGuards,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SupabaseStorageService } from './supabase-storage.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('storage')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StorageController {
  constructor(
    private readonly storageService: SupabaseStorageService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('upload/gallery')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  @UseInterceptors(FileInterceptor('file'))
  async uploadGalleryImage(
    @UploadedFile() file: Express.Multer.File,
    @Body('institutionId') institutionId: string,
    @Body('category') category?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No se proporcionó ningún archivo');
    }
    if (!institutionId) {
      throw new BadRequestException('Se requiere institutionId');
    }

    const result = await this.storageService.uploadGalleryImage(
      institutionId,
      file,
      category,
    );

    // Generar URL firmada para mostrar inmediatamente después de subir
    let signedUrl = result.url;
    if (result.path && !result.path.startsWith('http')) {
      try {
        signedUrl = await this.storageService.resolveFileUrl(result.path, 3600);
      } catch { /* usar url original */ }
    }

    return {
      success: true,
      data: {
        ...result,
        url: signedUrl, // URL firmada para mostrar inmediatamente
        path: result.path, // Key para guardar en DB
      },
    };
  }

  @Post('upload/announcement')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAnnouncementImage(
    @UploadedFile() file: Express.Multer.File,
    @Body('institutionId') institutionId: string,
  ) {
    if (!file) {
      throw new BadRequestException('No se proporcionó ningún archivo');
    }
    if (!institutionId) {
      throw new BadRequestException('Se requiere institutionId');
    }

    // Usar el bucket de galería para anuncios también (son públicos)
    const result = await this.storageService.uploadGalleryImage(
      institutionId,
      file,
      'announcements',
    );

    // Generar URL firmada para mostrar inmediatamente después de subir
    let signedUrl = result.url;
    if (result.path && !result.path.startsWith('http')) {
      try {
        signedUrl = await this.storageService.resolveFileUrl(result.path, 3600);
      } catch { /* usar url original */ }
    }

    return {
      success: true,
      data: {
        ...result,
        url: signedUrl,
        path: result.path,
      },
    };
  }

  @Post('upload/signature')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  @UseInterceptors(FileInterceptor('file'))
  async uploadSignatureImage(
    @UploadedFile() file: Express.Multer.File,
    @Request() req,
    @Body('role') role: string,
  ) {
    if (!file) {
      throw new BadRequestException('No se proporcionó ningún archivo');
    }
    if (!role) {
      throw new BadRequestException('Se requiere el campo "role"');
    }

    const institutionId = req.user.institutionId;
    if (!institutionId) {
      throw new BadRequestException('No se pudo determinar la institución del usuario');
    }

    const result = await this.storageService.uploadSignatureImage(
      institutionId,
      role,
      file,
    );

    return {
      success: true,
      data: result,
    };
  }

  @Post('upload/my-signature')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  @UseInterceptors(FileInterceptor('file'))
  async uploadMySignature(
    @UploadedFile() file: Express.Multer.File,
    @Request() req,
  ) {
    if (!file) {
      throw new BadRequestException('No se proporcionó ningún archivo');
    }

    const institutionId = req.user.institutionId;
    if (!institutionId) {
      throw new BadRequestException('No se pudo determinar la institución del usuario');
    }

    const result = await this.storageService.uploadSignatureImage(
      institutionId,
      `user_${req.user.id}`,
      file,
    );

    const url = result?.url || result?.path || '';

    // Guardar URL en el perfil del usuario
    await this.prisma.user.update({
      where: { id: req.user.id },
      data: { signatureImageUrl: url },
    });

    return {
      success: true,
      data: { ...result, savedToProfile: true },
    };
  }
}
