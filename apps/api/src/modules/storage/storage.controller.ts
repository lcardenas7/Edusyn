import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SupabaseStorageService } from './supabase-storage.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('storage')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StorageController {
  constructor(private readonly storageService: SupabaseStorageService) {}

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

    return {
      success: true,
      data: result,
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

    return {
      success: true,
      data: result,
    };
  }
}
