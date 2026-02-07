import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { GalleryService } from './gallery.service';

@Controller('gallery')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GalleryController {
  constructor(private readonly galleryService: GalleryService) {}

  @Post()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async create(@Body() data: any, @Req() req: any) {
    const institutionId = req.user.institutionId || data.institutionId;
    
    return this.galleryService.create({
      ...data,
      institutionId,
      uploadedById: req.user.id,
    });
  }

  @Get()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async list(
    @Query('institutionId') institutionId?: string,
    @Query('category') category?: string,
    @Query('onlyActive') onlyActive?: string,
  ) {
    return this.galleryService.list(institutionId, category, onlyActive !== 'false');
  }

  @Patch(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async update(@Param('id') id: string, @Body() data: any) {
    return this.galleryService.update(id, data);
  }

  @Delete(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async delete(@Param('id') id: string) {
    return this.galleryService.delete(id);
  }
}
