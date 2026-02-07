import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AnnouncementsService } from './announcements.service';

@Controller('announcements')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Post()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async create(@Body() data: any, @Req() req: any) {
    // Use institutionId from authenticated user if available, otherwise from body
    const institutionId = req.user.institutionId || data.institutionId;
    
    return this.announcementsService.create({
      ...data,
      institutionId,
      authorId: req.user.id,
    });
  }

  @Get()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async list(
    @Query('institutionId') institutionId?: string,
    @Query('onlyActive') onlyActive?: string,
  ) {
    return this.announcementsService.list(institutionId, onlyActive !== 'false');
  }

  @Patch(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async update(@Param('id') id: string, @Body() data: any) {
    return this.announcementsService.update(id, data);
  }

  @Delete(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async delete(@Param('id') id: string) {
    return this.announcementsService.delete(id);
  }
}
