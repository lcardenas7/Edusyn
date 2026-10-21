import { Body, Controller, Get, Param, Post, Put, Request, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { requireInstitutionId } from '../../common/utils/institution-resolver';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ValidateTenantContextGuard } from '../../common/guards/validate-tenant-context.guard';
import { ClassroomActor } from './classroom-tenant-access.service';
import { QuestionBankService } from './question-bank.service';
import type { BankCollectionInput, BankQuestionInput } from './question-bank.service';

@Controller('question-bank')
@UseGuards(JwtAuthGuard, RolesGuard, ValidateTenantContextGuard)
export class QuestionBankController {
  constructor(private readonly service: QuestionBankService, private readonly prisma: PrismaService) {}

  private actor(req: any, institutionId: string): ClassroomActor {
    const raw = req.user?.roles;
    const roles = Array.isArray(raw) ? raw.map((role: any) => typeof role === 'string' ? role : role?.role?.name || role?.name).filter(Boolean) : [];
    return { userId: req.user.id, institutionId, roles, isSuperAdmin: req.user?.isSuperAdmin === true };
  }

  @Get('classrooms/:classroomId')
  @Roles('DOCENTE')
  async list(@Param('classroomId') classroomId: string, @Request() req: any) {
    const institutionId = await requireInstitutionId(this.prisma as any, req, req.query?.institutionId);
    return this.service.list(this.actor(req, institutionId), classroomId);
  }

  @Get('classrooms/:classroomId/official')
  @Roles('DOCENTE')
  async officialCatalog(@Param('classroomId') classroomId: string, @Request() req: any) {
    const institutionId = await requireInstitutionId(this.prisma as any, req, req.query?.institutionId);
    return this.service.officialCatalog(this.actor(req, institutionId), classroomId);
  }

  @Post('classrooms/:classroomId/official/:catalogId/import')
  @Roles('DOCENTE')
  async importOfficial(@Param('classroomId') classroomId: string, @Param('catalogId') catalogId: string, @Request() req: any) {
    const institutionId = await requireInstitutionId(this.prisma as any, req, req.query?.institutionId);
    return this.service.importOfficial(this.actor(req, institutionId), classroomId, catalogId);
  }

  @Post('classrooms/:classroomId/collections')
  @Roles('DOCENTE')
  async createCollection(@Param('classroomId') classroomId: string, @Body() body: BankCollectionInput, @Request() req: any) {
    const institutionId = await requireInstitutionId(this.prisma as any, req, req.query?.institutionId);
    return this.service.createCollection(this.actor(req, institutionId), classroomId, body);
  }

  @Put('classrooms/:classroomId/collections/:collectionId')
  @Roles('DOCENTE')
  async updateCollection(@Param('classroomId') classroomId: string, @Param('collectionId') collectionId: string, @Body() body: BankCollectionInput, @Request() req: any) {
    const institutionId = await requireInstitutionId(this.prisma as any, req, req.query?.institutionId);
    return this.service.updateCollection(this.actor(req, institutionId), classroomId, collectionId, body);
  }

  @Post('classrooms/:classroomId/collections/:collectionId/questions')
  @Roles('DOCENTE')
  async createQuestion(@Param('classroomId') classroomId: string, @Param('collectionId') collectionId: string, @Body() body: BankQuestionInput, @Request() req: any) {
    const institutionId = await requireInstitutionId(this.prisma as any, req, req.query?.institutionId);
    return this.service.createQuestion(this.actor(req, institutionId), classroomId, collectionId, body);
  }

  @Put('classrooms/:classroomId/collections/:collectionId/questions/:itemId')
  @Roles('DOCENTE')
  async updateQuestion(@Param('classroomId') classroomId: string, @Param('collectionId') collectionId: string, @Param('itemId') itemId: string, @Body() body: BankQuestionInput, @Request() req: any) {
    const institutionId = await requireInstitutionId(this.prisma as any, req, req.query?.institutionId);
    return this.service.updateQuestion(this.actor(req, institutionId), classroomId, collectionId, itemId, body);
  }

  @Post('classrooms/:classroomId/collections/:collectionId/copy-to/:activityId')
  @Roles('DOCENTE')
  copyToActivity(@Param('classroomId') classroomId: string, @Param('collectionId') collectionId: string, @Param('activityId') activityId: string, @Request() req: any) {
    return this.actor(req).then((actor) => this.service.copyToActivity(actor, classroomId, collectionId, activityId));
  }
}
