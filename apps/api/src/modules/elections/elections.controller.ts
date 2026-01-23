import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Request,
  Response,
  UseGuards,
} from '@nestjs/common';
import type { Response as ExpressResponse } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ElectionsService } from './elections.service';
import { ElectionsReportsService } from './elections-reports.service';

@Controller('elections')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ElectionsController {
  constructor(
    private readonly electionsService: ElectionsService,
    private readonly reportsService: ElectionsReportsService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // PROCESOS ELECTORALES (Admin/Coordinador)
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('process')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async createProcess(@Request() req: any, @Body() body: any) {
    return this.electionsService.createProcess({
      ...body,
      createdById: req.user.id,
    });
  }

  @Get('process')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async getProcesses(@Query('institutionId') institutionId: string) {
    return this.electionsService.getProcessByInstitution(institutionId);
  }

  @Get('process/current')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE', 'ESTUDIANTE')
  async getCurrentProcess(@Query('institutionId') institutionId: string) {
    return this.electionsService.getCurrentProcess(institutionId);
  }

  @Get('process/:id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async getProcessById(@Param('id') id: string) {
    return this.electionsService.getProcessById(id);
  }

  @Put('process/:id/status')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async updateProcessStatus(
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return this.electionsService.updateProcessStatus(id, status);
  }

  @Post('process/:id/close')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async closeProcess(@Param('id') id: string) {
    return this.electionsService.closeProcess(id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CANDIDATOS
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('candidate')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'ESTUDIANTE')
  async registerCandidate(@Body() body: any) {
    return this.electionsService.registerCandidate(body);
  }

  @Get('election/:electionId/candidates')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE', 'ESTUDIANTE')
  async getCandidates(@Param('electionId') electionId: string) {
    return this.electionsService.getCandidatesByElection(electionId);
  }

  @Put('candidate/:id/approve')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async approveCandidate(@Request() req: any, @Param('id') id: string) {
    return this.electionsService.approveCandidate(id, req.user.id);
  }

  @Put('candidate/:id/reject')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async rejectCandidate(
    @Request() req: any,
    @Param('id') id: string,
    @Body('reason') reason: string,
  ) {
    return this.electionsService.rejectCandidate(id, req.user.id, reason);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VOTACIÓN (Estudiantes)
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('voting/pending')
  @Roles('ESTUDIANTE')
  async getPendingElections(
    @Request() req: any,
    @Query('institutionId') institutionId: string,
  ) {
    // Obtener studentId del usuario
    const student = await this.getStudentFromUser(req.user.id);
    if (!student) {
      return [];
    }
    return this.electionsService.getPendingElectionsForStudent(student.id, institutionId);
  }

  @Post('vote')
  @Roles('ESTUDIANTE')
  async vote(@Request() req: any, @Body() body: { electionId: string; candidateId?: string }) {
    const student = await this.getStudentFromUser(req.user.id);
    if (!student) {
      throw new Error('No se encontró el estudiante asociado a este usuario');
    }
    return this.electionsService.vote({
      electionId: body.electionId,
      voterId: student.id,
      candidateId: body.candidateId,
    });
  }

  @Get('voting/completed')
  @Roles('ESTUDIANTE')
  async hasCompletedVoting(
    @Request() req: any,
    @Query('institutionId') institutionId: string,
  ) {
    const student = await this.getStudentFromUser(req.user.id);
    if (!student) {
      return { completed: true };
    }
    const completed = await this.electionsService.hasCompletedVoting(student.id, institutionId);
    return { completed };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RESULTADOS
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('election/:electionId/results')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE', 'ESTUDIANTE')
  async getResults(@Param('electionId') electionId: string) {
    return this.electionsService.getResultsByElection(electionId);
  }

  @Get('process/:processId/results')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async getProcessResults(@Param('processId') processId: string) {
    return this.electionsService.getResultsByProcess(processId);
  }

  @Get('process/:processId/stats')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async getVotingStats(@Param('processId') processId: string) {
    return this.electionsService.getVotingStats(processId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REPORTES PDF
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('process/:processId/report/acta')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async downloadActaEscrutinio(
    @Param('processId') processId: string,
    @Response() res: ExpressResponse,
  ) {
    const buffer = await this.reportsService.generateActaEscrutinio(processId);
    
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="acta-escrutinio-${processId}.pdf"`,
      'Content-Length': buffer.length,
    });
    
    res.end(buffer);
  }

  @Get('process/:processId/report/participation')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async downloadParticipationReport(
    @Param('processId') processId: string,
    @Response() res: ExpressResponse,
  ) {
    const buffer = await this.reportsService.generateParticipationReport(processId);
    
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="participacion-${processId}.pdf"`,
      'Content-Length': buffer.length,
    });
    
    res.end(buffer);
  }

  @Get('election/:electionId/report')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async downloadElectionResults(
    @Param('electionId') electionId: string,
    @Response() res: ExpressResponse,
  ) {
    const buffer = await this.reportsService.generateElectionResults(electionId);
    
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="resultados-${electionId}.pdf"`,
      'Content-Length': buffer.length,
    });
    
    res.end(buffer);
  }

  // Helper para obtener estudiante del usuario
  private async getStudentFromUser(userId: string) {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    try {
      return await prisma.student.findFirst({
        where: { userId },
      });
    } finally {
      await prisma.$disconnect();
    }
  }
}
