import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { LearningIdentityService } from './learning-identity.service';

@Controller('gamification')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GamificationController {
  constructor(
    private readonly identity: LearningIdentityService,
    private readonly prisma: PrismaService,
  ) {}

  /** Identidad de aprendizaje del estudiante autenticado (XP, nivel, racha). */
  @Get('me')
  @Roles('ESTUDIANTE')
  async myIdentity(@Request() req: any) {
    const userId = req.user.id;
    const enrollment = await this.prisma.studentEnrollment.findFirst({
      where: { student: { userId }, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
      select: { studentId: true },
    });
    if (!enrollment) throw new Error('No se encontró matrícula activa');
    return this.identity.getByStudent(enrollment.studentId);
  }
}
