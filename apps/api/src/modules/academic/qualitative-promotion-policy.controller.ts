import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { requireInstitutionId } from '../../common/utils/institution-resolver';
import { QualitativePromotionPolicyService, type QualitativePolicyInput } from './qualitative-promotion-policy.service';

@Controller('academic-years/:yearId/qualitative-promotion-policies')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QualitativePromotionPolicyController {
  constructor(private readonly policies: QualitativePromotionPolicyService, private readonly prisma: PrismaService) {}

  @Get()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'RECTOR', 'COORDINADOR')
  async history(@Req() req: any, @Param('yearId') yearId: string, @Query('institutionId') institutionId?: string) {
    return this.policies.history(await requireInstitutionId(this.prisma as any, req, institutionId), yearId);
  }

  @Post(':gradeId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'RECTOR')
  async revise(@Req() req: any, @Param('yearId') yearId: string, @Param('gradeId') gradeId: string,
    @Body() input: QualitativePolicyInput, @Query('institutionId') institutionId?: string) {
    return this.policies.revise(await requireInstitutionId(this.prisma as any, req, institutionId), yearId, gradeId, req.user.id, input);
  }
}
