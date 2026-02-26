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
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ScheduleGeneratorService, GenerationOptions } from './schedule-generator.service';
import { TimetableExcelService } from './timetable-excel.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { CapabilitiesService } from '../../capabilities/capabilities.service';
import type { Response } from 'express';

@Controller('timetabling/generator')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ScheduleGeneratorController {
  constructor(
    private readonly generatorService: ScheduleGeneratorService,
    private readonly excelService: TimetableExcelService,
    private readonly prisma: PrismaService,
    private readonly capabilitiesService: CapabilitiesService,
  ) {}

  /**
   * Helper: resolve institutionId from JWT or derive from academicYearId (for SuperAdmin)
   */
  private async resolveInstitutionId(req: any, academicYearId?: string): Promise<string | null> {
    if (req.user.institutionId) return req.user.institutionId;
    // SuperAdmin: derive from academicYearId
    if (academicYearId) {
      const year = await this.prisma.academicYear.findUnique({
        where: { id: academicYearId },
        select: { institutionId: true },
      });
      if (year?.institutionId) {
        console.log(`[Timetabling] Resolved institutionId ${year.institutionId} from academicYearId ${academicYearId}`);
        return year.institutionId;
      }
    }
    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTEXTO PERSISTENTE DE GENERACIÓN (por institución+año+jornada)
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('context')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR')
  async getContext(
    @Request() req,
    @Query('academicYearId') academicYearId: string,
    @Query('shiftId') shiftId: string,
  ) {
    if (!academicYearId || !shiftId) {
      return null;
    }
    const institutionId = await this.resolveInstitutionId(req, academicYearId);
    if (!institutionId) return null;
    try {
      const ctx = await this.prisma.scheduleGenerationContext.findUnique({
        where: {
          institutionId_academicYearId_shiftId: {
            institutionId,
            academicYearId,
            shiftId,
          },
        },
      });
      return ctx;
    } catch (err) {
      console.warn('[Context] Table may not exist yet:', err.code || err.message);
      return null;
    }
  }

  @Post('context')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR')
  async upsertContext(
    @Request() req,
    @Body() body: {
      academicYearId: string;
      shiftId: string;
      lastStep?: string;
      startTime?: string;
      classesPerDay?: number;
      classDurationMinutes?: number;
      breakDurationMinutes?: number;
      breakAfterBlock?: number;
      secondBreakAfterBlock?: number;
      includeLunch?: boolean;
      lunchDurationMinutes?: number;
      lunchAfterBlock?: number;
      includeTutoring?: boolean;
      tutoringDurationMinutes?: number;
      activeDays?: string[];
      clearExisting?: boolean;
      respectAvailability?: boolean;
      groupTeacherBlocks?: boolean;
      selectedGroupIds?: string[];
      lastGenerationResult?: any;
      configSaved?: boolean;
    },
  ) {
    if (!body.academicYearId || !body.shiftId) {
      return { success: false, error: 'academicYearId y shiftId son obligatorios' };
    }
    const institutionId = await this.resolveInstitutionId(req, body.academicYearId);
    if (!institutionId) {
      return { success: false, error: 'No se pudo resolver la institución' };
    }

    const { academicYearId, shiftId, ...data } = body;

    try {
      const ctx = await this.prisma.scheduleGenerationContext.upsert({
        where: {
          institutionId_academicYearId_shiftId: {
            institutionId,
            academicYearId,
            shiftId,
          },
        },
        create: {
          institutionId,
          academicYearId,
          shiftId,
          ...data,
        },
        update: data,
      });
      return ctx;
    } catch (err) {
      console.warn('[Context] Table may not exist yet:', err.code || err.message);
      return { success: false, error: 'Context table not available yet. Redeploy may be needed.' };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // JORNADAS DISPONIBLES (para el selector del frontend)
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('shifts')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR')
  async getShifts(@Request() req, @Query('academicYearId') academicYearId?: string) {
    const institutionId = await this.resolveInstitutionId(req, academicYearId);
    if (!institutionId) return [];
    const shifts = await this.prisma.shift.findMany({
      where: { campus: { institutionId } },
      include: {
        campus: { select: { name: true } },
        _count: { select: { groups: true, timeBlocks: true } },
      },
      orderBy: { name: 'asc' },
    });

    return shifts.map(s => ({
      id: s.id,
      name: s.name,
      type: s.type,
      campusName: s.campus.name,
      groupCount: s._count.groups,
      timeBlockCount: s._count.timeBlocks,
    }));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PLANTILLA EXCEL
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('template')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR')
  async downloadTemplate(
    @Request() req,
    @Query('academicYearId') academicYearId: string,
    @Res() res: Response,
  ) {
    const institutionId = await this.resolveInstitutionId(req, academicYearId);
    if (!institutionId) throw new BadRequestException('No se pudo resolver la institución');
    const buffer = await this.excelService.generateTemplate(
      institutionId,
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
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR')
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

    const institutionId = await this.resolveInstitutionId(req, academicYearId);
    if (!institutionId) {
      return { success: false, errors: ['No se pudo resolver la institución. Contacte soporte.'] };
    }
    console.log(`[Import] institutionId=${institutionId}, academicYearId=${academicYearId}, user=${req.user.id}, role=${req.user.isSuperAdmin ? 'SUPERADMIN' : 'INSTITUTIONAL'}`);

    const importResult = await this.excelService.importTeachingLoad(
      institutionId,
      academicYearId,
      file.buffer,
    );

    // Fetch fresh teaching-load data so frontend can display it immediately
    const assignments = await this.prisma.teacherAssignment.findMany({
      where: { academicYearId, institutionId },
      include: {
        teacher: { select: { id: true, firstName: true, lastName: true, email: true } },
        subject: { select: { id: true, name: true } },
        group: { select: { id: true, name: true } },
      },
      orderBy: [{ teacher: { firstName: 'asc' } }, { group: { name: 'asc' } }],
    });
    const uniqueTeachers = new Set(assignments.map(a => a.teacherId));
    const uniqueGroups = new Set(assignments.map(a => a.groupId));
    const totalHours = assignments.reduce((sum, a) => sum + (a.weeklyHours || 0), 0);
    console.log(`[Import] Post-import check: ${assignments.length} assignments found for institutionId=${institutionId}`);

    return {
      ...importResult,
      teachingLoad: {
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
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VERIFICACIÓN PREVIA (TEST) — factibilidad antes de generar
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('feasibility-check')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR')
  async checkFeasibility(
    @Request() req,
    @Query('academicYearId') academicYearId: string,
    @Query('shiftId') shiftId?: string,
  ) {
    const institutionId = await this.resolveInstitutionId(req, academicYearId);
    if (!institutionId) return { feasible: false, error: 'No se pudo resolver la institución' };
    if (!academicYearId) return { feasible: false, error: 'academicYearId es obligatorio' };

    // 1. Get groups
    const groups = await this.prisma.group.findMany({
      where: {
        shift: { campus: { institutionId } },
        ...(shiftId ? { shiftId } : {}),
      },
      include: { grade: true, shift: true },
    });

    const groupsWithLoad = await this.prisma.group.findMany({
      where: {
        shift: { campus: { institutionId } },
        teacherAssignments: { some: { academicYearId } },
        ...(shiftId ? { shiftId } : {}),
      },
      select: { id: true },
    });
    const groupIdsWithLoad = new Set(groupsWithLoad.map(g => g.id));

    // 2. Get assignments for groups with load
    const assignments = groupIdsWithLoad.size > 0
      ? await this.prisma.teacherAssignment.findMany({
          where: { academicYearId, groupId: { in: [...groupIdsWithLoad] } },
          include: {
            teacher: { select: { id: true, firstName: true, lastName: true } },
            subject: { select: { id: true, name: true } },
            group: { select: { id: true, name: true, shiftId: true } },
          },
        })
      : [];

    // 3. Get time blocks per shift
    const timeBlocks = await this.prisma.timeBlock.findMany({
      where: { institutionId, ...(shiftId ? { shiftId } : {}), type: 'CLASS' },
      orderBy: { order: 'asc' },
    });

    const activeDays = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
    const totalSlotsPerGroup = timeBlocks.length * activeDays.length;
    const totalHoursNeeded = assignments.reduce((s, a) => s + (a.weeklyHours || 0), 0);

    // 4. Check teacher conflicts (same teacher, too many hours)
    const teacherHours = new Map<string, { name: string; hours: number; groups: Set<string>; details: string[] }>();
    for (const a of assignments) {
      const tid = a.teacher.id;
      if (!teacherHours.has(tid)) {
        teacherHours.set(tid, {
          name: `${a.teacher.firstName} ${a.teacher.lastName}`.trim(),
          hours: 0,
          groups: new Set(),
          details: [],
        });
      }
      const t = teacherHours.get(tid)!;
      t.hours += a.weeklyHours || 0;
      t.groups.add(a.groupId);
      t.details.push(`${a.subject?.name || '?'} (${a.group?.name || '?'}): ${a.weeklyHours}h`);
    }

    const maxTeacherSlots = timeBlocks.length * activeDays.length;
    const overloadedTeachers: { name: string; hours: number; maxSlots: number; details: string[] }[] = [];
    for (const [, t] of teacherHours) {
      if (t.hours > maxTeacherSlots) {
        overloadedTeachers.push({ name: t.name, hours: t.hours, maxSlots: maxTeacherSlots, details: t.details });
      }
    }

    // 5. Groups without load
    const groupsWithoutLoad = groups.filter(g => !groupIdsWithLoad.has(g.id));

    // 6. Feasibility verdict
    const issues: { type: 'error' | 'warning'; message: string }[] = [];

    if (groups.length === 0) {
      issues.push({ type: 'error', message: 'No hay grupos configurados para esta jornada.' });
    }
    if (groupsWithLoad.length === 0 && groups.length > 0) {
      issues.push({ type: 'error', message: `Hay ${groups.length} grupos pero ninguno tiene carga académica importada.` });
    }
    if (timeBlocks.length === 0) {
      issues.push({ type: 'error', message: 'No hay bloques de tiempo tipo CLASS configurados. Configure el horario primero.' });
    }
    for (const t of overloadedTeachers) {
      issues.push({ type: 'error', message: `${t.name}: ${t.hours}h semanales exceden los ${t.maxSlots} slots disponibles. Detalle: ${t.details.join(', ')}` });
    }
    if (groupsWithoutLoad.length > 0 && groupsWithLoad.length > 0) {
      issues.push({ type: 'warning', message: `${groupsWithoutLoad.length} grupo(s) sin carga académica: ${groupsWithoutLoad.slice(0, 5).map(g => g.name).join(', ')}${groupsWithoutLoad.length > 5 ? '...' : ''}` });
    }

    // Per-group slot check
    for (const gId of groupIdsWithLoad) {
      const groupAssignments = assignments.filter(a => a.groupId === gId);
      const groupHours = groupAssignments.reduce((s, a) => s + (a.weeklyHours || 0), 0);
      if (groupHours > totalSlotsPerGroup) {
        const groupName = groupAssignments[0]?.group?.name || gId;
        issues.push({ type: 'warning', message: `${groupName}: necesita ${groupHours}h pero solo hay ${totalSlotsPerGroup} slots.` });
      }
    }

    const hasErrors = issues.some(i => i.type === 'error');

    return {
      feasible: !hasErrors,
      totalGroups: groups.length,
      groupsWithLoad: groupsWithLoad.length,
      groupsWithoutLoad: groupsWithoutLoad.length,
      totalAssignments: assignments.length,
      totalHoursNeeded,
      totalSlotsPerGroup,
      classBlocksPerDay: timeBlocks.length,
      activeDays: activeDays.length,
      uniqueTeachers: teacherHours.size,
      issues,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GENERAR HORARIO AUTOMÁTICAMENTE
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('generate')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR')
  async generateSchedule(
    @Request() req,
    @Body() body: {
      academicYearId: string;
      shiftId?: string;
      groupIds?: string[];
      clearExisting?: boolean;
      respectAvailability?: boolean;
      groupTeacherBlocks?: boolean;
      activeDays?: string[];
    },
  ) {
    if (!body.academicYearId) {
      return { success: false, errors: ['academicYearId es obligatorio'] };
    }

    const institutionId = await this.resolveInstitutionId(req, body.academicYearId);
    if (!institutionId) {
      return { success: false, errors: ['No se pudo resolver la institución'] };
    }

    const options: GenerationOptions = {
      academicYearId: body.academicYearId,
      shiftId: body.shiftId,
      groupIds: body.groupIds,
      clearExisting: body.clearExisting ?? true,
      respectAvailability: body.respectAvailability ?? true,
      groupTeacherBlocks: body.groupTeacherBlocks ?? true,
      activeDays: body.activeDays as any,
    };

    const result = await this.generatorService.generateSchedule(institutionId, options);

    // Persist result in context if shiftId provided
    if (body.shiftId) {
      try {
        await this.prisma.scheduleGenerationContext.upsert({
          where: {
            institutionId_academicYearId_shiftId: {
              institutionId,
              academicYearId: body.academicYearId,
              shiftId: body.shiftId,
            },
          },
          create: {
            institutionId,
            academicYearId: body.academicYearId,
            shiftId: body.shiftId,
            lastStep: 'result',
            lastGenerationResult: result as any,
          },
          update: {
            lastStep: 'result',
            lastGenerationResult: result as any,
          },
        });
      } catch (_) { /* non-critical */ }
    }

    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPORTAR HORARIO A EXCEL
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('export')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR', 'DOCENTE')
  async exportSchedule(
    @Request() req,
    @Query('academicYearId') academicYearId: string,
    @Query('viewType') viewType: 'by-group' | 'by-teacher' = 'by-group',
    @Res() res: Response,
  ) {
    const institutionId = await this.resolveInstitutionId(req, academicYearId);
    if (!institutionId) throw new BadRequestException('No se pudo resolver la institución');
    const buffer = await this.excelService.exportSchedule(
      institutionId,
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
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR', 'DOCENTE')
  async exportSchedulePdf(
    @Request() req,
    @Query('academicYearId') academicYearId: string,
    @Query('viewType') viewType: 'by-group' | 'by-teacher' = 'by-group',
    @Res() res: Response,
  ) {
    const institutionId = await this.resolveInstitutionId(req, academicYearId);
    if (!institutionId) throw new BadRequestException('No se pudo resolver la institución');
    const buffer = await this.excelService.exportSchedulePdf(
      institutionId,
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
  // CONFIGURAR PARÁMETROS DE HORARIO (bloques, días, duraciones)
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('schedule-config')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR')
  async getScheduleConfig(
    @Request() req,
    @Query('shiftId') shiftId?: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    const institutionId = await this.resolveInstitutionId(req, academicYearId);
    if (!institutionId) return { error: 'No se pudo resolver la institución' };

    // Buscar shifts con sus bloques
    const shifts = await this.prisma.shift.findMany({
      where: { campus: { institutionId } },
      include: {
        timeBlocks: { orderBy: { order: 'asc' } },
        campus: { select: { name: true } },
      },
    });

    // Si se especifica shiftId, usar ese; si no, el primero con bloques
    const activeShift = shiftId
      ? shifts.find(s => s.id === shiftId) || shifts[0]
      : shifts.find(s => s.timeBlocks.length > 0) || shifts[0];
    const blocks = activeShift?.timeBlocks || [];
    const classBlocks = blocks.filter(b => b.type === 'CLASS');
    const breakBlocks = blocks.filter(b => b.type === 'BREAK' || b.type === 'LUNCH');

    // Calcular duración de clase promedio
    const avgClassDuration = classBlocks.length > 0
      ? Math.round(classBlocks.reduce((sum, b) => {
          const [sh, sm] = b.startTime.split(':').map(Number);
          const [eh, em] = b.endTime.split(':').map(Number);
          return sum + ((eh * 60 + em) - (sh * 60 + sm));
        }, 0) / classBlocks.length)
      : 55;

    // Detectar si hay bloque de tutoría
    const tutoringBlock = blocks.find(b => b.type === 'TUTORING');
    const tutoringDuration = tutoringBlock
      ? (() => {
          const [sh, sm] = tutoringBlock.startTime.split(':').map(Number);
          const [eh, em] = tutoringBlock.endTime.split(':').map(Number);
          return (eh * 60 + em) - (sh * 60 + sm);
        })()
      : 55;

    // El startTime debe ser el del primer bloque (tutoría o clase)
    const firstBlock = blocks[0];
    const startTime = firstBlock?.startTime || '06:30';

    return {
      shiftId: activeShift?.id || null,
      shiftName: activeShift?.name || '',
      campusName: activeShift?.campus?.name || '',
      startTime,
      classesPerDay: classBlocks.length || 7,
      classDurationMinutes: avgClassDuration,
      breakDurationMinutes: breakBlocks.find(b => b.type === 'BREAK')
        ? (() => {
            const b = breakBlocks.find(bl => bl.type === 'BREAK')!;
            const [sh, sm] = b.startTime.split(':').map(Number);
            const [eh, em] = b.endTime.split(':').map(Number);
            return (eh * 60 + em) - (sh * 60 + sm);
          })()
        : 15,
      breakAfterBlock: breakBlocks.length > 0
        ? blocks.findIndex(b => b.type === 'BREAK') // position of first break
        : 2,
      includeLunch: breakBlocks.some(b => b.type === 'LUNCH'),
      lunchDurationMinutes: breakBlocks.find(b => b.type === 'LUNCH')
        ? (() => {
            const b = breakBlocks.find(bl => bl.type === 'LUNCH')!;
            const [sh, sm] = b.startTime.split(':').map(Number);
            const [eh, em] = b.endTime.split(':').map(Number);
            return (eh * 60 + em) - (sh * 60 + sm);
          })()
        : 30,
      lunchAfterBlock: (() => {
        const lunchIdx = blocks.findIndex(b => b.type === 'LUNCH');
        if (lunchIdx < 0) return 6;
        return blocks.slice(0, lunchIdx).filter(b => b.type === 'CLASS').length;
      })(),
      includeTutoring: !!tutoringBlock,
      tutoringDurationMinutes: tutoringDuration,
      activeDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
      totalBlocks: blocks.length,
      existingBlocks: blocks.map(b => ({
        id: b.id, type: b.type, startTime: b.startTime, endTime: b.endTime, label: b.label, order: b.order,
      })),
    };
  }

  @Post('configure-schedule')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR')
  async configureSchedule(
    @Request() req,
    @Body() body: {
      shiftId?: string;         // Explicit shift to configure (required for multi-shift)
      startTime: string;        // e.g., "06:30"
      classesPerDay: number;    // e.g., 7
      classDuration: number;    // minutes, e.g., 55
      breakDuration: number;    // minutes, e.g., 15
      breakAfterBlock: number;  // after which class # to insert break, e.g., 2
      secondBreakAfterBlock?: number; // optional second break position
      includeLunch: boolean;
      lunchDuration: number;    // minutes, e.g., 30
      lunchAfterBlock: number;  // after which class # to insert lunch, e.g., 6
      includeTutoring: boolean; // include tutoring block as first hour
      tutoringDuration: number; // minutes, e.g., 55
      activeDays: string[];     // e.g., ["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY"]
    },
  ) {
    const institutionId = await this.resolveInstitutionId(req);
    if (!institutionId) return { success: false, error: 'No se pudo resolver la institución' };

    // Find the target shift — explicit shiftId or fallback to first
    const shift = body.shiftId
      ? await this.prisma.shift.findFirst({
          where: { id: body.shiftId, campus: { institutionId } },
          include: { timeBlocks: true },
        })
      : await this.prisma.shift.findFirst({
          where: { campus: { institutionId } },
          include: { timeBlocks: true },
        });

    if (!shift) {
      return { success: false, error: 'No hay jornada configurada. Importe la carga académica primero.' };
    }

    // Delete existing time blocks ONLY for this specific shift
    await this.prisma.timeBlock.deleteMany({
      where: { institutionId, shiftId: shift.id },
    });

    // Generate new blocks based on config
    const blocks: { order: number; type: string; startTime: string; endTime: string; label: string }[] = [];
    let currentMinutes = this.timeToMinutes(body.startTime);
    let classCount = 0;
    let order = 0;

    // Tutoring block at order 0 (first block)
    if (body.includeTutoring) {
      const tutoringStart = this.minutesToTime(currentMinutes);
      currentMinutes += body.tutoringDuration || 55;
      const tutoringEnd = this.minutesToTime(currentMinutes);
      blocks.push({
        order: order++,
        type: 'TUTORING',
        startTime: tutoringStart,
        endTime: tutoringEnd,
        label: 'Tutor\u00eda',
      });
    } else {
      order = 1;
    }

    for (let i = 0; i < body.classesPerDay; i++) {
      classCount++;

      // Add class block
      const classStart = this.minutesToTime(currentMinutes);
      currentMinutes += body.classDuration;
      const classEnd = this.minutesToTime(currentMinutes);
      blocks.push({
        order: order++,
        type: 'CLASS',
        startTime: classStart,
        endTime: classEnd,
        label: `${classCount}° Hora`,
      });

      // Check if we need a break after this class
      if (classCount === body.breakAfterBlock && i < body.classesPerDay - 1) {
        const breakStart = this.minutesToTime(currentMinutes);
        currentMinutes += body.breakDuration;
        const breakEnd = this.minutesToTime(currentMinutes);
        blocks.push({
          order: order++,
          type: 'BREAK',
          startTime: breakStart,
          endTime: breakEnd,
          label: 'Receso',
        });
      }

      // Second break
      if (body.secondBreakAfterBlock && classCount === body.secondBreakAfterBlock && i < body.classesPerDay - 1) {
        const breakStart = this.minutesToTime(currentMinutes);
        currentMinutes += body.breakDuration;
        const breakEnd = this.minutesToTime(currentMinutes);
        blocks.push({
          order: order++,
          type: 'BREAK',
          startTime: breakStart,
          endTime: breakEnd,
          label: 'Receso',
        });
      }

      // Check if we need lunch after this class
      if (body.includeLunch && classCount === body.lunchAfterBlock && i < body.classesPerDay - 1) {
        const lunchStart = this.minutesToTime(currentMinutes);
        currentMinutes += body.lunchDuration;
        const lunchEnd = this.minutesToTime(currentMinutes);
        blocks.push({
          order: order++,
          type: 'LUNCH',
          startTime: lunchStart,
          endTime: lunchEnd,
          label: 'Almuerzo',
        });
      }
    }

    // Create new blocks
    for (const block of blocks) {
      await this.prisma.timeBlock.create({
        data: {
          institutionId,
          shiftId: shift.id,
          order: block.order,
          type: block.type as any,
          startTime: block.startTime,
          endTime: block.endTime,
          label: block.label,
        },
      });
    }

    const endTime = this.minutesToTime(currentMinutes);

    return {
      success: true,
      totalBlocks: blocks.length,
      classBlocks: blocks.filter(b => b.type === 'CLASS').length,
      startTime: body.startTime,
      endTime,
      activeDays: body.activeDays,
      blocks: blocks.map(b => ({ ...b })),
    };
  }

  private timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  private minutesToTime(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PREVIEW: Vista previa de la carga académica actual
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('teaching-load')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR')
  async getTeachingLoad(
    @Request() req,
    @Query('academicYearId') academicYearId: string,
    @Query('shiftId') shiftId?: string,
  ) {
    const institutionId = await this.resolveInstitutionId(req, academicYearId);
    console.log(`[TeachingLoad] institutionId=${institutionId}, academicYearId=${academicYearId}, shiftId=${shiftId || 'ALL'}, user=${req.user?.id}`);
    if (!institutionId) return { assignments: [], summary: { totalAssignments: 0, uniqueTeachers: 0, uniqueGroups: 0, totalWeeklyHours: 0 } };

    // Also check raw count without shiftId for diagnostics
    const totalCount = await this.prisma.teacherAssignment.count({ where: { academicYearId, institutionId } });
    console.log(`[TeachingLoad] Total assignments (no shift filter): ${totalCount}`);

    const assignments = await this.prisma.teacherAssignment.findMany({
      where: {
        academicYearId,
        institutionId,
        ...(shiftId ? { group: { shiftId } } : {}),
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
  // ELIMINAR CARGA ACADÉMICA
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('delete-teaching-load')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR')
  async deleteTeachingLoad(
    @Request() req,
    @Body() body: { academicYearId: string },
  ) {
    const institutionId = await this.resolveInstitutionId(req, body.academicYearId);
    if (!institutionId) return { success: false, error: 'No se pudo resolver la institución' };

    // First delete schedule entries that reference these assignments
    await this.prisma.scheduleEntry.deleteMany({
      where: { institutionId, academicYearId: body.academicYearId },
    });

    // Then delete all teacher assignments for this academic year in this institution
    const result = await this.prisma.teacherAssignment.deleteMany({
      where: { academicYearId: body.academicYearId, institutionId },
    });

    return {
      success: true,
      deletedAssignments: result.count,
      message: `Se eliminaron ${result.count} asignaciones y las entradas de horario asociadas.`,
      note: 'Los docentes, áreas, asignaturas, grados y grupos NO fueron afectados. Solo se eliminó la carga académica y el horario.',
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VISTAS DE HORARIO (total, por grado, por docente, por materia, por área)
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('schedule-views')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR', 'DOCENTE')
  async getScheduleViews(
    @Request() req,
    @Query('academicYearId') academicYearId: string,
    @Query('view') view: 'total' | 'by-grade' | 'by-teacher' | 'by-subject' | 'by-area' = 'total',
    @Query('filterId') filterId?: string,
    @Query('shiftId') shiftId?: string,
  ) {
    const institutionId = await this.resolveInstitutionId(req, academicYearId);
    const userId = req.user.sub || req.user.id;
    console.log('[ScheduleViews] Request:', { institutionId, academicYearId, view, filterId, userId, isSuperAdmin: req.user.isSuperAdmin });

    if (!institutionId) {
      console.error('[ScheduleViews] No institutionId — cannot resolve from JWT or academicYearId');
      return { view, entries: [], allTimeBlocks: [], totalEntries: 0, error: 'No institutionId' };
    }
    if (!academicYearId) {
      console.error('[ScheduleViews] No academicYearId in request!');
      return { view, entries: [], allTimeBlocks: [], totalEntries: 0, error: 'No academicYearId' };
    }

    // Obtener bloques de tiempo (filtrados por shift si se proporciona)
    const allTimeBlocks = await this.prisma.timeBlock.findMany({
      where: { institutionId, ...(shiftId ? { shiftId } : {}) },
      select: { id: true, startTime: true, endTime: true, order: true, label: true, type: true, shiftId: true },
      orderBy: { order: 'asc' },
    });

    // Base query para las entradas del horario (filtradas por shift si se proporciona)
    const entries = await this.prisma.scheduleEntry.findMany({
      where: { institutionId, academicYearId, ...(shiftId ? { group: { shiftId } } : {}) },
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
    console.log(`[ScheduleViews] Found ${entries.length} schedule entries for institution ${institutionId}, year ${academicYearId}`);
    if (entries.length === 0) {
      // Debug: check if there are ANY entries for this institution
      const totalInstitutionEntries = await this.prisma.scheduleEntry.count({ where: { institutionId } });
      const totalYearEntries = await this.prisma.scheduleEntry.count({ where: { academicYearId } });
      console.log(`[ScheduleViews] DEBUG: Total entries for institution: ${totalInstitutionEntries}, for year: ${totalYearEntries}`);
    }

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
      shiftId: e.group?.shift?.id,
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

    let formattedEntries = entries.map(formatEntry);

    // ═══════════════════════════════════════════════════════════════════
    // FILTRADO POR CAPABILITIES (solo para roles no-admin)
    // ═══════════════════════════════════════════════════════════════════
    // Direct role check from JWT - bypass capabilities service for admins
    const jwtRoles: string[] = Array.isArray(req.user.roles)
      ? req.user.roles.map((r: any) => typeof r === 'string' ? r : r.role?.name || r.name || '')
      : [];
    const isAdminFromJwt = req.user.isSuperAdmin ||
      jwtRoles.some(r => ['SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR'].includes(r));

    let isFullAccess = isAdminFromJwt;
    if (!isFullAccess) {
      // Fallback to capabilities service
      const userCaps = await this.capabilitiesService.getUserCapabilities(userId, institutionId);
      isFullAccess = userCaps.effectiveRoles.some(r =>
        ['SUPERADMIN', 'ADMIN_INSTITUTIONAL'].includes(r),
      );
      console.log('[ScheduleViews] Capabilities check:', { effectiveRoles: userCaps.effectiveRoles, isFullAccess });
    } else {
      console.log('[ScheduleViews] Admin bypass from JWT, skipping capabilities check');
    }

    if (!isFullAccess) {
      const userCaps = await this.capabilitiesService.getUserCapabilities(userId, institutionId);
      const canViewOwn = userCaps.capabilities.includes('VIEW_OWN_SCHEDULE');
      const canViewTutorGroup = userCaps.capabilities.includes('VIEW_TUTOR_GROUP_SCHEDULE');

      // Si no tiene ninguna capability de horario, devolver vacío
      if (!canViewOwn && !canViewTutorGroup) {
        return { view, entries: [], allTimeBlocks, totalEntries: 0, filtered: true };
      }

      // Construir set de groupIds permitidos
      const allowedGroupIds = new Set<string>();

      // Grupos donde el docente dicta clase (siempre si tiene VIEW_OWN_SCHEDULE)
      if (canViewOwn) {
        for (const gId of userCaps.teacherAssignmentGroupIds) {
          allowedGroupIds.add(gId);
        }
      }

      // Grupos donde es tutor/director
      if (canViewTutorGroup) {
        for (const gId of userCaps.tutorGroupIds) {
          allowedGroupIds.add(gId);
        }
      }

      // Filtrar entradas: solo las de grupos permitidos O las del propio docente
      formattedEntries = formattedEntries.filter(e => {
        // Si VIEW_OWN_SCHEDULE: mostrar entradas donde el docente es el teacher
        if (canViewOwn && e.teacherId === userId) return true;
        // Si VIEW_TUTOR_GROUP_SCHEDULE: mostrar todas las entradas del grupo tutor
        if (canViewTutorGroup && userCaps.tutorGroupIds.includes(e.groupId)) return true;
        return false;
      });
    }

    // ═══════════════════════════════════════════════════════════════════
    // CALCULAR HORAS SIN COLOCAR (assignments vs placed entries)
    // ═══════════════════════════════════════════════════════════════════
    const groupIds = [...new Set(formattedEntries.map(e => e.groupId))];
    const allAssignments = groupIds.length > 0 ? await this.prisma.teacherAssignment.findMany({
      where: { academicYearId, groupId: { in: groupIds } },
      include: {
        teacher: { select: { id: true, firstName: true, lastName: true } },
        subject: { select: { id: true, name: true, area: { select: { id: true, name: true } } } },
        group: { select: { id: true, name: true, shiftId: true, grade: { select: { id: true, name: true } } } },
      },
    }) : [];

    // Count placed entries per assignmentId
    const placedPerAssignment = new Map<string, number>();
    for (const e of entries) {
      if (e.teacherAssignmentId) {
        placedPerAssignment.set(e.teacherAssignmentId, (placedPerAssignment.get(e.teacherAssignmentId) || 0) + 1);
      }
    }

    const unplacedHours: any[] = [];
    for (const a of allAssignments) {
      const placed = placedPerAssignment.get(a.id) || 0;
      const remaining = (a.weeklyHours || 0) - placed;
      if (remaining > 0) {
        unplacedHours.push({
          assignmentId: a.id,
          groupId: a.groupId,
          groupName: a.group?.name || '',
          gradeId: a.group?.grade?.id || '',
          gradeName: a.group?.grade?.name || '',
          shiftId: a.group?.shiftId || '',
          subjectName: a.subject?.name || '',
          subjectId: a.subject?.id || '',
          areaName: a.subject?.area?.name || '',
          teacherName: `${a.teacher?.firstName || ''} ${a.teacher?.lastName || ''}`.trim(),
          teacherId: a.teacher?.id || '',
          weeklyHours: a.weeklyHours || 0,
          placedHours: placed,
          remainingHours: remaining,
        });
      }
    }

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
        const grades = Array.from(gradeMap.values())
          .sort((a, b) => {
            // Ordenar por stage y luego por nombre numérico
            const stageOrder: Record<string, number> = { PREESCOLAR: 0, BASICA_PRIMARIA: 1, BASICA_SECUNDARIA: 2, MEDIA: 3 };
            const sa = stageOrder[a.stage] ?? 99;
            const sb = stageOrder[b.stage] ?? 99;
            if (sa !== sb) return sa - sb;
            return a.gradeName.localeCompare(b.gradeName, 'es', { numeric: true });
          })
          .map(g => ({
            ...g,
            groups: Array.from(groupsByGrade.get(g.gradeId)?.entries() || [])
              .map(([groupId, entries]) => ({
                groupId,
                groupName: entries[0]?.groupName || '',
                shiftId: entries[0]?.shiftId || '',
                entries,
              }))
              .sort((a, b) => a.groupName.localeCompare(b.groupName, 'es', { numeric: true })),
          }));
        return { view, grades, allTimeBlocks, totalEntries: formattedEntries.length, unplacedHours };
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
          return { view, teachers: [teacherMap.get(filterId)], allTimeBlocks, totalEntries: formattedEntries.length, unplacedHours };
        }
        return { view, teachers: Array.from(teacherMap.values()), allTimeBlocks, totalEntries: formattedEntries.length, unplacedHours };
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
        return { view, subjects: Array.from(subjectMap.values()), allTimeBlocks, totalEntries: formattedEntries.length, unplacedHours };
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
        return { view, areas, allTimeBlocks, totalEntries: formattedEntries.length, unplacedHours };
      }

      default: // total
        return { view: 'total', entries: formattedEntries, allTimeBlocks, totalEntries: formattedEntries.length, unplacedHours };
    }
  }
}
