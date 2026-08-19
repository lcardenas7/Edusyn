import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { filterApplicableComponents } from './final-component-scope.util';

@Injectable()
export class FinalComponentsService {
  private readonly logger = new Logger(FinalComponentsService.name);
  constructor(private prisma: PrismaService) {}

  /**
   * Fuentes finales del año.
   *
   * Con `teacherAssignmentId` devuelve SÓLO las que ese grado/asignatura
   * presenta realmente (D-19). Se filtra aquí, y no en la planilla, para que
   * la lista que ve el docente sea exactamente la misma que acepta
   * `FinalComponentGradesService`: si la UI filtrara por su cuenta, un cambio
   * de reglas dejaría casillas visibles que el guardado rechaza.
   *
   * Sin ese parámetro el comportamiento es el de siempre: devuelve todas.
   */
  async findByAcademicYear(academicYearId: string, teacherAssignmentId?: string) {
    const components = await this.prisma.finalComponent.findMany({
      where: { academicYearId },
      orderBy: { order: 'asc' },
    });
    if (!teacherAssignmentId || components.length === 0) return components;

    const assignment = await this.prisma.teacherAssignment.findUnique({
      where: { id: teacherAssignmentId },
      select: { subjectId: true, group: { select: { gradeId: true } } },
    });
    const gradeId = assignment?.group?.gradeId ?? null;
    // Fail-open: sin grado conocido no se recorta nada.
    if (!gradeId) return components;

    const rules = await this.prisma.finalComponentScope.findMany({
      where: { finalComponentId: { in: components.map((c) => c.id) }, gradeId },
      select: { finalComponentId: true, gradeId: true, subjectId: true, applies: true },
    });

    return filterApplicableComponents(components, gradeId, assignment?.subjectId ?? null, rules);
  }

  async findOne(id: string) {
    const component = await this.prisma.finalComponent.findUnique({ where: { id } });
    if (!component) throw new NotFoundException('Componente final no encontrado');
    return component;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // D-19 · ALCANCE: qué grados/asignaturas presentan una fuente final
  // ═══════════════════════════════════════════════════════════════════════════
  //
  // El modo por defecto vive en el propio componente (`scopeMode`); esta tabla
  // guarda sólo las reglas que se apartan de él. Con ALL_GRADES —el DEFAULT— y
  // sin reglas, el comportamiento es idéntico al histórico.
  //
  // Resolución (en `final-component-scope.util.ts`, función pura compartida con
  // el cálculo anual, las proyecciones y la captura):
  //     (componente, grado, asignatura) → su `applies`
  //     (componente, grado, null)       → su `applies`
  //     sin regla                       → scopeMode === ALL_GRADES

  /** Alcance declarado de todas las fuentes finales de un año. */
  async getScope(academicYearId: string) {
    const components = await this.prisma.finalComponent.findMany({
      where: { academicYearId },
      orderBy: { order: 'asc' },
      select: { id: true, name: true, weightPercentage: true, order: true, scopeMode: true },
    });
    if (components.length === 0) return { components: [], rules: [] };

    const rules = await this.prisma.finalComponentScope.findMany({
      where: { finalComponentId: { in: components.map((c) => c.id) } },
      select: {
        id: true,
        finalComponentId: true,
        gradeId: true,
        subjectId: true,
        applies: true,
        reason: true,
        createdAt: true,
        grade: { select: { id: true, name: true, stage: true } },
        subject: { select: { id: true, name: true } },
      },
      orderBy: [{ gradeId: 'asc' }, { subjectId: 'asc' }],
    });

    return { components, rules };
  }

  /** Cambia el modo por defecto de una fuente. */
  async setScopeMode(finalComponentId: string, scopeMode: 'ALL_GRADES' | 'SELECTED_GRADES', institutionId: string) {
    const component = await this.prisma.finalComponent.findUnique({
      where: { id: finalComponentId },
      select: { id: true, institutionId: true },
    });
    if (!component) throw new NotFoundException('Componente final no encontrado');
    if (component.institutionId !== institutionId) {
      throw new BadRequestException('El componente no pertenece a esta institución');
    }
    return this.prisma.finalComponent.update({
      where: { id: finalComponentId },
      data: { scopeMode },
    });
  }

  /**
   * Declara una regla de alcance. `applies=false` excluye; `applies=true`
   * incluye (y sirve como EXCEPCIÓN por asignatura sobre un grado excluido).
   * Idempotente: repetirla actualiza en vez de duplicar.
   */
  async upsertScopeRule(data: {
    institutionId: string;
    finalComponentId: string;
    gradeId: string;
    subjectId?: string | null;
    applies: boolean;
    reason?: string;
    createdById?: string;
  }) {
    const component = await this.prisma.finalComponent.findUnique({
      where: { id: data.finalComponentId },
      select: { id: true, institutionId: true },
    });
    if (!component) throw new NotFoundException('Componente final no encontrado');
    if (component.institutionId !== data.institutionId) {
      throw new BadRequestException('El componente no pertenece a esta institución');
    }

    const grade = await this.prisma.grade.findFirst({
      where: { id: data.gradeId, institutionId: data.institutionId },
      select: { id: true },
    });
    if (!grade) throw new BadRequestException('El grado no pertenece a esta institución');

    if (data.subjectId) {
      const subject = await this.prisma.subject.findFirst({
        where: { id: data.subjectId, area: { institutionId: data.institutionId } },
        select: { id: true },
      });
      if (!subject) throw new BadRequestException('La asignatura no pertenece a esta institución');
    }

    const subjectId = data.subjectId ?? null;

    // No uso `upsert` de Prisma porque el @@unique incluye una columna anulable
    // y en PostgreSQL NULL != NULL: no reconocería la fila existente cuando
    // subjectId es null. El índice único PARCIAL de la migración sí la protege,
    // pero devolvería un 500 en vez de comportarse de forma idempotente.
    const existing = await this.prisma.finalComponentScope.findFirst({
      where: { finalComponentId: data.finalComponentId, gradeId: data.gradeId, subjectId },
      select: { id: true },
    });
    if (existing) {
      return this.prisma.finalComponentScope.update({
        where: { id: existing.id },
        data: { applies: data.applies, reason: data.reason ?? null },
      });
    }

    return this.prisma.finalComponentScope.create({
      data: {
        institutionId: data.institutionId,
        finalComponentId: data.finalComponentId,
        gradeId: data.gradeId,
        subjectId,
        applies: data.applies,
        reason: data.reason ?? null,
        createdById: data.createdById ?? null,
      },
    });
  }

  /** Retira una regla: la coordenada vuelve a decidirse por el `scopeMode`. */
  async removeScopeRule(id: string, institutionId: string) {
    const rule = await this.prisma.finalComponentScope.findUnique({
      where: { id },
      select: { id: true, institutionId: true },
    });
    if (!rule) throw new NotFoundException('Regla de alcance no encontrada');
    if (rule.institutionId !== institutionId) {
      throw new BadRequestException('La regla no pertenece a esta institución');
    }
    return this.prisma.finalComponentScope.delete({ where: { id } });
  }

  async create(data: {
    institutionId: string;
    academicYearId: string;
    name: string;
    weightPercentage: number;
    order: number;
  }) {
    // Validar que la suma de pesos (períodos + componentes) no exceda 100
    await this.validateTotalWeight(data.academicYearId, data.weightPercentage);

    return this.prisma.finalComponent.create({ data });
  }

  async bulkSync(
    institutionId: string,
    academicYearId: string,
    components: Array<{ id?: string; name: string; weightPercentage: number; order: number }>,
  ) {
    this.logger.log(`bulkSync called: institutionId=${institutionId}, academicYearId=${academicYearId}, components=${JSON.stringify(components)}`);

    // Eliminar componentes existentes que no están en la nueva lista
    const existingIds = components.filter(c => c.id).map(c => c.id!);
    await this.prisma.finalComponent.deleteMany({
      where: {
        academicYearId,
        id: { notIn: existingIds },
      },
    });

    // Upsert cada componente
    const results: any[] = [];
    for (const comp of components) {
      if (comp.id) {
        const updated = await this.prisma.finalComponent.update({
          where: { id: comp.id },
          data: {
            name: comp.name,
            weightPercentage: comp.weightPercentage,
            order: comp.order,
          },
        });
        results.push(updated);
      } else {
        const created = await this.prisma.finalComponent.create({
          data: {
            institutionId,
            academicYearId,
            name: comp.name,
            weightPercentage: comp.weightPercentage,
            order: comp.order,
          },
        });
        results.push(created);
      }
    }

    return results;
  }

  async toggleOpen(id: string, isOpen: boolean) {
    await this.findOne(id);
    return this.prisma.finalComponent.update({
      where: { id },
      data: { isOpen },
    });
  }

  async update(id: string, data: { name?: string; weightPercentage?: number; order?: number }) {
    const existing = await this.findOne(id);

    if (data.weightPercentage !== undefined) {
      const diff = data.weightPercentage - existing.weightPercentage;
      if (diff > 0) {
        await this.validateTotalWeight(existing.academicYearId, diff);
      }
    }

    return this.prisma.finalComponent.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.finalComponent.delete({ where: { id } });
  }

  private async validateTotalWeight(academicYearId: string, additionalWeight: number) {
    const terms = await this.prisma.academicTerm.findMany({
      where: { academicYearId },
      select: { weightPercentage: true },
    });
    const existingComponents = await this.prisma.finalComponent.findMany({
      where: { academicYearId },
      select: { weightPercentage: true },
    });

    const totalTermWeight = terms.reduce((sum, t) => sum + t.weightPercentage, 0);
    const totalComponentWeight = existingComponents.reduce((sum, c) => sum + c.weightPercentage, 0);
    const total = totalTermWeight + totalComponentWeight + additionalWeight;

    if (total > 100) {
      throw new BadRequestException(
        `El peso total excedería 100%. Períodos: ${totalTermWeight}%, Componentes existentes: ${totalComponentWeight}%, Nuevo: ${additionalWeight}%`,
      );
    }
  }
}
