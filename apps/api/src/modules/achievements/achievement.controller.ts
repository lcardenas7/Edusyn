import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AchievementService } from './achievement.service';
import { AchievementConfigService } from './achievement-config.service';

@Controller('achievements')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AchievementController {
  constructor(
    private readonly achievementService: AchievementService,
    private readonly configService: AchievementConfigService,
  ) {}

  // ============================================
  // CONFIGURATION (Admin/Coordinator only)
  // ============================================

  @Get('config/:institutionId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getConfig(@Param('institutionId') institutionId: string) {
    try {
      return await this.configService.getConfig(institutionId);
    } catch (error) {
      console.error('[AchievementController] Error getting config:', error);
      throw error;
    }
  }

  @Put('config')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async upsertConfig(
    @Body()
    body: {
      institutionId: string;
      achievementsPerPeriod?: number;
      usePromotionalAchievement?: boolean;
      useAttitudinalAchievement?: boolean;
      attitudinalMode?: 'GENERAL_PER_PERIOD' | 'PER_ACADEMIC_ACHIEVEMENT';
      useValueJudgments?: boolean;
      displayMode?: 'SEPARATE' | 'COMBINED';
      displayFormat?: 'LIST' | 'PARAGRAPH';
      judgmentPosition?: 'END_OF_EACH' | 'END_OF_ALL' | 'NONE';
    },
  ) {
    try {
      console.log('[AchievementController] Upserting config for institution:', body.institutionId);
      return await this.configService.upsertConfig(body);
    } catch (error) {
      console.error('[AchievementController] Error upserting config:', error);
      throw error;
    }
  }

  @Get('config/:institutionId/templates')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async getValueJudgmentTemplates(@Param('institutionId') institutionId: string) {
    return this.configService.getValueJudgmentTemplates(institutionId);
  }

  @Put('config/templates')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async bulkUpsertTemplates(
    @Body()
    body: {
      institutionId: string;
      templates: Array<{
        level: 'SUPERIOR' | 'ALTO' | 'BASICO' | 'BAJO';
        template: string;
        isActive?: boolean;
      }>;
    },
  ) {
    return this.configService.bulkUpsertValueJudgmentTemplates(
      body.institutionId,
      body.templates,
    );
  }

  @Post('config/:institutionId/templates/defaults')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async createDefaultTemplates(@Param('institutionId') institutionId: string) {
    return this.configService.createDefaultTemplates(institutionId);
  }

  // ============================================
  // ACHIEVEMENTS (Teacher)
  // ============================================

  @Get('by-assignment')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getAchievementsByAssignment(
    @Query('teacherAssignmentId') teacherAssignmentId: string,
    @Query('academicTermId') academicTermId: string,
  ) {
    return this.achievementService.getAchievementsByAssignment(
      teacherAssignmentId,
      academicTermId,
    );
  }

  @Get('promotional/:teacherAssignmentId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getPromotionalAchievements(
    @Param('teacherAssignmentId') teacherAssignmentId: string,
  ) {
    return this.achievementService.getPromotionalAchievements(teacherAssignmentId);
  }

  @Post()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async createAchievement(
    @Body()
    body: {
      teacherAssignmentId: string;
      academicTermId: string;
      orderNumber: number;
      baseDescription: string;
      isPromotional?: boolean;
    },
  ) {
    return this.achievementService.createAchievement(body);
  }

  @Put(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async updateAchievement(
    @Param('id') id: string,
    @Body() body: { baseDescription: string },
  ) {
    return this.achievementService.updateAchievement(id, body);
  }

  @Delete(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async deleteAchievement(@Param('id') id: string) {
    return this.achievementService.deleteAchievement(id);
  }

  // ============================================
  // ATTITUDINAL ACHIEVEMENTS
  // ============================================

  @Get('attitudinal')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getAttitudinalAchievements(
    @Query('teacherAssignmentId') teacherAssignmentId: string,
    @Query('academicTermId') academicTermId: string,
  ) {
    return this.achievementService.getAttitudinalAchievements(
      teacherAssignmentId,
      academicTermId,
    );
  }

  @Put('attitudinal')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async upsertAttitudinalAchievement(
    @Body()
    body: {
      teacherAssignmentId: string;
      academicTermId: string;
      achievementId?: string;
      description: string;
    },
  ) {
    return this.achievementService.upsertAttitudinalAchievement(body);
  }

  // ============================================
  // STUDENT ACHIEVEMENTS
  // ============================================

  @Get('students/:achievementId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getStudentAchievements(@Param('achievementId') achievementId: string) {
    return this.achievementService.getStudentAchievements(achievementId);
  }

  @Get('by-enrollment/:studentEnrollmentId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getStudentAchievementsByEnrollment(
    @Param('studentEnrollmentId') studentEnrollmentId: string,
    @Query('academicTermId') academicTermId?: string,
  ) {
    return this.achievementService.getStudentAchievementsByEnrollment(
      studentEnrollmentId,
      academicTermId,
    );
  }

  @Post('students/generate-suggestions')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async bulkGenerateSuggestions(
    @Body()
    body: {
      achievementId: string;
      institutionId: string;
      studentGrades: Array<{
        studentEnrollmentId: string;
        finalGrade: number;
      }>;
    },
  ) {
    return this.achievementService.bulkGenerateSuggestions(
      body.achievementId,
      body.institutionId,
      body.studentGrades,
    );
  }

  @Put('students/:id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async upsertStudentAchievement(
    @Param('id') id: string,
    @Body()
    body: {
      studentEnrollmentId: string;
      achievementId: string;
      performanceLevel: 'BAJO' | 'BASICO' | 'ALTO' | 'SUPERIOR';
      suggestedText?: string;
      approvedText?: string;
      isTextApproved?: boolean;
      suggestedJudgment?: string;
      approvedJudgment?: string;
      isJudgmentApproved?: boolean;
      attitudinalText?: string;
    },
    @Request() req: any,
  ) {
    return this.achievementService.upsertStudentAchievement({
      ...body,
      approvedById: req.user?.id,
    });
  }

  @Post('students/:id/approve')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async approveStudentAchievement(
    @Param('id') id: string,
    @Body()
    body: {
      approvedText: string;
      approvedJudgment?: string;
    },
    @Request() req: any,
  ) {
    return this.achievementService.approveStudentAchievement(id, req.user.id, body);
  }

  // ============================================
  // VALIDATION
  // ============================================

  @Get('validate')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async validatePeriodAchievements(
    @Query('teacherAssignmentId') teacherAssignmentId: string,
    @Query('academicTermId') academicTermId: string,
    @Query('requiredCount') requiredCount: string,
  ) {
    return this.achievementService.validatePeriodAchievements(
      teacherAssignmentId,
      academicTermId,
      parseInt(requiredCount) || 1,
    );
  }

  @Get('unapproved')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getUnapprovedStudentAchievements(
    @Query('teacherAssignmentId') teacherAssignmentId: string,
    @Query('academicTermId') academicTermId: string,
  ) {
    return this.achievementService.getUnapprovedStudentAchievements(
      teacherAssignmentId,
      academicTermId,
    );
  }
}
