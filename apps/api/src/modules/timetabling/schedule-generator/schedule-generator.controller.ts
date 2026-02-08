import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ScheduleGeneratorService, GenerationOptions } from './schedule-generator.service';
import { TimetableExcelService } from './timetable-excel.service';
import { PrismaService } from '../../../prisma/prisma.service';
import type { Response } from 'express';

@Controller('timetabling/generator')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ScheduleGeneratorController {
  constructor(
    private readonly generatorService: ScheduleGeneratorService,
    private readonly excelService: TimetableExcelService,
    private readonly prisma: PrismaService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // PLANTILLA EXCEL
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('template')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async downloadTemplate(
    @Request() req,
    @Query('academicYearId') academicYearId: string,
    @Res() res: Response,
  ) {
    const buffer = await this.excelService.generateTemplate(
      req.user.institutionId,
      academicYearId,
    );

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="plantilla-carga-academica.xlsx"',
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // IMPORTAR CARGA ACADÉMICA
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('import')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  @UseInterceptors(FileInterceptor('file'))
  async importTeachingLoad(
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
    @Body('academicYearId') academicYearId: string,
  ) {
    if (!file) {
      return { success: false, errors: ['No se recibió archivo'] };
    }
    if (!academicYearId) {
      return { success: false, errors: ['academicYearId es obligatorio'] };
    }

    return this.excelService.importTeachingLoad(
      req.user.institutionId,
      academicYearId,
      file.buffer,
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GENERAR HORARIO AUTOMÁTICAMENTE
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('generate')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async generateSchedule(
    @Request() req,
    @Body() body: {
      academicYearId: string;
      groupIds?: string[];
      clearExisting?: boolean;
      respectAvailability?: boolean;
    },
  ) {
    if (!body.academicYearId) {
      return { success: false, errors: ['academicYearId es obligatorio'] };
    }

    const options: GenerationOptions = {
      academicYearId: body.academicYearId,
      groupIds: body.groupIds,
      clearExisting: body.clearExisting ?? true,
      respectAvailability: body.respectAvailability ?? true,
    };

    return this.generatorService.generateSchedule(req.user.institutionId, options);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPORTAR HORARIO A EXCEL
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('export')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async exportSchedule(
    @Request() req,
    @Query('academicYearId') academicYearId: string,
    @Query('viewType') viewType: 'by-group' | 'by-teacher' = 'by-group',
    @Res() res: Response,
  ) {
    const buffer = await this.excelService.exportSchedule(
      req.user.institutionId,
      academicYearId,
      viewType,
    );

    const filename = viewType === 'by-teacher'
      ? 'horario-por-docente.xlsx'
      : 'horario-por-grupo.xlsx';

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPORTAR HORARIO A PDF
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('export-pdf')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async exportSchedulePdf(
    @Request() req,
    @Query('academicYearId') academicYearId: string,
    @Query('viewType') viewType: 'by-group' | 'by-teacher' = 'by-group',
    @Res() res: Response,
  ) {
    const buffer = await this.excelService.exportSchedulePdf(
      req.user.institutionId,
      academicYearId,
      viewType,
    );

    const filename = viewType === 'by-teacher'
      ? 'horario-por-docente.pdf'
      : 'horario-por-grupo.pdf';

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PREVIEW: Vista previa de la carga académica actual
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('teaching-load')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async getTeachingLoad(
    @Request() req,
    @Query('academicYearId') academicYearId: string,
  ) {
    const assignments = await this.prisma.teacherAssignment.findMany({
      where: {
        academicYearId,
        group: { shift: { campus: { institutionId: req.user.institutionId } } },
      },
      include: {
        teacher: { select: { id: true, firstName: true, lastName: true, email: true } },
        subject: { select: { id: true, name: true } },
        group: { select: { id: true, name: true } },
      },
      orderBy: [{ teacher: { firstName: 'asc' } }, { group: { name: 'asc' } }],
    });

    // Resumen
    const uniqueTeachers = new Set(assignments.map(a => a.teacherId));
    const uniqueGroups = new Set(assignments.map(a => a.groupId));
    const totalHours = assignments.reduce((sum, a) => sum + (a.weeklyHours || 0), 0);

    return {
      assignments: assignments.map(a => ({
        id: a.id,
        teacherId: a.teacherId,
        teacherName: `${a.teacher.firstName || ''} ${a.teacher.lastName || ''}`.trim() || 'Docente',
        teacherEmail: a.teacher.email,
        subjectName: a.subject.name,
        groupName: a.group.name,
        weeklyHours: a.weeklyHours,
      })),
      summary: {
        totalAssignments: assignments.length,
        uniqueTeachers: uniqueTeachers.size,
        uniqueGroups: uniqueGroups.size,
        totalWeeklyHours: totalHours,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VISTAS DE HORARIO (total, por grado, por docente, por materia, por área)
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('schedule-views')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getScheduleViews(
    @Request() req,
    @Query('academicYearId') academicYearId: string,
    @Query('view') view: 'total' | 'by-grade' | 'by-teacher' | 'by-subject' | 'by-area' = 'total',
    @Query('filterId') filterId?: string,
  ) {
    const institutionId = req.user.institutionId;

    // Base query para todas las entradas del horario
    const entries = await this.prisma.scheduleEntry.findMany({
      where: { institutionId, academicYearId },
      include: {
        group: {
          select: {
            id: true, name: true,
            grade: { select: { id: true, name: true, stage: true, number: true } },
            shift: { select: { id: true, name: true, type: true } },
            campus: { select: { id: true, name: true } },
          },
        },
        timeBlock: {
          select: { id: true, startTime: true, endTime: true, order: true, label: true, type: true },
        },
        teacherAssignment: {
          include: {
            teacher: { select: { id: true, firstName: true, lastName: true, email: true } },
            subject: {
              select: {
                id: true, name: true, code: true,
                area: { select: { id: true, name: true } },
              },
            },
          },
        },
        room: { select: { id: true, name: true } },
      },
      orderBy: [{ timeBlock: { order: 'asc' } }, { dayOfWeek: 'asc' }],
    });

    // Formatear cada entrada
    const formatEntry = (e: any) => ({
      id: e.id,
      dayOfWeek: e.dayOfWeek,
      timeBlock: e.timeBlock,
      groupId: e.groupId,
      groupName: e.group?.name,
      gradeName: e.group?.grade?.name,
      gradeId: e.group?.grade?.id,
      gradeStage: e.group?.grade?.stage,
      shiftName: e.group?.shift?.name,
      campusName: e.group?.campus?.name,
      subjectName: e.teacherAssignment?.subject?.name || e.projectName || '',
      subjectId: e.teacherAssignment?.subject?.id,
      areaName: e.teacherAssignment?.subject?.area?.name || '',
      areaId: e.teacherAssignment?.subject?.area?.id,
      teacherName: e.teacherAssignment?.teacher
        ? `${e.teacherAssignment.teacher.firstName || ''} ${e.teacherAssignment.teacher.lastName || ''}`.trim()
        : '',
      teacherId: e.teacherAssignment?.teacher?.id,
      teacherEmail: e.teacherAssignment?.teacher?.email,
      roomName: e.room?.name || '',
      projectName: e.projectName || '',
      notes: e.notes || '',
      color: e.color || '',
    });

    const formattedEntries = entries.map(formatEntry);

    switch (view) {
      case 'by-grade': {
        const gradeMap = new Map<string, { gradeId: string; gradeName: string; stage: string; groups: any[] }>();
        for (const e of formattedEntries) {
          const key = e.gradeId || 'unknown';
          if (!gradeMap.has(key)) {
            gradeMap.set(key, { gradeId: key, gradeName: e.gradeName || 'Sin grado', stage: e.gradeStage || '', groups: [] });
          }
        }
        // Agrupar entradas por grupo dentro de cada grado
        const groupsByGrade = new Map<string, Map<string, any[]>>();
        for (const e of formattedEntries) {
          const gradeKey = e.gradeId || 'unknown';
          if (!groupsByGrade.has(gradeKey)) groupsByGrade.set(gradeKey, new Map());
          const gMap = groupsByGrade.get(gradeKey)!;
          if (!gMap.has(e.groupId)) gMap.set(e.groupId, []);
          gMap.get(e.groupId)!.push(e);
        }
        const grades = Array.from(gradeMap.values()).map(g => ({
          ...g,
          groups: Array.from(groupsByGrade.get(g.gradeId)?.entries() || []).map(([groupId, entries]) => ({
            groupId,
            groupName: entries[0]?.groupName || '',
            entries,
          })),
        }));
        return { view, grades, totalEntries: formattedEntries.length };
      }

      case 'by-teacher': {
        const teacherMap = new Map<string, { teacherId: string; teacherName: string; email: string; entries: any[] }>();
        for (const e of formattedEntries) {
          if (!e.teacherId) continue;
          if (!teacherMap.has(e.teacherId)) {
            teacherMap.set(e.teacherId, {
              teacherId: e.teacherId,
              teacherName: e.teacherName,
              email: e.teacherEmail || '',
              entries: [],
            });
          }
          teacherMap.get(e.teacherId)!.entries.push(e);
        }
        // Si filterId, devolver solo ese docente
        if (filterId && teacherMap.has(filterId)) {
          return { view, teachers: [teacherMap.get(filterId)], totalEntries: formattedEntries.length };
        }
        return { view, teachers: Array.from(teacherMap.values()), totalEntries: formattedEntries.length };
      }

      case 'by-subject': {
        const subjectMap = new Map<string, { subjectId: string; subjectName: string; areaName: string; entries: any[] }>();
        for (const e of formattedEntries) {
          if (!e.subjectId) continue;
          if (!subjectMap.has(e.subjectId)) {
            subjectMap.set(e.subjectId, {
              subjectId: e.subjectId,
              subjectName: e.subjectName,
              areaName: e.areaName,
              entries: [],
            });
          }
          subjectMap.get(e.subjectId)!.entries.push(e);
        }
        return { view, subjects: Array.from(subjectMap.values()), totalEntries: formattedEntries.length };
      }

      case 'by-area': {
        const areaMap = new Map<string, { areaId: string; areaName: string; subjects: Map<string, any> }>();
        for (const e of formattedEntries) {
          const aKey = e.areaId || 'sin-area';
          if (!areaMap.has(aKey)) {
            areaMap.set(aKey, { areaId: aKey, areaName: e.areaName || 'Sin área', subjects: new Map() });
          }
          const area = areaMap.get(aKey)!;
          const sKey = e.subjectId || 'sin-materia';
          if (!area.subjects.has(sKey)) {
            area.subjects.set(sKey, { subjectId: sKey, subjectName: e.subjectName || 'Sin materia', entries: [] });
          }
          area.subjects.get(sKey)!.entries.push(e);
        }
        const areas = Array.from(areaMap.values()).map(a => ({
          areaId: a.areaId,
          areaName: a.areaName,
          subjects: Array.from(a.subjects.values()),
          totalEntries: Array.from(a.subjects.values()).reduce((sum, s) => sum + s.entries.length, 0),
        }));
        return { view, areas, totalEntries: formattedEntries.length };
      }

      default: // total
        return { view: 'total', entries: formattedEntries, totalEntries: formattedEntries.length };
    }
  }
}
