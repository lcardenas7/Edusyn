import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { CreateGradeDto } from './dto/create-grade.dto';
import { GradeStage, SchoolShift } from '@prisma/client';
import { GRADE_TEMPLATES, deriveGradeNumber, levelKey } from '../../common/utils/academic-level.util';

interface SyncGradeDto {
  id: string;
  name: string;
  level: string;
  order: number;
  groups: {
    id: string;
    name: string;
    shift: string;
    capacity: number;
  }[];
}

@Injectable()
export class GradesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Traduce errores de Prisma a errores HTTP con mensaje humano.
   * Antes, un choque de nombre reventaba como error crudo de Prisma → 500 y el
   * texto técnico llegaba tal cual al navegador del rector.
   */
  private asHttpError(e: any, gradeName?: string): Error {
    if (e?.code === 'P2002') {
      return new ConflictException(
        `Ya existe un grado llamado "${gradeName ?? ''}" en ese nivel educativo. Usa otro nombre.`,
      );
    }
    return e;
  }

  async create(dto: CreateGradeDto & { institutionId: string }) {
    try {
      return await this.prisma.grade.create({
        data: {
          institutionId: dto.institutionId,
          stage: dto.stage,
          // Si no viene el número, se deduce del nombre: dejarlo en NULL rompe el
          // cálculo del "grado siguiente" en la promoción.
          number: dto.number ?? deriveGradeNumber(dto.name),
          name: dto.name,
        },
      });
    } catch (e) {
      throw this.asHttpError(e, dto.name);
    }
  }

  /** Todos los grados de UNA institución (nunca global: sería fuga entre instituciones). */
  async list(institutionId: string) {
    return this.prisma.grade.findMany({
      where: { institutionId },
      orderBy: [{ stage: 'asc' }, { number: 'asc' }, { name: 'asc' }],
    });
  }

  // Administrativo: devuelve grados de la institución con sus grupos
  // Usado por: Structure.tsx, creación de grupos, administración
  async listByInstitution(institutionId: string) {
    return this.prisma.grade.findMany({
      where: { institutionId },
      include: {
        groups: {
          include: {
            campus: true,
            shift: true,
            director: { select: { id: true, firstName: true, lastName: true } },
          }
        }
      },
      orderBy: [{ stage: 'asc' }, { name: 'asc' }],
    });
  }

  // Operativo: solo grados que tienen al menos un grupo
  // Usado por: finanzas, filtros, reportes, módulos operativos
  async listActiveByInstitution(institutionId: string) {
    return this.prisma.grade.findMany({
      where: {
        institutionId,
        groups: { some: {} },
      },
      include: {
        groups: {
          include: {
            campus: true,
            shift: true,
            director: { select: { id: true, firstName: true, lastName: true } },
          }
        }
      },
      orderBy: [{ stage: 'asc' }, { name: 'asc' }],
    });
  }

  async update(id: string, institutionId: string, data: { name?: string; stage?: GradeStage; number?: number }) {
    // Verificar que el grado pertenece a esta institución
    const grade = await this.prisma.grade.findFirst({
      where: { id, institutionId },
    });
    if (!grade) {
      throw new NotFoundException('Grado no encontrado en esta institución.');
    }

    try {
      return await this.prisma.grade.update({
        where: { id },
        data: {
          ...(data.name && { name: data.name }),
          ...(data.stage && { stage: data.stage }),
          ...(data.number !== undefined && { number: data.number }),
        },
      });
    } catch (e) {
      throw this.asHttpError(e, data.name ?? grade.name);
    }
  }

  async delete(id: string, institutionId: string) {
    // Verificar que el grado pertenece a esta institución
    const grade = await this.prisma.grade.findFirst({
      where: { id, institutionId },
    });
    if (!grade) {
      throw new NotFoundException('Grado no encontrado en esta institución.');
    }

    // Contar grupos asociados
    const groupCount = await this.prisma.group.count({ where: { gradeId: id } });
    if (groupCount > 0) {
      throw new ConflictException(
        `No se puede eliminar el grado porque tiene ${groupCount} grupo(s) asociados. Elimina los grupos primero.`,
      );
    }

    return this.prisma.grade.delete({ where: { id } });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FASE 1 — La tabla de grados es la fuente única. Estas operaciones evitan
  // que el rector tenga que teclear grados uno por uno (y que queden sin número).
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Genera los grados estándar de un nivel educativo (Primaria → 1°…5°, etc.),
   * cada uno con su número ya puesto. Idempotente: omite los que ya existen
   * (por número o por nombre), así se puede volver a ejecutar sin duplicar.
   */
  async generateForStage(institutionId: string, stage: GradeStage) {
    const template = GRADE_TEMPLATES[stage];
    if (!template) {
      throw new BadRequestException(`Nivel educativo desconocido: ${stage}`);
    }

    const existing = await this.prisma.grade.findMany({
      where: { institutionId, stage },
      select: { name: true, number: true },
    });
    const takenNumbers = new Set(existing.filter((g) => g.number != null).map((g) => g.number));
    const takenNames = new Set(existing.map((g) => levelKey(g.name)));

    const toCreate = template.filter(
      (t) => !takenNumbers.has(t.number) && !takenNames.has(levelKey(t.name)),
    );

    if (toCreate.length > 0) {
      await this.prisma.grade.createMany({
        data: toCreate.map((t) => ({ institutionId, stage, number: t.number, name: t.name })),
        skipDuplicates: true,
      });
    }

    return {
      stage,
      created: toCreate.map((t) => t.name),
      skipped: template.length - toCreate.length,
      message:
        toCreate.length > 0
          ? `Se crearon ${toCreate.length} grado(s): ${toCreate.map((t) => t.name).join(', ')}.`
          : 'Este nivel ya tenía todos sus grados.',
    };
  }

  /**
   * Rellena el número de los grados que lo tengan vacío, deduciéndolo del nombre
   * ("Sexto" → 6). Sin número, la promoción no puede ordenar los grados y el
   * "grado siguiente" queda indefinido.
   */
  async backfillNumbers(institutionId: string) {
    const pending = await this.prisma.grade.findMany({
      where: { institutionId, number: null },
      select: { id: true, name: true },
    });

    const updated: { name: string; number: number }[] = [];
    const unresolved: string[] = [];

    for (const g of pending) {
      const n = deriveGradeNumber(g.name);
      if (n === null) {
        unresolved.push(g.name);
        continue;
      }
      await this.prisma.grade.update({ where: { id: g.id }, data: { number: n } });
      updated.push({ name: g.name, number: n });
    }

    return {
      updated,
      unresolved,
      message: `Se completaron ${updated.length} grado(s).${
        unresolved.length > 0
          ? ` ${unresolved.length} requieren número manual: ${unresolved.join(', ')}.`
          : ''
      }`,
    };
  }

  // Sincronizar grados y grupos desde el frontend
  async syncGradesAndGroups(institutionId: string, grades: SyncGradeDto[]) {
    // 1. Asegurar que existe un campus por defecto
    let campus = await this.prisma.campus.findFirst({
      where: { institutionId }
    });

    if (!campus) {
      const institution = await this.prisma.institution.findUnique({
        where: { id: institutionId }
      });
      campus = await this.prisma.campus.create({
        data: {
          institutionId,
          name: 'Sede Principal',
          address: institution?.address || '',
        }
      });
    }

    // 2. Asegurar que existen los shifts
    const shiftMap: Record<string, string> = {};
    const shiftTypes = [
      { name: 'MAÑANA', type: 'MORNING' as SchoolShift },
      { name: 'TARDE', type: 'AFTERNOON' as SchoolShift },
      { name: 'UNICA', type: 'SINGLE' as SchoolShift },
    ];

    for (const shiftDef of shiftTypes) {
      let shift = await this.prisma.shift.findFirst({
        where: { 
          campusId: campus.id,
          type: shiftDef.type
        }
      });
      if (!shift) {
        shift = await this.prisma.shift.create({
          data: {
            campusId: campus.id,
            name: `Jornada ${shiftDef.name}`,
            type: shiftDef.type,
          }
        });
      }
      shiftMap[shiftDef.name] = shift.id;
    }

    // 3. Mapear niveles a GradeStage
    const levelToStage: Record<string, GradeStage> = {
      'PREESCOLAR': GradeStage.PREESCOLAR,
      'PRIMARIA': GradeStage.BASICA_PRIMARIA,
      'SECUNDARIA': GradeStage.BASICA_SECUNDARIA,
      'MEDIA': GradeStage.MEDIA,
    };

    // 4. Crear/actualizar grados y grupos
    const results: { grade: string; groupsCount: number }[] = [];
    for (const gradeData of grades) {
      const stage = levelToStage[gradeData.level] || GradeStage.BASICA_PRIMARIA;

      // Buscar o crear el grado PARA ESTA INSTITUCIÓN
      let grade = await this.prisma.grade.findFirst({
        where: { institutionId, name: gradeData.name }
      });

      if (!grade) {
        grade = await this.prisma.grade.create({
          data: {
            institutionId,
            name: gradeData.name,
            stage,
            number: gradeData.order,
          }
        });
      }

      // Crear grupos para este grado
      for (const groupData of gradeData.groups) {
        const shiftId = shiftMap[groupData.shift] || shiftMap['MAÑANA'];

        // Verificar si el grupo ya existe
        const existingGroup = await this.prisma.group.findFirst({
          where: {
            gradeId: grade.id,
            campusId: campus.id,
            name: groupData.name,
          }
        });

        if (!existingGroup) {
          const group = await this.prisma.group.create({
            data: {
              gradeId: grade.id,
              campusId: campus.id,
              shiftId,
              name: groupData.name,
              code: `${gradeData.name}-${groupData.name}`,
              maxCapacity: groupData.capacity,
            }
          });
        }
      }

      results.push({
        grade: grade.name,
        groupsCount: gradeData.groups.length
      });
    }

    return {
      success: true,
      message: `Sincronizados ${grades.length} grados`,
      campusId: campus.id,
      results
    };
  }
}
