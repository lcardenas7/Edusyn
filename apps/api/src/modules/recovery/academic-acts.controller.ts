import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AcademicActsService } from './academic-acts.service';

@Controller('academic-acts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AcademicActsController {
  constructor(private readonly academicActsService: AcademicActsService) {}

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
    @Query('institutionId') institutionId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('actType') actType?: string,
  ) {
    return this.academicActsService.findByInstitution(institutionId, academicYearId, actType as any);
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
