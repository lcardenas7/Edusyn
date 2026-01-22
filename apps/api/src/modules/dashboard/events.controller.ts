import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { EventsService } from './events.service';

@Controller('events')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async create(@Body() data: any, @Req() req: any) {
    const institutionId = req.user.institutionId || data.institutionId;
    console.log('[EventsController] Creating event:', { 
      userInstitutionId: req.user.institutionId, 
      bodyInstitutionId: data.institutionId,
      finalInstitutionId: institutionId 
    });
    
    return this.eventsService.create({
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
    @Query('upcoming') upcoming?: string,
  ) {
    return this.eventsService.list(institutionId, onlyActive !== 'false', upcoming === 'true');
  }

  @Get('birthdays')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getBirthdays(@Query('institutionId') institutionId?: string) {
    return this.eventsService.getBirthdays(institutionId);
  }

  @Patch(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async update(@Param('id') id: string, @Body() data: any) {
    return this.eventsService.update(id, data);
  }

  @Delete(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async delete(@Param('id') id: string) {
    return this.eventsService.delete(id);
  }
}
