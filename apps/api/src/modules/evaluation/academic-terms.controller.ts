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
import { AcademicTermsService } from './academic-terms.service';
import { CreateAcademicTermDto } from './dto/create-academic-term.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { requireInstitutionId } from '../../common/utils/institution-resolver';

@Controller('academic-terms')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AcademicTermsController {
  constructor(
    private readonly academicTermsService: AcademicTermsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('years')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async listYears(@Request() req: any, @Query('institutionId') institutionId?: string) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.academicTermsService.listYears(instId);
  }

  @Post('years')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  async createYear(@Body() data: { institutionId: string; year: number; startDate?: Date; endDate?: Date }) {
    return this.academicTermsService.createYear(data);
  }

  @Post()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async create(@Body() dto: CreateAcademicTermDto) {
    return this.academicTermsService.create(dto);
  }

  @Get()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async list(@Query('academicYearId') academicYearId: string) {
    return this.academicTermsService.list(academicYearId);
  }

  @Get('validate-weights')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async validateWeights(@Query('academicYearId') academicYearId: string) {
    return this.academicTermsService.validateWeights(academicYearId);
  }

  @Patch(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateAcademicTermDto>,
  ) {
    return this.academicTermsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  async delete(@Param('id') id: string) {
    return this.academicTermsService.delete(id);
  }
}
