import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FinalComponentsService {
  private readonly logger = new Logger(FinalComponentsService.name);
  constructor(private prisma: PrismaService) {}

  async findByAcademicYear(academicYearId: string) {
    return this.prisma.finalComponent.findMany({
      where: { academicYearId },
      orderBy: { order: 'asc' },
    });
  }

  async findOne(id: string) {
    const component = await this.prisma.finalComponent.findUnique({ where: { id } });
    if (!component) throw new NotFoundException('Componente final no encontrado');
    return component;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // D-19 · ALCANCE: qué grados/asignaturas NO presentan una fuente final
  // ═══════════════════════════════════════════════════════════════════════════
  //
  // Modelo de EXCLUSIONES: sin filas, el componente aplica a todo el mundo, que
  // es el comportamiento histórico. Por eso no hubo backfill y por eso una
  // institución que no configure nada no cambia en absoluto.
  //
  // Regla de precedencia (en `final-component-scope.util.ts`, función pura
  // compartida con el cálculo de la nota anual):
  //     (componente, grado, asignatura) → no aplica a esa asignatura
  //     (componente, grado, null)       → no aplica a todo el grado
  //     sin fila                        → aplica

  /** Alcance declarado de todas las fuentes finales de un año. */
  async getScope(academicYearId: string) {
    const components = await this.prisma.finalComponent.findMany({
      where: { academicYearId },
      orderBy: { order: 'asc' },
      select: { id: true, name: true, weightPercentage: true, order: true },
    });
    if (components.length === 0) return { components: [], exclusions: [] };

    const exclusions = await this.prisma.finalComponentExclusion.findMany({
      where: { finalComponentId: { in: components.map((c) => c.id) } },
      select: {
        id: true,
        finalComponentId: true,
        gradeId: true,
        subjectId: true,
        reason: true,
        createdAt: true,
        grade: { select: { id: true, name: true, stage: true } },
        subject: { select: { id: true, name: true } },
      },
      orderBy: [{ gradeId: 'asc' }, { subjectId: 'asc' }],
    });

    return { components, exclusions };
  }

  /**
   * Declara que un componente NO aplica a un grado (o a una asignatura de ese
   * grado). Idempotente: repetir la misma exclusión no falla ni duplica.
   */
  async addExclusion(data: {
    institutionId: string;
    finalComponentId: string;
    gradeId: string;
    subjectId?: string | null;
    reason?: string;
    createdById?: string;
  }) {
    const component = await this.prisma.finalComponent.findUnique({
      where: { id: data.finalComponentId },
      select: { id: true, institutionId: true, name: true },
    });
    if (!component) throw new NotFoundException('Componente final no encontrado');
    if (component.institutionId !== data.institutionId) {
      throw new BadRequestException('El componente no pertenece a esta institución');
    }

    const grade = await this.prisma.grade.findFirst({
      where: { id: data.gradeId, institutionId: data.institutionId },
      select: { id: true, name: true },
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

    // Idempotencia. No uso `upsert` porque el @@unique incluye una columna
    // anulable y en PostgreSQL NULL != NULL: el upsert no reconocería la fila
    // existente cuando subjectId es null (el índice único PARCIAL de la
    // migración sí la protege, pero devolvería un 500 en vez de ser idempotente).
    const existing = await this.prisma.finalComponentExclusion.findFirst({
      where: { finalComponentId: data.finalComponentId, gradeId: data.gradeId, subjectId },
    });
    if (existing) return existing;

    return this.prisma.finalComponentExclusion.create({
      data: {
        institutionId: data.institutionId,
        finalComponentId: data.finalComponentId,
        gradeId: data.gradeId,
        subjectId,
        reason: data.reason ?? null,
        createdById: data.createdById ?? null,
      },
    });
  }

  /** Vuelve a incluir: la fuente pasa a aplicar de nuevo a esa coordenada. */
  async removeExclusion(id: string, institutionId: string) {
    const ex = await this.prisma.finalComponentExclusion.findUnique({
      where: { id },
      select: { id: true, institutionId: true },
    });
    if (!ex) throw new NotFoundException('Exclusión no encontrada');
    if (ex.institutionId !== institutionId) {
      throw new BadRequestException('La exclusión no pertenece a esta institución');
    }
    return this.prisma.finalComponentExclusion.delete({ where: { id } });
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
