import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { DayOfWeek, TimeBlockType } from '@prisma/client';

export interface GenerationOptions {
  academicYearId: string;
  groupIds?: string[];           // Si vacío, genera para todos los grupos
  clearExisting?: boolean;       // Limpiar horario existente antes de generar
  respectAvailability?: boolean; // Respetar disponibilidad docente
  maxAttempts?: number;          // Intentos máximos del algoritmo
  activeDays?: DayOfWeek[];      // Días activos (default: L-V)
}

export interface GenerationResult {
  success: boolean;
  totalAssignments: number;
  placedHours: number;
  unplacedHours: number;
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
    const { academicYearId, groupIds, clearExisting = true, respectAvailability = true, activeDays } = options;
    const daysToUse: DayOfWeek[] = activeDays && activeDays.length > 0 ? activeDays : DAYS;

    // 1. Obtener grupos objetivo
    const groups = await this.getTargetGroups(institutionId, academicYearId, groupIds);
    if (groups.length === 0) {
      throw new BadRequestException('No se encontraron grupos para generar horarios');
    }

    // 2. Obtener TeacherAssignments para esos grupos
    const assignments = await this.getAssignments(academicYearId, groups.map(g => g.id));
    if (assignments.length === 0) {
      throw new BadRequestException('No hay asignaciones docente-materia-grupo. Importe la carga académica primero.');
    }

    // 3. Obtener bloques de tiempo por grupo (según su jornada/shift)
    const groupTimeBlocks = await this.getGroupTimeBlocks(institutionId, groups);

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
    );

    return result;
  }

  private async getTargetGroups(institutionId: string, academicYearId: string, groupIds?: string[]) {
    return this.prisma.group.findMany({
      where: {
        shift: { campus: { institutionId } },
        teacherAssignments: { some: { academicYearId } },
        ...(groupIds?.length ? { id: { in: groupIds } } : {}),
      },
      include: {
        grade: { select: { id: true, name: true } },
        shift: { select: { id: true, name: true, type: true } },
      },
    });
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
      if (!group.shiftId && !group.shift?.id) continue;
      const shiftId = group.shiftId || group.shift?.id;

      const blocks = await this.prisma.timeBlock.findMany({
        where: { institutionId, shiftId },
        orderBy: { order: 'asc' },
      });

      // Solo bloques de tipo CLASS son asignables
      const classBlocks = blocks.filter(b => b.type === 'CLASS');
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
    const rooms = await this.prisma.room.findMany({
      where: { institutionId, isActive: true },
      select: { id: true, name: true },
    });

    for (const group of groups) {
      // Buscar room con nombre exacto "Salón {grupo}" (ej: "Salón 6A" para grupo "6A")
      const gName = group.name.toLowerCase();
      const match = rooms.find(r => {
        const rName = r.name.toLowerCase();
        return rName === `salón ${gName}` || rName === `salon ${gName}` || rName === gName;
      });
      if (match) {
        map.set(group.id, match.id);
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

    // Para cada asignación, intentar colocar las horas semanales
    for (const assignment of sortedAssignments) {
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

      // Estrategia de distribución: repartir horas equitativamente entre días
      const daysWithSlots = activeDays.filter(day => (availableSlotsByDay.get(day)?.length || 0) > 0);

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

        const daySlots = availableSlotsByDay.get(day) || [];
        const hoursForThisDay = hoursPerDay[dayIndex] || 0;
        dayIndex++;
        if (hoursForThisDay === 0) continue;

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
        if (hoursForThisDay === 2) {
          let foundPair = false;
          for (let i = 0; i < daySlots.length - 1; i++) {
            const s1 = daySlots[i];
            const s2 = daySlots[i + 1];
            // Consecutivos = órdenes adyacentes (diferencia de 1)
            if (Math.abs(s1.order - s2.order) === 1 && canUseSlot(s1) && canUseSlot(s2)) {
              placeSlot(s1);
              placeSlot(s2);
              placedThisDay = 2;
              foundPair = true;
              break;
            }
          }
          // Fallback: si no hay par consecutivo, colocar sueltos
          if (!foundPair) {
            for (const slot of daySlots) {
              if (placedThisDay >= hoursForThisDay || hoursPlaced >= targetHours) break;
              if (canUseSlot(slot)) {
                placeSlot(slot);
                placedThisDay++;
              }
            }
          }
        } else {
          // 1h: colocar en cualquier slot disponible
          for (const slot of daySlots) {
            if (placedThisDay >= hoursForThisDay || hoursPlaced >= targetHours) break;
            if (canUseSlot(slot)) {
              placeSlot(slot);
              placedThisDay++;
            }
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
    for (const entry of entriesToCreate) {
      try {
        await this.prisma.scheduleEntry.create({ data: entry });
        createdCount++;
      } catch (e: any) {
        // Conflicto de unique constraint - slot ya ocupado
        if (e.code === 'P2002') {
          conflicts.push(`Conflicto de duplicado al crear entrada de horario`);
        } else {
          conflicts.push(`Error al crear entrada: ${e.message}`);
        }
      }
    }

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

    return {
      success: totalPlaced === totalNeeded,
      totalAssignments: assignments.filter(a => a.weeklyHours > 0).length,
      placedHours: totalPlaced,
      unplacedHours: totalNeeded - totalPlaced,
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
