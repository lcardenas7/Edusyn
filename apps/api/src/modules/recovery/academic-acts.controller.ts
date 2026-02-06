import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AcademicActsService } from './academic-acts.service';
import { PrismaService } from '../../prisma/prisma.service';
import { requireInstitutionId } from '../../common/utils/institution-resolver';

@Controller('academic-acts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AcademicActsController {
  constructor(
    private readonly academicActsService: AcademicActsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async create(@Body() data: any, @Req() req: any) {
    return this.academicActsService.create({
      ...data,
      createdById: req.user.id,
    });
  }

  @Get()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async findByInstitution(
    @Req() req: any,
    @Query('institutionId') institutionId?: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('actType') actType?: string,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.academicActsService.findByInstitution(instId, academicYearId, actType as any);
  }

  @Get('by-student/:studentEnrollmentId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async findByStudent(@Param('studentEnrollmentId') studentEnrollmentId: string) {
    return this.academicActsService.findByStudent(studentEnrollmentId);
  }

  @Patch(':id/approve')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  async approve(@Param('id') id: string, @Req() req: any) {
    return this.academicActsService.approve(id, req.user.id);
  }

  @Post('promotion')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async generatePromotionAct(@Body() data: any, @Req() req: any) {
    return this.academicActsService.generatePromotionAct({
      ...data,
      createdById: req.user.id,
    });
  }

  @Post('academic-council')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async generateAcademicCouncilAct(@Body() data: any, @Req() req: any) {
    return this.academicActsService.generateAcademicCouncilAct({
      ...data,
      createdById: req.user.id,
    });
  }
}
