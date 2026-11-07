import { Body, Controller, Get, Param, Post, Req, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { requireInstitutionId } from '../../common/utils/institution-resolver';
import { PrismaService } from '../../prisma/prisma.service';
import { QualitativeYearAssessmentService } from './qualitative-year-assessment.service';

@Controller('qualitative-promotion/:enrollmentId')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QualitativePromotionDecisionController {
  constructor(private readonly assessment: QualitativeYearAssessmentService, private readonly prisma: PrismaService) {}

  @Get()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'RECTOR', 'COORDINADOR')
  async review(@Req() req: any, @Param('enrollmentId') enrollmentId: string, @Query('institutionId') institutionId?: string) {
    return this.assessment.assess(enrollmentId, await requireInstitutionId(this.prisma as any, req, institutionId));
  }

  @Post('confirm')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'RECTOR')
  async confirm(@Req() req: any, @Param('enrollmentId') enrollmentId: string,
    @Body() input: { reportText: string; reason: string; expectedFingerprint: string }, @Query('institutionId') institutionId?: string) {
    return this.assessment.confirm(enrollmentId, await requireInstitutionId(this.prisma as any, req, institutionId), req.user.id, input);
  }
}
