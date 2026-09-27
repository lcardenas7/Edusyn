import { Body, Controller, Get, Param, Post, Put, Request, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { requireInstitutionId } from '../../common/utils/institution-resolver';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ClassroomActor } from './classroom-tenant-access.service';
import { QuestionBankService } from './question-bank.service';
import type { BankCollectionInput, BankQuestionInput } from './question-bank.service';

@Controller('question-bank')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuestionBankController {
  constructor(private readonly service: QuestionBankService, private readonly prisma: PrismaService) {}

  private async actor(req: any): Promise<ClassroomActor> {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    const raw = req.user?.roles;
    const roles = Array.isArray(raw) ? raw.map((role: any) => typeof role === 'string' ? role : role?.role?.name || role?.name).filter(Boolean) : [];
    return { userId: req.user.id, institutionId, roles, isSuperAdmin: req.user?.isSuperAdmin === true };
  }

  @Get('classrooms/:classroomId')
  @Roles('DOCENTE')
  list(@Param('classroomId') classroomId: string, @Request() req: any) {
    return this.actor(req).then((actor) => this.service.list(actor, classroomId));
  }

  @Post('classrooms/:classroomId/collections')
  @Roles('DOCENTE')
  createCollection(@Param('classroomId') classroomId: string, @Body() body: BankCollectionInput, @Request() req: any) {
    return this.actor(req).then((actor) => this.service.createCollection(actor, classroomId, body));
  }

  @Put('classrooms/:classroomId/collections/:collectionId')
  @Roles('DOCENTE')
  updateCollection(@Param('classroomId') classroomId: string, @Param('collectionId') collectionId: string, @Body() body: BankCollectionInput, @Request() req: any) {
    return this.actor(req).then((actor) => this.service.updateCollection(actor, classroomId, collectionId, body));
  }

  @Post('classrooms/:classroomId/collections/:collectionId/questions')
  @Roles('DOCENTE')
  createQuestion(@Param('classroomId') classroomId: string, @Param('collectionId') collectionId: string, @Body() body: BankQuestionInput, @Request() req: any) {
    return this.actor(req).then((actor) => this.service.createQuestion(actor, classroomId, collectionId, body));
  }

  @Put('classrooms/:classroomId/collections/:collectionId/questions/:itemId')
  @Roles('DOCENTE')
  updateQuestion(@Param('classroomId') classroomId: string, @Param('collectionId') collectionId: string, @Param('itemId') itemId: string, @Body() body: BankQuestionInput, @Request() req: any) {
    return this.actor(req).then((actor) => this.service.updateQuestion(actor, classroomId, collectionId, itemId, body));
  }

  @Post('classrooms/:classroomId/collections/:collectionId/copy-to/:activityId')
  @Roles('DOCENTE')
  copyToActivity(@Param('classroomId') classroomId: string, @Param('collectionId') collectionId: string, @Param('activityId') activityId: string, @Request() req: any) {
    return this.actor(req).then((actor) => this.service.copyToActivity(actor, classroomId, collectionId, activityId));
  }
}
