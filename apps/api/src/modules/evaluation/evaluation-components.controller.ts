import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateEvaluationComponentDto } from './dto/create-evaluation-component.dto';
import { EvaluationComponentsService } from './evaluation-components.service';
import { PrismaService } from '../../prisma/prisma.service';
import { requireInstitutionId } from '../../common/utils/institution-resolver';

@Controller('evaluation-components')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EvaluationComponentsController {
  constructor(
    private readonly evaluationComponentsService: EvaluationComponentsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async create(@Body() dto: CreateEvaluationComponentDto) {
    return this.evaluationComponentsService.create(dto);
  }

  @Get()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async list(@Request() req: any, @Query('institutionId') institutionId?: string) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.evaluationComponentsService.list(instId);
  }

  @Get('hierarchy')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getHierarchy(@Request() req: any, @Query('institutionId') institutionId?: string) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.evaluationComponentsService.getHierarchy(instId);
  }

  @Patch(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateEvaluationComponentDto>,
  ) {
    return this.evaluationComponentsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  async delete(@Param('id') id: string) {
    return this.evaluationComponentsService.delete(id);
  }
}
