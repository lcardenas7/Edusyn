import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { CreateGradeDto } from './dto/create-grade.dto';
import { AcademicStructureType, GradeStage, SchoolShift } from '@prisma/client';
import { GRADE_TEMPLATES, deriveGradeNumber, levelKey, canonicalGradeName } from '../../common/utils/academic-level.util';
import { suggestStructureByStage } from '../../engines/AcademicStructure';

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
      const number = dto.number ?? deriveGradeNumber(dto.name);
      const name = canonicalGradeName(dto.name);
      // Idempotente por número+etapa: no crear "Primero" si ya existe "1°" (mismo
      // número), aunque el nombre entrante use otra convención.
      if (number != null) {
        const existing = await this.prisma.grade.findFirst({
          where: { institutionId: dto.institutionId, stage: dto.stage, number },
        });
        if (existing) return existing;
      }
      return await this.prisma.grade.create({
        data: {
          institutionId: dto.institutionId,
          stage: dto.stage,
          // Si no viene el número, se deduce del nombre: dejarlo en NULL rompe el
          // cálculo del "grado siguiente" en la promoción.
          number,
          name,
          academicStructure: suggestStructureByStage(dto.stage),
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

  async update(id: string, institutionId: string, data: { name?: string; stage?: GradeStage; number?: number; academicStructure?: AcademicStructureType }) {
    // Verificar que el grado pertenece a esta institución
    const grade = await this.prisma.grade.findFirst({
      where: { id, institutionId },
    });
    if (!grade) {
      throw new NotFoundException('Grado no encontrado en esta institución.');
    }

    if (data.academicStructure === 'DIMENSIONS' && grade.stage !== 'PREESCOLAR') {
      throw new BadRequestException('La evaluación por dimensiones solo se puede activar en grados de preescolar.');
    }

    try {
      return await this.prisma.grade.update({
        where: { id },
        data: {
          ...(data.name && { name: data.name }),
          ...(data.stage && { stage: data.stage }),
          ...(data.number !== undefined && { number: data.number }),
          ...(data.academicStructure && { academicStructure: data.academicStructure }),
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
      const academicStructure = suggestStructureByStage(stage);
      await this.prisma.grade.createMany({
        data: toCreate.map((t) => ({ institutionId, stage, number: t.number, name: t.name, academicStructure })),
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

  async backfillAcademicStructure(institutionId: string) {
    const result = await this.prisma.grade.updateMany({
      where: { institutionId, stage: 'PREESCOLAR', academicStructure: 'AREAS_SUBJECTS' },
      data: { academicStructure: 'DIMENSIONS' },
    });
    return { updated: result.count, message: result.count > 0 ? `Se corrigieron ${result.count} grado(s) de preescolar a evaluación cualitativa.` : 'Todos los grados de preescolar ya estaban configurados correctamente.' };
  }

  /**
   * Detecta grados duplicados (misma etapa+número, distinto nombre — p. ej. "1°" y
   * "Primero" que crea el importador de horarios). Con apply=false solo reporta;
   * con apply=true borra ÚNICAMENTE los duplicados VACÍOS (sin grupos, plantillas,
   * elecciones ni logros), conservando el que tiene datos reales. Nunca destruye
   * un grado con contenido.
   */
  async dedupeGrades(institutionId: string, apply = false) {
    const grades = await this.prisma.grade.findMany({
      where: { institutionId },
      select: {
        id: true, name: true, stage: true, number: true,
        _count: { select: { groups: true, gradeTemplates: true, elections: true, achievementBank: true } },
      },
      orderBy: [{ stage: 'asc' }, { number: 'asc' }, { name: 'asc' }],
    });

    const byKey = new Map<string, typeof grades>();
    for (const g of grades) {
      // Número canónico: el guardado o el derivado del nombre ("Primero"→1, "6º"→6).
      const num = g.number ?? deriveGradeNumber(g.name);
      // Con número → agrupa "1°"/"Primero"/"6º"; sin número (CICLO/Play) → por nombre normalizado.
      const key = num != null
        ? `${g.stage}|#${num}`
        : `${g.stage}|n:${canonicalGradeName(g.name).toLowerCase()}`;
      const list = byKey.get(key) ?? [];
      list.push(g);
      byKey.set(key, list);
    }

    const isEmpty = (g: typeof grades[number]) =>
      g._count.groups === 0 && g._count.gradeTemplates === 0 && g._count.elections === 0 && g._count.achievementBank === 0;

    const duplicates: any[] = [];
    const deleted: string[] = [];
    const skipped: string[] = [];

    for (const list of byKey.values()) {
      if (list.length < 2) continue;
      // Conservar el que tenga más grupos (datos reales); en empate, el primero.
      const sorted = [...list].sort((a, b) => b._count.groups - a._count.groups);
      const keep = sorted[0];
      for (const dup of sorted.slice(1)) {
        const empty = isEmpty(dup);
        duplicates.push({ kept: keep.name, duplicate: dup.name, empty, groups: dup._count.groups });
        if (empty && apply) {
          try {
            await this.prisma.grade.delete({ where: { id: dup.id } });
            deleted.push(dup.name);
          } catch {
            skipped.push(dup.name); // FK inesperada: no forzar
          }
        } else if (!empty) {
          skipped.push(dup.name); // tiene datos: requiere revisión manual (fusión)
        }
      }
    }

    return {
      applied: apply,
      duplicates,
      deleted,
      skipped,
      message: apply
        ? `Se eliminaron ${deleted.length} grado(s) duplicado(s) vacío(s).${skipped.length ? ` ${skipped.length} con datos requieren revisión manual: ${skipped.join(', ')}.` : ''}`
        : `${duplicates.length} duplicado(s) detectado(s).${skipped.length ? ` ${skipped.length} con datos (fusión manual): ${skipped.join(', ')}.` : ''}`,
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

      // Buscar o crear el grado PARA ESTA INSTITUCIÓN.
      // Reusar por número+etapa (canónico) antes que por nombre: evita duplicar
      // "1°" vs "Primero" cuando la estructura usa otra convención de nombre.
      const number = gradeData.order ?? deriveGradeNumber(gradeData.name);
      const canonName = canonicalGradeName(gradeData.name);
      let grade = number != null
        ? await this.prisma.grade.findFirst({ where: { institutionId, stage, number } })
        : null;
      if (!grade) {
        grade = await this.prisma.grade.findFirst({ where: { institutionId, stage, name: canonName } });
      }

      if (!grade) {
        grade = await this.prisma.grade.create({
          data: {
            institutionId,
            name: canonName,
            stage,
            number,
            academicStructure: suggestStructureByStage(stage),
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
