import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { DayOfWeek, ScheduleMode, TimeBlockType } from '@prisma/client';

export interface GenerationOptions {
  academicYearId: string;
  shiftId?: string;              // Si se especifica, solo genera para grupos de esta jornada
  groupIds?: string[];           // Si vacío, genera para todos los grupos (del shift si se indica)
  clearExisting?: boolean;       // Limpiar horario existente antes de generar (solo del shift/grupos objetivo)
  respectAvailability?: boolean; // Respetar disponibilidad docente
  maxAttempts?: number;          // Intentos máximos del algoritmo
  activeDays?: DayOfWeek[];      // Días activos (default: L-V)
  groupTeacherBlocks?: boolean;  // Agrupar bloques de un mismo docente consecutivamente en el día
}

export interface GenerationResult {
  success: boolean;
  totalAssignments: number;
  placedHours: number;
  unplacedHours: number;
  createdInDb?: number;
  failedInDb?: number;
  conflicts: string[];
  details: GroupGenerationDetail[];
}

export interface GroupGenerationDetail {
  groupId: string;
  groupName: string;
  totalHoursNeeded: number;
  hoursPlaced: number;
  hoursUnplaced: number;
  unplacedSubjects: { subjectName: string; teacherName: string; hoursNeeded: number; hoursPlaced: number }[];
}

interface SlotKey {
  dayOfWeek: DayOfWeek;
  timeBlockId: string;
}

interface Assignment {
  id: string;
  teacherId: string;
  teacherName: string;
  subjectId: string;
  subjectName: string;
  groupId: string;
  groupName: string;
  weeklyHours: number;
}

const DAYS: DayOfWeek[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
const DAY_LABELS: Record<DayOfWeek, string> = {
  MONDAY: 'Lunes',
  TUESDAY: 'Martes',
  WEDNESDAY: 'Miércoles',
  THURSDAY: 'Jueves',
  FRIDAY: 'Viernes',
  SATURDAY: 'Sábado',
};

@Injectable()
export class ScheduleGeneratorService {
  constructor(private prisma: PrismaService) {}

  /**
   * Genera automáticamente el horario para los grupos especificados.
   * Utiliza un algoritmo greedy con heurísticas de constraint satisfaction.
   */
  async generateSchedule(
    institutionId: string,
    options: GenerationOptions,
  ): Promise<GenerationResult> {
    const { academicYearId, shiftId, groupIds, clearExisting = true, respectAvailability = true, activeDays, groupTeacherBlocks = true } = options;
    const daysToUse: DayOfWeek[] = activeDays && activeDays.length > 0 ? activeDays : DAYS;

    console.log('[ScheduleGenerator] Starting generation with options:', {
      institutionId, academicYearId, shiftId, groupIds, clearExisting, activeDays: daysToUse,
    });

    // 1. Obtener grupos objetivo (filtrados por shiftId si se especifica)
    // getTargetGroups throws if no groups found with diagnostic info
    const groups = await this.getTargetGroups(institutionId, academicYearId, groupIds, shiftId);
    console.log('[ScheduleGenerator] Found groups:', groups.length, groups.map(g => ({ id: g.id, name: g.name, shiftId: g.shiftId })));

    // 2. Obtener TeacherAssignments para esos grupos
    const assignments = await this.getAssignments(academicYearId, groups.map(g => g.id));
    console.log('[ScheduleGenerator] Found assignments:', assignments.length, assignments.slice(0, 3).map(a => ({ subject: a.subjectName, group: a.groupName, hours: a.weeklyHours })));
    if (assignments.length === 0) {
      throw new BadRequestException('No hay asignaciones docente-materia-grupo. Importe la carga académica primero.');
    }

    // 3. Obtener bloques de tiempo por grupo (según su jornada/shift)
    const groupTimeBlocks = await this.getGroupTimeBlocks(institutionId, groups);
    console.log('[ScheduleGenerator] TimeBlocks per group:', Array.from(groupTimeBlocks.entries()).map(([gid, blocks]) => ({ groupId: gid, blocksCount: blocks.length, types: blocks.map(b => b.type) })));

    // 4. Obtener disponibilidad docente
    const teacherAvailability = respectAvailability
      ? await this.getTeacherAvailability(institutionId, academicYearId)
      : new Map();

    // 5. Obtener configuración de horario por grado
    const gradeConfigs = await this.getGradeConfigs(institutionId, academicYearId);

    // 5.5 Obtener rooms disponibles para auto-asignación
    const groupRoomMap = await this.getGroupRoomMap(institutionId, groups);

    // 6. Limpiar horario existente si se indica
    if (clearExisting) {
      await this.prisma.scheduleEntry.deleteMany({
        where: {
          institutionId,
          academicYearId,
          groupId: { in: groups.map(g => g.id) },
        },
      });
    }

    // Verificar que hay bloques de tiempo disponibles
    let totalClassBlocks = 0;
    for (const [groupId, blocks] of groupTimeBlocks.entries()) {
      totalClassBlocks += blocks.length;
    }
    console.log('[ScheduleGenerator] Total CLASS blocks across all groups:', totalClassBlocks);

    if (totalClassBlocks === 0) {
      console.error('[ScheduleGenerator] No CLASS blocks found for any group!');
      return {
        success: false,
        totalAssignments: assignments.length,
        placedHours: 0,
        unplacedHours: assignments.reduce((sum, a) => sum + a.weeklyHours, 0),
        conflicts: ['No hay bloques de tiempo de tipo CLASS configurados para la jornada. Configure el horario primero.'],
        details: [],
      };
    }

    // 7. Ejecutar algoritmo de generación
    const result = await this.runGenerator(
      institutionId,
      academicYearId,
      groups,
      assignments,
      groupTimeBlocks,
      teacherAvailability,
      gradeConfigs,
      groupRoomMap,
      daysToUse,
      groupTeacherBlocks,
    );

    console.log('[ScheduleGenerator] Generation result:', {
      success: result.success,
      placedHours: result.placedHours,
      unplacedHours: result.unplacedHours,
      createdInDb: result.createdInDb,
      failedInDb: result.failedInDb,
      conflictsCount: result.conflicts.length,
    });

    return result;
  }

  private async getTargetGroups(institutionId: string, academicYearId: string, groupIds?: string[], shiftId?: string) {
    const groups = await this.prisma.group.findMany({
      where: {
        shift: { campus: { institutionId } },
        teacherAssignments: { some: { academicYearId } },
        ...(shiftId ? { shiftId } : {}),
        ...(groupIds?.length ? { id: { in: groupIds } } : {}),
      },
      include: {
        grade: true,
        shift: true,
      },
    });

    // If no groups found, log diagnostics and give specific error
    if (groups.length === 0) {
      const allGroupsForShift = shiftId
        ? await this.prisma.group.count({ where: { shiftId, shift: { campus: { institutionId } } } })
        : 0;
      const assignmentsForShift = shiftId
        ? await this.prisma.teacherAssignment.count({
            where: { academicYearId, group: { shiftId, shift: { campus: { institutionId } } } },
          })
        : 0;
      const allGroupsWithAssignments = await this.prisma.group.count({
        where: {
          shift: { campus: { institutionId } },
          teacherAssignments: { some: { academicYearId } },
        },
      });
      console.error('[ScheduleGenerator] No groups found! Diagnostics:', {
        shiftId,
        groupIds,
        totalGroupsForShift: allGroupsForShift,
        assignmentsForShift,
        totalGroupsWithAssignments: allGroupsWithAssignments,
      });

      // Give specific error message based on diagnostics
      if (shiftId && allGroupsForShift > 0 && assignmentsForShift === 0) {
        throw new BadRequestException(
          `La jornada tiene ${allGroupsForShift} grupos pero ninguno tiene carga académica importada para este año. Importe la carga académica primero.`,
        );
      } else if (shiftId && allGroupsForShift === 0) {
        throw new BadRequestException(
          'No hay grupos asignados a esta jornada. Configure los grupos en Estructura Organizacional.',
        );
      } else {
        throw new BadRequestException(
          `No se encontraron grupos con carga académica. Hay ${allGroupsWithAssignments} grupos con asignaciones en otras jornadas.`,
        );
      }
    }

    return groups;
  }

  private async getAssignments(academicYearId: string, groupIds: string[]): Promise<Assignment[]> {
    const raw = await this.prisma.teacherAssignment.findMany({
      where: { academicYearId, groupId: { in: groupIds } },
      include: {
        teacher: { select: { id: true, firstName: true, lastName: true } },
        subject: { select: { id: true, name: true } },
        group: { select: { id: true, name: true } },
      },
    });

    return raw.map(a => ({
      id: a.id,
      teacherId: a.teacherId,
      teacherName: `${a.teacher.firstName || ''} ${a.teacher.lastName || ''}`.trim() || 'Docente',
      subjectId: a.subjectId,
      subjectName: a.subject.name,
      groupId: a.groupId,
      groupName: a.group.name,
      weeklyHours: a.weeklyHours || 0,
    }));
  }

  private async getGroupTimeBlocks(institutionId: string, groups: any[]) {
    const result = new Map<string, any[]>();

    for (const group of groups) {
      if (!group.shiftId && !group.shift?.id) {
        console.log(`[ScheduleGenerator] Group ${group.name} has no shiftId, skipping`);
        continue;
      }
      const shiftId = group.shiftId || group.shift?.id;

      const blocks = await this.prisma.timeBlock.findMany({
        where: { institutionId, shiftId },
        orderBy: { order: 'asc' },
      });

      console.log(`[ScheduleGenerator] Group ${group.name} (shift ${shiftId}): found ${blocks.length} total blocks, types:`, blocks.map(b => b.type));

      // Solo bloques de tipo CLASS son asignables
      const classBlocks = blocks.filter(b => b.type === 'CLASS');
      console.log(`[ScheduleGenerator] Group ${group.name}: ${classBlocks.length} CLASS blocks available`);
      result.set(group.id, classBlocks);
    }

    return result;
  }

  private async getTeacherAvailability(institutionId: string, academicYearId: string) {
    const availabilities = await this.prisma.teacherAvailability.findMany({
      where: { institutionId, academicYearId, isAvailable: false },
    });

    // Map: teacherId -> Set of "DAY-startTime-endTime" unavailable slots
    const map = new Map<string, { dayOfWeek: DayOfWeek; startTime: string; endTime: string }[]>();
    for (const av of availabilities) {
      if (!map.has(av.teacherId)) map.set(av.teacherId, []);
      map.get(av.teacherId)!.push({
        dayOfWeek: av.dayOfWeek,
        startTime: av.startTime,
        endTime: av.endTime,
      });
    }
    return map;
  }

  private async getGradeConfigs(institutionId: string, academicYearId: string) {
    const configs = await this.prisma.scheduleGradeConfig.findMany({
      where: { institutionId, academicYearId },
    });
    const map = new Map<string, any>();
    for (const c of configs) {
      map.set(c.gradeId, c);
    }
    return map;
  }

  /**
   * Algoritmo principal de generación de horario.
   * Greedy con heurísticas:
   * 1. Ordena asignaciones por restricción (docentes más ocupados primero)
   * 2. Distribuye horas a lo largo de la semana
   * 3. Evita choques de docentes y grupos
   * 4. Respeta disponibilidad y configuraciones
   */
  private async getGroupRoomMap(institutionId: string, groups: any[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    const usedRoomIds = new Set<string>(); // Evitar asignar el mismo salón a múltiples grupos
    const rooms = await this.prisma.room.findMany({
      where: { institutionId, isActive: true },
      select: { id: true, name: true },
    });

    for (const group of groups) {
      // Buscar room con nombre exacto "Salón {grupo}" (ej: "Salón 6A" para grupo "6A")
      const gName = group.name.toLowerCase();
      const match = rooms.find(r => {
        if (usedRoomIds.has(r.id)) return false; // Ya asignado a otro grupo
        const rName = r.name.toLowerCase();
        return rName === `salón ${gName}` || rName === `salon ${gName}` || rName === gName;
      });
      if (match) {
        map.set(group.id, match.id);
        usedRoomIds.add(match.id);
      }
    }
    return map;
  }

  private async runGenerator(
    institutionId: string,
    academicYearId: string,
    groups: any[],
    assignments: Assignment[],
    groupTimeBlocks: Map<string, any[]>,
    teacherAvailability: Map<string, any[]>,
    gradeConfigs: Map<string, any>,
    groupRoomMap: Map<string, string>,
    activeDays: DayOfWeek[],
    groupTeacherBlocks: boolean = true,
  ): Promise<GenerationResult> {
    // Estado: slots ocupados
    // teacherSlots: teacherId -> Set<"DAY|timeBlockId">
    // groupSlots: groupId -> Set<"DAY|timeBlockId">
    const teacherSlots = new Map<string, Set<string>>();
    const groupSlots = new Map<string, Set<string>>();

    // Resultado: entries a crear en batch
    const entriesToCreate: any[] = [];
    const conflicts: string[] = [];
    const details: GroupGenerationDetail[] = [];

    // Calcular carga total por docente para ordenar por dificultad
    const teacherLoad = new Map<string, number>();
    for (const a of assignments) {
      teacherLoad.set(a.teacherId, (teacherLoad.get(a.teacherId) || 0) + a.weeklyHours);
    }

    // Ordenar asignaciones: docentes más cargados primero (más difícil de ubicar)
    const sortedAssignments = [...assignments].sort((a, b) => {
      const loadDiff = (teacherLoad.get(b.teacherId) || 0) - (teacherLoad.get(a.teacherId) || 0);
      if (loadDiff !== 0) return loadDiff;
      return b.weeklyHours - a.weeklyHours;
    });

    // Track horas colocadas por asignación
    const placedPerAssignment = new Map<string, number>();

    // ═══════════════════════════════════════════════════════
    // FASE 4: FIXED_TEACHER — director de grupo cubre todos los bloques
    // ═══════════════════════════════════════════════════════
    const fixedTeacherGroupIds = new Set<string>();
    for (const group of groups) {
      const config = gradeConfigs.get(group.grade?.id || '');
      if (config?.mode === ScheduleMode.FIXED_TEACHER) {
        fixedTeacherGroupIds.add(group.id);
      }
    }

    if (fixedTeacherGroupIds.size > 0) {
      for (const group of groups) {
        if (!fixedTeacherGroupIds.has(group.id)) continue;
        const groupAssignments = sortedAssignments.filter(a => a.groupId === group.id);
        const classBlocks = groupTimeBlocks.get(group.id) || [];
        this.placeFixedTeacherGroup(
          institutionId, academicYearId, group, groupAssignments, classBlocks,
          teacherSlots, groupSlots, teacherAvailability, groupRoomMap,
          activeDays, entriesToCreate, conflicts, placedPerAssignment,
        );
      }
    }

    // Para cada asignación ROTATING_TEACHER, intentar colocar las horas semanales
    for (const assignment of sortedAssignments) {
      if (fixedTeacherGroupIds.has(assignment.groupId)) continue; // ya procesado
      if (assignment.weeklyHours <= 0) continue;

      const timeBlocks = groupTimeBlocks.get(assignment.groupId);
      if (!timeBlocks || timeBlocks.length === 0) {
        conflicts.push(`Grupo ${assignment.groupName}: no tiene bloques de tiempo configurados`);
        continue;
      }

      const gradeConfig = gradeConfigs.get(
        groups.find(g => g.id === assignment.groupId)?.grade?.id || '',
      );

      let hoursPlaced = 0;
      const targetHours = assignment.weeklyHours;

      // Calcular slots disponibles por día para distribución
      const availableSlotsByDay = this.getAvailableSlots(
        assignment,
        timeBlocks,
        teacherSlots,
        groupSlots,
        teacherAvailability,
        activeDays,
      );

      // Estrategia de distribución: preferir días con más slots libres para balancear la semana
      const daysWithSlots = activeDays
        .filter(day => (availableSlotsByDay.get(day)?.length || 0) > 0)
        .sort((a, b) => (availableSlotsByDay.get(b)?.length || 0) - (availableSlotsByDay.get(a)?.length || 0));

      if (daysWithSlots.length === 0) {
        conflicts.push(
          `${assignment.subjectName} (${assignment.groupName}): no hay slots disponibles para ${assignment.teacherName}`,
        );
        placedPerAssignment.set(assignment.id, 0);
        continue;
      }

      // Distribuir horas entre días
      const maxPerDay = gradeConfig?.maxConsecutiveHours || 2;
      const preferDistribution = gradeConfig?.preferDistribution !== false;
      const allowDouble = gradeConfig?.allowDoubleBlocks !== false;

      // Calcular cuántas horas por día
      const hoursPerDay = this.distributeHours(targetHours, daysWithSlots.length, maxPerDay, preferDistribution);

      let dayIndex = 0;
      for (const day of daysWithSlots) {
        if (hoursPlaced >= targetHours) break;

        let daySlots = availableSlotsByDay.get(day) || [];
        const hoursForThisDay = hoursPerDay[dayIndex] || 0;
        dayIndex++;
        if (hoursForThisDay === 0) continue;

        // Si groupTeacherBlocks está activado, ordenar slots priorizando
        // los adyacentes a clases que el docente ya tiene colocadas ese día
        if (groupTeacherBlocks) {
          const teacherDayEntries = entriesToCreate.filter(
            e => e.dayOfWeek === day && assignments.find(a => a.id === e.teacherAssignmentId)?.teacherId === assignment.teacherId,
          );
          if (teacherDayEntries.length > 0) {
            const occupiedOrders = teacherDayEntries.map(e => {
              const tb = timeBlocks.find(b => b.id === e.timeBlockId);
              return tb?.order ?? -1;
            }).filter(o => o >= 0);
            // Ordenar slots: los más cercanos a bloques ocupados del docente primero
            daySlots = [...daySlots].sort((a, b) => {
              const distA = Math.min(...occupiedOrders.map(o => Math.abs(a.order - o)));
              const distB = Math.min(...occupiedOrders.map(o => Math.abs(b.order - o)));
              return distA - distB;
            });
          }
        }

        // Helper: verificar y marcar un slot
        const canUseSlot = (slot: any) => {
          const slotKey = `${day}|${slot.id}`;
          return !this.isSlotTaken(assignment.teacherId, slotKey, teacherSlots) &&
                 !this.isSlotTaken(assignment.groupId, slotKey, groupSlots);
        };
        const placeSlot = (slot: any) => {
          const slotKey = `${day}|${slot.id}`;
          if (!teacherSlots.has(assignment.teacherId)) teacherSlots.set(assignment.teacherId, new Set());
          if (!groupSlots.has(assignment.groupId)) groupSlots.set(assignment.groupId, new Set());
          teacherSlots.get(assignment.teacherId)!.add(slotKey);
          groupSlots.get(assignment.groupId)!.add(slotKey);
          entriesToCreate.push({
            institutionId, academicYearId,
            groupId: assignment.groupId,
            timeBlockId: slot.id,
            dayOfWeek: day,
            teacherAssignmentId: assignment.id,
            roomId: groupRoomMap.get(assignment.groupId) || null,
          });
          hoursPlaced++;
        };

        let placedThisDay = 0;

        // Si necesitamos 2h este día, buscar par CONSECUTIVO primero
        if (hoursForThisDay >= 2) {
          const sortedDaySlots = [...daySlots].sort((a, b) => a.order - b.order);
          for (let i = 0; i < sortedDaySlots.length - 1; i++) {
            const s1 = sortedDaySlots[i];
            const s2 = sortedDaySlots[i + 1];
            if (Math.abs(s1.order - s2.order) === 1 && canUseSlot(s1) && canUseSlot(s2)) {
              placeSlot(s1);
              placeSlot(s2);
              placedThisDay = 2;
              break;
            }
          }
          // Si no hay par consecutivo, colocar 1h suelta en vez de perder el día
          if (placedThisDay === 0) {
            for (const slot of daySlots) {
              if (hoursPlaced >= targetHours) break;
              if (canUseSlot(slot)) {
                placeSlot(slot);
                placedThisDay++;
                break; // Solo 1h como fallback
              }
            }
          }
        } else if (hoursForThisDay === 1) {
          // 1h planificada: colocar siempre (tanto pares como impares)
          for (const slot of daySlots) {
            if (placedThisDay >= 1 || hoursPlaced >= targetHours) break;
            if (canUseSlot(slot)) {
              placeSlot(slot);
              placedThisDay++;
            }
          }
        }
      }

      // ═══ PHASE B: Retry — buscar bloques dobles en días aún disponibles ═══
      if (hoursPlaced < targetHours) {
        const retrySlots = this.getAvailableSlots(
          assignment, timeBlocks, teacherSlots, groupSlots, teacherAvailability, activeDays,
        );

        for (const day of activeDays) {
          if (hoursPlaced >= targetHours) break;
          const remaining = targetHours - hoursPlaced;
          const daySlots = retrySlots.get(day) || [];
          const alreadyThisDay = entriesToCreate.filter(
            e => e.teacherAssignmentId === assignment.id && e.dayOfWeek === day,
          );
          if (alreadyThisDay.length >= 2) continue; // max 2h/day per subject

          const placeOne = (slot: any) => {
            const sk = `${day}|${slot.id}`;
            if (!teacherSlots.has(assignment.teacherId)) teacherSlots.set(assignment.teacherId, new Set());
            if (!groupSlots.has(assignment.groupId)) groupSlots.set(assignment.groupId, new Set());
            teacherSlots.get(assignment.teacherId)!.add(sk);
            groupSlots.get(assignment.groupId)!.add(sk);
            entriesToCreate.push({
              institutionId, academicYearId,
              groupId: assignment.groupId,
              timeBlockId: slot.id,
              dayOfWeek: day,
              teacherAssignmentId: assignment.id,
              roomId: groupRoomMap.get(assignment.groupId) || null,
            });
            hoursPlaced++;
          };

          const availSlots = daySlots.filter(slot => {
            const sk = `${day}|${slot.id}`;
            return !this.isSlotTaken(assignment.teacherId, sk, teacherSlots) &&
                   !this.isSlotTaken(assignment.groupId, sk, groupSlots);
          });

          if (alreadyThisDay.length === 1 && remaining >= 1) {
            // Try adjacent to existing
            const existingBlock = timeBlocks.find(tb => tb.id === alreadyThisDay[0].timeBlockId);
            if (existingBlock) {
              const adj = availSlots.find(s => Math.abs(s.order - existingBlock.order) === 1);
              if (adj) { placeOne(adj); continue; }
            }
          }

          if (alreadyThisDay.length === 0) {
            // Try double first
            if (remaining >= 2) {
              const sorted = [...availSlots].sort((a, b) => a.order - b.order);
              let placedPair = false;
              for (let i = 0; i < sorted.length - 1; i++) {
                if (Math.abs(sorted[i].order - sorted[i+1].order) === 1) {
                  placeOne(sorted[i]);
                  placeOne(sorted[i+1]);
                  placedPair = true;
                  break;
                }
              }
              if (placedPair) continue;
            }
            // Fallback: place single
            if (availSlots.length > 0 && hoursPlaced < targetHours) {
              placeOne(availSlots[0]);
            }
          }
        }
      }

      // ═══ PHASE C: Desperate — place ANY remaining hours in ANY available slot ═══
      // At this point we don't care about double blocks, just fill every slot possible
      if (hoursPlaced < targetHours) {
        for (const day of activeDays) {
          if (hoursPlaced >= targetHours) break;
          // Re-count entries for this day (including those added in phases A and B)
          const countThisDay = entriesToCreate.filter(
            e => e.teacherAssignmentId === assignment.id && e.dayOfWeek === day,
          ).length;
          if (countThisDay >= 2) continue; // max 2h/day per subject

          const classBlocks = (groupTimeBlocks.get(assignment.groupId) || []);
          for (const block of classBlocks) {
            if (hoursPlaced >= targetHours) break;
            const placed = entriesToCreate.filter(
              e => e.teacherAssignmentId === assignment.id && e.dayOfWeek === day,
            ).length;
            if (placed >= 2) break;
            const sk = `${day}|${block.id}`;
            if (this.isSlotTaken(assignment.teacherId, sk, teacherSlots) ||
                this.isSlotTaken(assignment.groupId, sk, groupSlots)) continue;
            if (!teacherSlots.has(assignment.teacherId)) teacherSlots.set(assignment.teacherId, new Set());
            if (!groupSlots.has(assignment.groupId)) groupSlots.set(assignment.groupId, new Set());
            teacherSlots.get(assignment.teacherId)!.add(sk);
            groupSlots.get(assignment.groupId)!.add(sk);
            entriesToCreate.push({
              institutionId, academicYearId,
              groupId: assignment.groupId,
              timeBlockId: block.id,
              dayOfWeek: day,
              teacherAssignmentId: assignment.id,
              roomId: groupRoomMap.get(assignment.groupId) || null,
            });
            hoursPlaced++;
          }
        }
      }

      placedPerAssignment.set(assignment.id, hoursPlaced);

      if (hoursPlaced < targetHours) {
        conflicts.push(
          `${assignment.subjectName} (${assignment.groupName}, ${assignment.teacherName}): solo se ubicaron ${hoursPlaced}/${targetHours} horas`,
        );
      }
    }

    // Crear entries en batch
    let createdCount = 0;
    let failedCount = 0;
    console.log(`[ScheduleGenerator] Creating ${entriesToCreate.length} schedule entries in DB...`);
    for (const entry of entriesToCreate) {
      try {
        await this.prisma.scheduleEntry.create({ data: entry });
        createdCount++;
      } catch (e: any) {
        failedCount++;
        // Conflicto de unique constraint - slot ya ocupado
        if (e.code === 'P2002') {
          conflicts.push(`Conflicto de duplicado: grupo ${entry.groupId}, bloque ${entry.timeBlockId}, día ${entry.dayOfWeek}`);
        } else {
          console.error(`[ScheduleGenerator] DB create error:`, e.message, entry);
          conflicts.push(`Error al crear entrada: ${e.message}`);
        }
      }
    }
    console.log(`[ScheduleGenerator] DB results: ${createdCount} created, ${failedCount} failed of ${entriesToCreate.length} total`);

    // Compilar detalles por grupo
    const groupMap = new Map<string, GroupGenerationDetail>();
    for (const group of groups) {
      groupMap.set(group.id, {
        groupId: group.id,
        groupName: group.name,
        totalHoursNeeded: 0,
        hoursPlaced: 0,
        hoursUnplaced: 0,
        unplacedSubjects: [],
      });
    }

    for (const assignment of assignments) {
      if (assignment.weeklyHours <= 0) continue;
      const detail = groupMap.get(assignment.groupId);
      if (!detail) continue;

      const placed = placedPerAssignment.get(assignment.id) || 0;
      detail.totalHoursNeeded += assignment.weeklyHours;
      detail.hoursPlaced += placed;
      detail.hoursUnplaced += (assignment.weeklyHours - placed);

      if (placed < assignment.weeklyHours) {
        detail.unplacedSubjects.push({
          subjectName: assignment.subjectName,
          teacherName: assignment.teacherName,
          hoursNeeded: assignment.weeklyHours,
          hoursPlaced: placed,
        });
      }
    }

    const detailsList = Array.from(groupMap.values());
    const totalPlaced = detailsList.reduce((s, d) => s + d.hoursPlaced, 0);
    const totalNeeded = detailsList.reduce((s, d) => s + d.totalHoursNeeded, 0);

    // If DB inserts failed, adjust the result to reflect actual DB state
    if (failedCount > 0) {
      conflicts.push(`⚠️ ${failedCount} entradas no se pudieron guardar en la base de datos. Horas realmente guardadas: ${createdCount}`);
    }

    return {
      success: totalPlaced === totalNeeded && failedCount === 0,
      totalAssignments: assignments.filter(a => a.weeklyHours > 0).length,
      placedHours: totalPlaced,
      unplacedHours: totalNeeded - totalPlaced,
      createdInDb: createdCount,
      failedInDb: failedCount,
      conflicts,
      details: detailsList,
    };
  }

  /**
   * Obtiene los slots disponibles por día para una asignación.
   */
  private getAvailableSlots(
    assignment: Assignment,
    timeBlocks: any[],
    teacherSlots: Map<string, Set<string>>,
    groupSlots: Map<string, Set<string>>,
    teacherAvailability: Map<string, any[]>,
    activeDays: DayOfWeek[],
  ): Map<DayOfWeek, any[]> {
    const result = new Map<DayOfWeek, any[]>();
    const unavailablePeriods = teacherAvailability.get(assignment.teacherId) || [];

    for (const day of activeDays) {
      const availableBlocks: any[] = [];

      for (const block of timeBlocks) {
        const slotKey = `${day}|${block.id}`;

        // Verificar si el docente ya está ocupado en este slot
        if (this.isSlotTaken(assignment.teacherId, slotKey, teacherSlots)) continue;

        // Verificar si el grupo ya está ocupado en este slot
        if (this.isSlotTaken(assignment.groupId, slotKey, groupSlots)) continue;

        // Verificar disponibilidad del docente
        const isUnavailable = unavailablePeriods.some(
          ua => ua.dayOfWeek === day && ua.startTime <= block.startTime && ua.endTime >= block.endTime,
        );
        if (isUnavailable) continue;

        availableBlocks.push(block);
      }

      if (availableBlocks.length > 0) {
        result.set(day, availableBlocks);
      }
    }

    return result;
  }

  private isSlotTaken(entityId: string, slotKey: string, slotsMap: Map<string, Set<string>>): boolean {
    return slotsMap.get(entityId)?.has(slotKey) || false;
  }

  /**
   * FASE 4: FIXED_TEACHER — el director de grupo ocupa todos los bloques de clase.
   * Distribuye los sujetos de forma greedy (mayor remaining primero) para equilibrar la semana.
   */
  private placeFixedTeacherGroup(
    institutionId: string,
    academicYearId: string,
    group: any,
    groupAssignments: Assignment[],
    classBlocks: any[],
    teacherSlots: Map<string, Set<string>>,
    groupSlots: Map<string, Set<string>>,
    teacherAvailability: Map<string, any[]>,
    groupRoomMap: Map<string, string>,
    activeDays: DayOfWeek[],
    entriesToCreate: any[],
    conflicts: string[],
    placedPerAssignment: Map<string, number>,
  ): void {
    const remaining = new Map<string, number>();
    for (const a of groupAssignments) {
      if (a.weeklyHours > 0) remaining.set(a.id, a.weeklyHours);
      if (!placedPerAssignment.has(a.id)) placedPerAssignment.set(a.id, 0);
    }

    const totalNeeded = groupAssignments.reduce((s, a) => s + a.weeklyHours, 0);
    if (totalNeeded === 0 || classBlocks.length === 0) return;

    // Greedy: siempre asigna el sujeto con más horas restantes (distribución uniforme)
    const getNext = (): Assignment | null => {
      let best: Assignment | null = null;
      let bestRem = 0;
      for (const a of groupAssignments) {
        const rem = remaining.get(a.id) || 0;
        if (rem > bestRem) { bestRem = rem; best = a; }
      }
      return best;
    };

    const roomId = groupRoomMap.get(group.id) || null;

    outer: for (const day of activeDays) {
      for (const block of classBlocks) {
        const next = getNext();
        if (!next) break outer;

        const slotKey = `${day}|${block.id}`;
        if (this.isSlotTaken(group.id, slotKey, groupSlots)) continue;

        const unavailable = (teacherAvailability.get(next.teacherId) || []).some(
          ua => ua.dayOfWeek === day && ua.startTime <= block.startTime && ua.endTime >= block.endTime,
        );
        if (unavailable) continue;

        if (!teacherSlots.has(next.teacherId)) teacherSlots.set(next.teacherId, new Set());
        if (!groupSlots.has(group.id)) groupSlots.set(group.id, new Set());
        teacherSlots.get(next.teacherId)!.add(slotKey);
        groupSlots.get(group.id)!.add(slotKey);

        entriesToCreate.push({
          institutionId, academicYearId,
          groupId: group.id,
          timeBlockId: block.id,
          dayOfWeek: day,
          teacherAssignmentId: next.id,
          roomId,
        });

        remaining.set(next.id, (remaining.get(next.id) || 1) - 1);
        placedPerAssignment.set(next.id, (placedPerAssignment.get(next.id) || 0) + 1);
      }
    }

    for (const a of groupAssignments) {
      const placed = placedPerAssignment.get(a.id) || 0;
      if (placed < a.weeklyHours) {
        conflicts.push(
          `${a.subjectName} (${group.name}, ${a.teacherName}): ${placed}/${a.weeklyHours} horas [FIXED_TEACHER]`,
        );
      }
    }
  }

  /**
   * Distribuye N horas entre D días disponibles.
   * Reglas:
   *  - Máximo 2 horas de la misma materia por día (nunca 3+)
   *  - Preferir bloques de 2h sobre horas sueltas de 1h
   *  - Usar el menor número de días posible
   * Ejemplo: 4h→[2,2], 5h→[2,2,1], 3h→[2,1], 6h→[2,2,2], 1h→[1]
   */
  private distributeHours(totalHours: number, numDays: number, maxPerDay: number, _preferDistribution: boolean): number[] {
    const cap = Math.min(maxPerDay, 2); // Hard cap: nunca más de 2h/día de la misma materia
    const result: number[] = new Array(numDays).fill(0);

    let remaining = totalHours;

    // 1. Llenar con bloques de 2h primero (preferencia principal)
    for (let i = 0; i < numDays && remaining >= 2; i++) {
      result[i] = Math.min(2, cap);
      remaining -= result[i];
    }

    // 2. Si queda 1h, colocarla en un día nuevo (no agregar a un día que ya tiene 2h)
    if (remaining === 1) {
      // Buscar un día vacío
      const emptyDay = result.findIndex(h => h === 0);
      if (emptyDay >= 0) {
        result[emptyDay] = 1;
        remaining = 0;
      } else {
        // No hay días vacíos, usar el primer día con espacio
        const spaceDay = result.findIndex(h => h < cap);
        if (spaceDay >= 0) {
          result[spaceDay]++;
          remaining = 0;
        }
      }
    }

    return result;
  }
}
