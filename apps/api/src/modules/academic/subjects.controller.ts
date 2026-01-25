import { Body, Controller, Get, Post, Query, UseGuards, Request } from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { SubjectsService } from './subjects.service';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('subjects')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubjectsController {
  constructor(
    private readonly subjectsService: SubjectsService,
    private readonly prisma: PrismaService,
  ) {}

  // Helper para obtener institutionId del usuario
  private async resolveInstitutionId(req: any, queryInstitutionId?: string): Promise<string | undefined> {
    let instId = queryInstitutionId || req.user?.institutionId;
    if (!instId && req.user?.id) {
      const institutionUser = await this.prisma.institutionUser.findFirst({
        where: { userId: req.user.id },
        select: { institutionId: true }
      });
      instId = institutionUser?.institutionId;
    }
    return instId;
  }

  @Post()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  async create(@Body() dto: CreateSubjectDto) {
    return this.subjectsService.create(dto);
  }

  @Get()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async list(
    @Request() req: any,
    @Query('areaId') areaId?: string,
    @Query('institutionId') institutionId?: string,
  ) {
    const instId = await this.resolveInstitutionId(req, institutionId);
    return this.subjectsService.list({ areaId, institutionId: instId });
  }
}
