import { BadRequestException, Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { CreateEvaluationComponentDto } from './dto/create-evaluation-component.dto';

/**
 * FASE 2 — La estructura de evaluación de la institución (procesos y subprocesos,
 * con sus pesos) vive AQUÍ, en `EvaluationComponent`.
 *
 * Por qué: antes esa estructura estaba duplicada en `gradingConfig.evaluationProcesses`
 * (un JSON que escribía la pantalla de SIEE) y el motor de notas la IGNORABA por
 * completo — promediaba con los pesos del plan de cada asignación. El rector
 * configuraba pesos que no calculaban nada. Ahora hay una sola fuente, y de ella
 * se heredan los pesos al plan de evaluación, que es lo que sí promedia el boletín.
 */

export interface SubprocessInput {
  code?: string;
  name: string;
  weightPercentage: number;
  order?: number;
}

export interface ProcessInput {
  code: string;
  name: string;
  weightPercentage: number;
  order?: number;
  allowTeacherAddGrades?: boolean;
  subprocesses?: SubprocessInput[];
}

/** Estructura por defecto (Decreto 1290: saber / hacer / ser). */
const DEFAULT_PROCESSES: ProcessInput[] = [
  { code: 'COGNITIVO', name: 'Cognitivo', weightPercentage: 40, order: 0, allowTeacherAddGrades: true },
  { code: 'PROCEDIMENTAL', name: 'Procedimental', weightPercentage: 40, order: 1, allowTeacherAddGrades: true },
  { code: 'ACTITUDINAL', name: 'Actitudinal', weightPercentage: 20, order: 2, allowTeacherAddGrades: false },
];

/** Convierte un nombre en un código estable y único dentro de la institución. */
function toCode(name: string): string {
  return (name || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || 'COMPONENTE';
}

@Injectable()
export class EvaluationComponentsService {
  private readonly logger = new Logger(EvaluationComponentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // ESTRUCTURA INSTITUCIONAL (fuente única)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Estructura de evaluación de la institución (procesos con sus subprocesos).
   * Si aún no existe, se siembra una sola vez: desde la configuración antigua
   * (`gradingConfig.evaluationProcesses`) si la hay, o desde la estructura por
   * defecto. Así ninguna institución existente pierde lo que ya había configurado.
   */
  async getStructure(institutionId: string) {
    let roots = await this.readRoots(institutionId);

    if (roots.length === 0) {
      await this.seedFromLegacyOrDefaults(institutionId);
      roots = await this.readRoots(institutionId);
    }

    return roots.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      weightPercentage: p.weightPercentage ?? 0,
      order: p.order ?? 0,
      allowTeacherAddGrades: p.allowTeacherAddGrades,
      subprocesses: [...p.children]
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name))
        .map((c) => ({
          id: c.id,
          code: c.code,
          name: c.name,
          weightPercentage: c.weightPercentage ?? 0,
          order: c.order ?? 0,
        })),
    }));
  }

  private async readRoots(institutionId: string) {
    const roots = await this.prisma.evaluationComponent.findMany({
      where: { institutionId, parentId: null },
      include: { children: true },
    });
    return roots.sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name),
    );
  }

  /** Siembra la estructura la primera vez (migración perezosa, sin big-bang). */
  private async seedFromLegacyOrDefaults(institutionId: string) {
    const inst = await this.prisma.institution.findUnique({
      where: { id: institutionId },
      select: { gradingConfig: true },
    });
    const legacy = (inst?.gradingConfig as any)?.evaluationProcesses;

    let processes: ProcessInput[] = DEFAULT_PROCESSES;
    if (Array.isArray(legacy) && legacy.length > 0) {
      processes = legacy
        .filter((p: any) => p?.name)
        .map((p: any, i: number) => ({
          code: p.code || toCode(p.name),
          name: p.name,
          weightPercentage: Number(p.weightPercentage) || 0,
          order: typeof p.order === 'number' ? p.order : i,
          allowTeacherAddGrades: p.allowTeacherAddGrades !== false,
          subprocesses: Array.isArray(p.subprocesses)
            ? p.subprocesses
                .filter((s: any) => s?.name)
                .map((s: any, j: number) => ({
                  code: s.code || `${p.code || toCode(p.name)}_${toCode(s.name)}`,
                  name: s.name,
                  weightPercentage: Number(s.weightPercentage) || 0,
                  order: typeof s.order === 'number' ? s.order : j,
                }))
            : [],
        }));
      this.logger.log(
        `Estructura de evaluación migrada desde la configuración anterior para ${institutionId} (${processes.length} procesos).`,
      );
    }

    // La configuración vieja puede venir con pesos que no suman 100; migrarla tal
    // cual es preferible a bloquear (el rector la corrige después con validación).
    await this.saveStructure(institutionId, processes, { validate: false });
  }

  /**
   * Guarda la estructura institucional. Hace upsert por código: nunca borra
   * componentes existentes, porque pueden estar referenciados por planes de
   * evaluación y por notas ya cargadas (el código del componente es el que
   * agrupa las notas de la planilla).
   */
  async saveStructure(
    institutionId: string,
    processes: ProcessInput[],
    opts: { validate?: boolean } = {},
  ) {
    const validate = opts.validate !== false;

    if (!Array.isArray(processes) || processes.length === 0) {
      throw new BadRequestException('Debes definir al menos un componente de evaluación.');
    }

    if (validate) {
      const total = processes.reduce((s, p) => s + (Number(p.weightPercentage) || 0), 0);
      if (Math.abs(total - 100) > 0.01) {
        throw new BadRequestException(
          `Los componentes de evaluación deben sumar 100% (actualmente suman ${total}%).`,
        );
      }
      for (const p of processes) {
        const subs = p.subprocesses ?? [];
        if (subs.length > 0) {
          const st = subs.reduce((s, x) => s + (Number(x.weightPercentage) || 0), 0);
          if (Math.abs(st - 100) > 0.01) {
            throw new BadRequestException(
              `Los subprocesos de "${p.name}" deben sumar 100% (actualmente suman ${st}%).`,
            );
          }
        }
      }
    }

    for (const [i, p] of processes.entries()) {
      const code = p.code || toCode(p.name);
      const parent = await this.prisma.evaluationComponent.upsert({
        where: { institutionId_code: { institutionId, code } },
        update: {
          name: p.name,
          weightPercentage: Math.round(Number(p.weightPercentage) || 0),
          order: typeof p.order === 'number' ? p.order : i,
          allowTeacherAddGrades: p.allowTeacherAddGrades !== false,
          parentId: null,
        },
        create: {
          institutionId,
          code,
          name: p.name,
          weightPercentage: Math.round(Number(p.weightPercentage) || 0),
          order: typeof p.order === 'number' ? p.order : i,
          allowTeacherAddGrades: p.allowTeacherAddGrades !== false,
        },
      });

      for (const [j, s] of (p.subprocesses ?? []).entries()) {
        const subCode = s.code || `${code}_${toCode(s.name)}`;
        await this.prisma.evaluationComponent.upsert({
          where: { institutionId_code: { institutionId, code: subCode } },
          update: {
            name: s.name,
            weightPercentage: Math.round(Number(s.weightPercentage) || 0),
            order: typeof s.order === 'number' ? s.order : j,
            parentId: parent.id,
          },
          create: {
            institutionId,
            code: subCode,
            name: s.name,
            weightPercentage: Math.round(Number(s.weightPercentage) || 0),
            order: typeof s.order === 'number' ? s.order : j,
            parentId: parent.id,
          },
        });
      }
    }

    return this.getStructure(institutionId);
  }

  /**
   * Pesos institucionales indexados por CÓDIGO del componente.
   *
   * Solo lectura: NO siembra nada. Se usa en la ruta de cálculo de notas, que se
   * ejecuta por estudiante; sembrar ahí escribiría en un camino de lectura y
   * multiplicaría el trabajo. Si la institución aún no tiene estructura, devuelve
   * un mapa vacío y el cálculo mantiene su comportamiento anterior.
   */
  async getWeightsByCode(institutionId: string): Promise<Map<string, number>> {
    const roots = await this.prisma.evaluationComponent.findMany({
      where: { institutionId, parentId: null },
      select: { code: true, weightPercentage: true },
    });
    const map = new Map<string, number>();
    for (const r of roots) {
      if ((r.weightPercentage ?? 0) > 0) map.set(r.code, r.weightPercentage as number);
    }
    return map;
  }

  /**
   * Pesos institucionales por defecto, listos para sembrar el plan de evaluación
   * de una asignación. Solo componentes raíz (los que promedian la nota).
   */
  async getDefaultWeights(institutionId: string): Promise<{ componentId: string; percentage: number }[]> {
    const structure = await this.getStructure(institutionId);
    return structure
      .filter((p) => p.weightPercentage > 0)
      .map((p) => ({ componentId: p.id, percentage: p.weightPercentage }));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CRUD puntual (se conserva)
  // ═══════════════════════════════════════════════════════════════════════════

  async create(dto: CreateEvaluationComponentDto) {
    return this.prisma.evaluationComponent.create({
      data: {
        institutionId: dto.institutionId,
        code: dto.code,
        name: dto.name,
        parentId: dto.parentId,
      },
    });
  }

  async list(institutionId: string) {
    return this.prisma.evaluationComponent.findMany({
      where: { institutionId },
      include: { children: true },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    });
  }

  async getHierarchy(institutionId: string) {
    return this.prisma.evaluationComponent.findMany({
      where: { institutionId, parentId: null },
      include: { children: { include: { children: true } } },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    });
  }

  async update(id: string, dto: Partial<CreateEvaluationComponentDto>) {
    return this.prisma.evaluationComponent.update({ where: { id }, data: dto });
  }

  async delete(id: string) {
    return this.prisma.evaluationComponent.delete({ where: { id } });
  }
}
