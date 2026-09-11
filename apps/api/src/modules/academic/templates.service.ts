import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AcademicLevel, AreaCalculationType, AreaApprovalRule, AreaRecoveryRule, GroupExceptionType, GradeStage, Prisma } from '@prisma/client';

// ═══════════════════════════════════════════════════════════════════════════
// SERVICIO DE PLANTILLAS ACADÉMICAS
// Gestiona las plantillas que definen la estructura académica por nivel/grado
// ═══════════════════════════════════════════════════════════════════════════

@Injectable()
export class TemplatesService {
  private transactional = false;
  constructor(private readonly prisma: PrismaService) {}

  private withTransaction<T>(action: (service: TemplatesService) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async tx => {
      const service = new TemplatesService(tx as PrismaService);
      service.transactional = true;
      return action(service);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 });
  }

  private scopeWhere(model: string, institutionId: string): any {
    if (!institutionId) throw new NotFoundException('Institución no encontrada');
    switch (model) {
      case 'teacherAssignment': return { institutionId, academicYear: { institutionId }, group: { campus: { institutionId }, grade: { institutionId } }, subject: { area: { institutionId } } };
      case 'templateArea': return { template: { institutionId }, area: { institutionId } };
      case 'templateSubject': return { templateArea: { template: { institutionId }, area: { institutionId } }, subject: { area: { institutionId } } };
      case 'gradeTemplate': return { grade: { institutionId }, template: { institutionId }, academicYear: { institutionId } };
      case 'groupSubjectException': return { group: { campus: { institutionId }, grade: { institutionId } }, subject: { area: { institutionId } }, academicYear: { institutionId } };
      case 'subject': return { area: { institutionId } };
      case 'group': return { campus: { institutionId }, grade: { institutionId } };
      default: return { institutionId };
    }
  }

  private async loadInScope(model: 'academicTemplate' | 'templateArea' | 'templateSubject' | 'academicYear' | 'grade' | 'group' | 'area' | 'subject', id: string, institutionId: string) {
    if (!id || typeof id !== 'string') throw new NotFoundException('Recurso no encontrado');
    const row = await (this.prisma[model] as any).findFirst({ where: { id, AND: this.scopeWhere(model, institutionId) } });
    if (!row) throw new NotFoundException('Recurso no encontrado');
    return row;
  }

  private async assertGradeYear(gradeId: string, academicYearId: string, institutionId: string) {
    await this.loadInScope('academicYear', academicYearId, institutionId);
    return this.loadInScope('grade', gradeId, institutionId);
  }

  private async assertGroupYear(groupId: string, academicYearId: string, institutionId: string) {
    await this.loadInScope('academicYear', academicYearId, institutionId);
    return this.loadInScope('group', groupId, institutionId);
  }

  private pickFields(data: any, keys: string[]) {
    return Object.fromEntries(keys.filter(key => data[key] !== undefined).map(key => [key, data[key]]));
  }

  private async deleteInScope(model: 'academicTemplate' | 'templateArea' | 'templateSubject' | 'gradeTemplate' | 'groupSubjectException', where: any, institutionId: string) {
    const scoped = { ...where, AND: this.scopeWhere(model, institutionId) };
    const row = await (this.prisma[model] as any).findFirst({ where: scoped });
    if (!row) throw new NotFoundException('Recurso no encontrado');
    const result = await (this.prisma[model] as any).deleteMany({ where: scoped });
    if (!result.count) throw new NotFoundException('Recurso no encontrado');
    return row;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PLANTILLAS ACADÉMICAS
  // ═══════════════════════════════════════════════════════════════════════════

  async createTemplate(data: {
    institutionId: string;
    academicYearId: string;  // 🔥 REQUERIDO: Plantilla pertenece a un año
    name: string;
    description?: string;
    level: AcademicLevel;
    isDefault?: boolean;
    achievementsPerPeriod?: number;
    useAttitudinalAchievement?: boolean;
  }) {
    await this.loadInScope('academicYear', data.academicYearId, data.institutionId);
    // Verificar nombre único por institución Y año
    if (!this.transactional) return this.withTransaction(service => service.createTemplate(data));
    const existing = await this.prisma.academicTemplate.findFirst({
      where: { institutionId: data.institutionId, academicYearId: data.academicYearId, name: data.name, AND: this.scopeWhere('academicTemplate', data.institutionId) },
    });

    if (existing) {
      throw new BadRequestException(`Ya existe una plantilla "${data.name}" en este año académico`);
    }

    // Si es default, quitar default de otras plantillas del mismo nivel EN ESTE AÑO
    if (data.isDefault) {
      await this.prisma.academicTemplate.updateMany({
        where: { institutionId: data.institutionId, academicYearId: data.academicYearId, level: data.level, isDefault: true, AND: this.scopeWhere('academicTemplate', data.institutionId) },
        data: { isDefault: false },
      });
    }

    return this.prisma.academicTemplate.create({
      data: {
        institutionId: data.institutionId,
        academicYearId: data.academicYearId,
        name: data.name,
        description: data.description,
        level: data.level,
        isDefault: data.isDefault ?? false,
        achievementsPerPeriod: data.achievementsPerPeriod ?? 1,
        useAttitudinalAchievement: data.useAttitudinalAchievement ?? false,
      },
      include: {
        academicYear: true,
        templateAreas: { where: this.scopeWhere('templateArea', data.institutionId),
          include: {
            area: true,
            templateSubjects: { where: this.scopeWhere('templateSubject', data.institutionId),  include: { subject: true } },
          },
          orderBy: { order: 'asc' },
        },
        _count: { select: { gradeTemplates: true } },
      },
    });
  }

  async findTemplateById(id: string, institutionId: string) {
    await this.loadInScope('academicTemplate', id, institutionId);
    const template = await this.prisma.academicTemplate.findFirst({
      where: { id, AND: this.scopeWhere('academicTemplate', institutionId) },
      include: {
        templateAreas: { where: this.scopeWhere('templateArea', institutionId),
          include: {
            area: true,
            templateSubjects: { where: this.scopeWhere('templateSubject', institutionId),
              include: { subject: true },
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { order: 'asc' },
        },
        gradeTemplates: { where: this.scopeWhere('gradeTemplate', institutionId),
          include: { grade: true },
        },
        _count: { select: { gradeTemplates: true } },
      },
    });
    if (!template) throw new NotFoundException('Plantilla no encontrada');
    return template;
  }

  async updateTemplate(id: string, data: {
    name?: string;
    description?: string;
    level?: AcademicLevel;
    isDefault?: boolean;
    isActive?: boolean;
    achievementsPerPeriod?: number;
    useAttitudinalAchievement?: boolean;
  }, institutionId: string) {
    const template = await this.findTemplateById(id, institutionId);

    // Si se marca como default, quitar default de otras
    if (!this.transactional) return this.withTransaction(service => service.updateTemplate(id, data, institutionId));
    if (data.isDefault) {
      await this.prisma.academicTemplate.updateMany({
        where: { institutionId, academicYearId: template.academicYearId, level: data.level || template.level, isDefault: true, id: { not: id }, AND: this.scopeWhere('academicTemplate', institutionId) },
        data: { isDefault: false },
      });
    }

    return this.prisma.academicTemplate.update({
      where: { id, AND: this.scopeWhere('academicTemplate', institutionId) },
      data: this.pickFields(data, ["name","description","level","isDefault","isActive","achievementsPerPeriod","useAttitudinalAchievement"]),
      include: {
        templateAreas: { where: this.scopeWhere('templateArea', institutionId),
          include: {
            area: true,
            templateSubjects: { where: this.scopeWhere('templateSubject', institutionId),  include: { subject: true } },
          },
          orderBy: { order: 'asc' },
        },
        _count: { select: { gradeTemplates: true } },
      },
    });
  }

  async deleteTemplate(id: string, institutionId: string) {
    const template = await this.findTemplateById(id, institutionId);

    // Verificar si tiene grados asignados
    if (!this.transactional) return this.withTransaction(service => service.deleteTemplate(id, institutionId));
    if (template.gradeTemplates.length > 0) {
      throw new BadRequestException(
        'No se puede eliminar la plantilla porque tiene grados asignados. Desasigne los grados primero.'
      );
    }

    return this.deleteInScope('academicTemplate', { id }, institutionId);
  }

  async listTemplates(
    institutionId: string,
    academicYearId: string,  // 🔥 REQUERIDO: Filtrar por año
    level?: AcademicLevel,
    includeInactive = false
  ) {
    await this.loadInScope('academicYear', academicYearId, institutionId);
    return this.prisma.academicTemplate.findMany({
      where: { institutionId, academicYearId, ...(level && { level }), ...(includeInactive ? {} : { isActive: true }), AND: this.scopeWhere('academicTemplate', institutionId) },
      include: {
        academicYear: true,
        templateAreas: { where: this.scopeWhere('templateArea', institutionId),
          include: {
            area: true,
            templateSubjects: { where: this.scopeWhere('templateSubject', institutionId),  include: { subject: true } },
          },
          orderBy: { order: 'asc' },
        },
        _count: { select: { gradeTemplates: true, templateAreas: true } },
      },
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ÁREAS EN PLANTILLA
  // ═══════════════════════════════════════════════════════════════════════════

  async addAreaToTemplate(data: {
    templateId: string;
    areaId: string;
    weightPercentage?: number;
    calculationType?: AreaCalculationType;
    approvalRule?: AreaApprovalRule;
    recoveryRule?: AreaRecoveryRule;
    isMandatory?: boolean;
    order?: number;
  }, institutionId: string) {
    await this.loadInScope('academicTemplate', data.templateId, institutionId);
    await this.loadInScope('area', data.areaId, institutionId);
    // Verificar que no exista ya
    const existing = await this.prisma.templateArea.findFirst({
      where: { templateId: data.templateId, areaId: data.areaId, AND: this.scopeWhere('templateArea', institutionId) },
    });

    if (existing) {
      throw new BadRequestException('Esta área ya está en la plantilla');
    }

    return this.prisma.templateArea.create({
      data: {
        templateId: data.templateId,
        areaId: data.areaId,
        weightPercentage: data.weightPercentage ?? 0,
        calculationType: data.calculationType ?? 'AVERAGE',
        approvalRule: data.approvalRule ?? 'AREA_AVERAGE',
        recoveryRule: data.recoveryRule ?? 'INDIVIDUAL_SUBJECT',
        isMandatory: data.isMandatory ?? true,
        order: data.order ?? 0,
      },
      include: {
        area: true,
        templateSubjects: { where: this.scopeWhere('templateSubject', institutionId),  include: { subject: true } },
      },
    });
  }

  async updateTemplateArea(templateAreaId: string, data: {
    weightPercentage?: number;
    calculationType?: AreaCalculationType;
    approvalRule?: AreaApprovalRule;
    recoveryRule?: AreaRecoveryRule;
    isMandatory?: boolean;
    order?: number;
  }, institutionId: string) {
    await this.loadInScope('templateArea', templateAreaId, institutionId);
    return this.prisma.templateArea.update({
      where: { id: templateAreaId, AND: this.scopeWhere('templateArea', institutionId) },
      data: this.pickFields(data, ["weightPercentage","calculationType","approvalRule","recoveryRule","isMandatory","order"]),
      include: {
        area: true,
        templateSubjects: { where: this.scopeWhere('templateSubject', institutionId),  include: { subject: true } },
      },
    });
  }

  async removeAreaFromTemplate(templateAreaId: string, institutionId: string) {
    await this.loadInScope('templateArea', templateAreaId, institutionId);
    return this.deleteInScope('templateArea', { id: templateAreaId }, institutionId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ASIGNATURAS EN PLANTILLA
  // ═══════════════════════════════════════════════════════════════════════════

  async addSubjectToTemplateArea(data: {
    templateAreaId: string;
    subjectId: string;
    weeklyHours?: number;
    weightPercentage?: number;
    isDominant?: boolean;
    order?: number;
    achievementsPerPeriod?: number;
    useAttitudinalAchievement?: boolean;
  }, institutionId: string) {
    const parent = await this.loadInScope('templateArea', data.templateAreaId, institutionId);
    const subject = await this.loadInScope('subject', data.subjectId, institutionId);
    if (subject.areaId !== parent.areaId) throw new BadRequestException('La asignatura debe pertenecer al área de la plantilla');
    // Verificar que no exista ya
    if (!this.transactional) return this.withTransaction(service => service.addSubjectToTemplateArea(data, institutionId));
    const existing = await this.prisma.templateSubject.findFirst({
      where: { templateAreaId: data.templateAreaId, subjectId: data.subjectId, AND: this.scopeWhere('templateSubject', institutionId) },
    });

    if (existing) {
      throw new BadRequestException('Esta asignatura ya está en el área de la plantilla');
    }

    // Si es dominante, quitar dominante de otras asignaturas del área
    if (data.isDominant) {
      await this.prisma.templateSubject.updateMany({
        where: { templateAreaId: data.templateAreaId, isDominant: true, AND: this.scopeWhere('templateSubject', institutionId) },
        data: { isDominant: false },
      });
    }

    return this.prisma.templateSubject.create({
      data: {
        templateAreaId: data.templateAreaId,
        subjectId: data.subjectId,
        weeklyHours: data.weeklyHours ?? 0,
        weightPercentage: data.weightPercentage ?? 0,
        isDominant: data.isDominant ?? false,
        order: data.order ?? 0,
        achievementsPerPeriod: data.achievementsPerPeriod,
        useAttitudinalAchievement: data.useAttitudinalAchievement,
      },
      include: { subject: true },
    });
  }

  async updateTemplateSubject(templateSubjectId: string, data: {
    weeklyHours?: number;
    weightPercentage?: number;
    isDominant?: boolean;
    order?: number;
    achievementsPerPeriod?: number | null;
    useAttitudinalAchievement?: boolean | null;
  }, institutionId: string) {
    await this.loadInScope('templateSubject', templateSubjectId, institutionId);
    if (!this.transactional) return this.withTransaction(service => service.updateTemplateSubject(templateSubjectId, data, institutionId));
    const templateSubject = await this.prisma.templateSubject.findFirst({
      where: { id: templateSubjectId, AND: this.scopeWhere('templateSubject', institutionId) },
    });

    if (!templateSubject) {
      throw new NotFoundException('Configuración de asignatura no encontrada');
    }

    // Si es dominante, quitar dominante de otras
    if (data.isDominant) {
      await this.prisma.templateSubject.updateMany({
        where: { templateAreaId: templateSubject.templateAreaId, isDominant: true, id: { not: templateSubjectId }, AND: this.scopeWhere('templateSubject', institutionId) },
        data: { isDominant: false },
      });
    }

    return this.prisma.templateSubject.update({
      where: { id: templateSubjectId, AND: this.scopeWhere('templateSubject', institutionId) },
      data: this.pickFields(data, ["weeklyHours","weightPercentage","isDominant","order","achievementsPerPeriod","useAttitudinalAchievement"]),
      include: { subject: true },
    });
  }

  async removeSubjectFromTemplateArea(templateSubjectId: string, institutionId: string, force = false) {
    await this.loadInScope('templateSubject', templateSubjectId, institutionId);
    // Obtener la asignatura con su contexto
    const templateSubject = await this.prisma.templateSubject.findFirst({
      where: { id: templateSubjectId, AND: this.scopeWhere('templateSubject', institutionId) },
      include: {
        subject: true,
        templateArea: {
          include: {
            template: { select: { institutionId: true, academicYearId: true } },
          },
        },
      },
    });

    if (!templateSubject) {
      throw new NotFoundException('Configuración de asignatura no encontrada');
    }

    const { academicYearId } = templateSubject.templateArea.template;
    const subjectId = templateSubject.subjectId;

    // Verificar datos asociados
    const [teacherAssignments, partialGrades, finalGrades] = await Promise.all([
      this.prisma.teacherAssignment.count({
        where: { subjectId, academicYearId, institutionId, AND: this.scopeWhere('teacherAssignment', institutionId) },
      }),
      this.prisma.partialGrade.count({
        where: { teacherAssignment: { subjectId, academicYearId, institutionId }, AND: this.scopeWhere('partialGrade', institutionId) },
      }),
      this.prisma.periodFinalGrade.count({
        where: { subjectId, institutionId, AND: this.scopeWhere('periodFinalGrade', institutionId) },
      }),
    ]);

    const hasData = teacherAssignments > 0 || partialGrades > 0 || finalGrades > 0;

    if (hasData && !force) {
      const warnings: string[] = [];
      if (teacherAssignments > 0) warnings.push(`${teacherAssignments} asignación(es) de docente`);
      if (partialGrades > 0) warnings.push(`${partialGrades} nota(s) parcial(es)`);
      if (finalGrades > 0) warnings.push(`${finalGrades} nota(s) final(es) de período`);

      throw new BadRequestException({
        message: `La asignatura "${templateSubject.subject.name}" tiene datos asociados: ${warnings.join(', ')}. ¿Desea eliminarla de todas formas?`,
        code: 'SUBJECT_HAS_DATA',
        details: { teacherAssignments, partialGrades, finalGrades },
      });
    }

    return this.deleteInScope('templateSubject', { id: templateSubjectId }, institutionId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ASIGNACIÓN DE PLANTILLAS A GRADOS (POR AÑO ACADÉMICO)
  // ═══════════════════════════════════════════════════════════════════════════

  async assignTemplateToGrade(
    gradeId: string,
    templateId: string,
    academicYearId: string,  // 🔥 REQUERIDO
    institutionId: string,
    overrides?: any
  ) {
    await this.assertGradeYear(gradeId, academicYearId, institutionId);
    const template = await this.loadInScope('academicTemplate', templateId, institutionId);
    if (template.academicYearId !== academicYearId) throw new BadRequestException('La plantilla debe corresponder al año de la asignación');
    // Verificar si ya tiene una plantilla asignada PARA ESTE AÑO
    const existing = await this.prisma.gradeTemplate.findFirst({
      where: { gradeId, academicYearId, AND: this.scopeWhere('gradeTemplate', institutionId) },
    });

    if (existing) {
      // Actualizar la asignación existente
      return this.prisma.gradeTemplate.update({
        where: { id: existing.id, AND: this.scopeWhere('gradeTemplate', institutionId) },
        data: { templateId, overrides },
        include: { grade: true, template: true, academicYear: true },
      });
    }

    return this.prisma.gradeTemplate.create({
      data: { gradeId, templateId, academicYearId, overrides },
      include: { grade: true, template: true, academicYear: true },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ASISTENTE "PLAN DE ESTUDIOS" — orquestador atómico
  // Crea/actualiza Catálogo (Area/Subject) + Plantilla (TemplateArea/TemplateSubject)
  // + asignación al grado, en UNA transacción. Idempotente por grado+año: re-armar
  // el mismo grado actualiza (no duplica) y reutiliza materias ya existentes.
  // ═══════════════════════════════════════════════════════════════════════════

  async quickSetup(dto: {
    institutionId: string;
    academicYearId: string;
    gradeId: string;
    areas: Array<{
      areaId?: string;
      newAreaName?: string;
      subjects: Array<{
        subjectId?: string;
        newSubjectName?: string;
        weeklyHours: number;
        subjectType?: string;
      }>;
    }>;
  }) {
    await this.assertGradeYear(dto.gradeId, dto.academicYearId, dto.institutionId);
    for (const area of dto.areas || []) {
      if (area.areaId) await this.loadInScope('area', area.areaId, dto.institutionId);
      for (const input of area.subjects || []) {
        if (input.subjectId) {
          const subject = await this.loadInScope('subject', input.subjectId, dto.institutionId);
          if (!area.areaId || subject.areaId !== area.areaId) throw new BadRequestException('La asignatura debe pertenecer al área seleccionada');
        }
      }
    }
    const grade = await this.prisma.grade.findFirst({
      where: { id: dto.gradeId, AND: this.scopeWhere('grade', dto.institutionId) },
      select: { id: true, name: true, stage: true, institutionId: true },
    });
    if (!grade) throw new NotFoundException('Grado no encontrado');
    if (grade.institutionId !== dto.institutionId) {
      throw new BadRequestException('El grado no pertenece a la institución');
    }
    if (grade.stage === 'PREESCOLAR') {
      throw new BadRequestException(
        'El asistente aplica a grados con asignaturas. Preescolar se evalúa por dimensiones.',
      );
    }
    if (!dto.areas || dto.areas.length === 0) {
      throw new BadRequestException('Agrega al menos un área con asignaturas');
    }

    const level = this.mapGradeStageToAcademicLevel(grade.stage);
    const { institutionId, academicYearId, gradeId } = dto;
    const areaCount = dto.areas.length;

    return this.prisma.$transaction(
      async (tx) => {
        // 1. Plantilla del grado: editar la existente o crear una nueva
        const existingGT = await tx.gradeTemplate.findFirst({
          where: { gradeId, academicYearId, AND: this.scopeWhere('gradeTemplate', dto.institutionId) },
          select: { templateId: true },
        });

        let templateId = existingGT?.templateId ?? null;
        if (templateId && !await tx.academicTemplate.findFirst({ where: { id: templateId, institutionId, academicYearId }, select: { id: true } })) throw new NotFoundException('Plantilla no encontrada para este año');
        if (!templateId) {
          let name = `Plantilla ${grade.name}`;
          const clash = await tx.academicTemplate.findFirst({
            where: { institutionId, academicYearId, name, AND: this.scopeWhere('academicTemplate', dto.institutionId) },
            select: { id: true },
          });
          if (clash) name = `${name} (${gradeId.slice(0, 4)})`;
          const created = await tx.academicTemplate.create({
            data: { institutionId, academicYearId, name, level, isDefault: false },
            select: { id: true },
          });
          templateId = created.id;
        }

        let areaOrder = 0;
        for (const a of dto.areas) {
          // Resolver o crear el Área del catálogo (dedup por institución+nombre)
          let areaId = a.areaId ?? null;
          const newAreaName = a.newAreaName?.trim();
          if (!areaId && newAreaName) {
            const existingArea = await tx.area.findFirst({
              where: { institutionId, name: newAreaName, AND: this.scopeWhere('area', dto.institutionId) },
              select: { id: true },
            });
            areaId =
              existingArea?.id ??
              (
                await tx.area.create({
                  data: { institutionId, name: newAreaName, order: areaOrder },
                  select: { id: true },
                })
              ).id;
          }
          if (!areaId) continue;

          // Upsert del área en la plantilla
          let ta = await tx.templateArea.findFirst({
            where: { templateId, areaId, AND: this.scopeWhere('templateArea', dto.institutionId) },
            select: { id: true },
          });
          if (!ta) {
            ta = await tx.templateArea.create({
              data: {
                templateId,
                areaId,
                weightPercentage: Math.round((100 / areaCount) * 10) / 10,
                calculationType: 'AVERAGE',
                approvalRule: 'AREA_AVERAGE',
                recoveryRule: 'INDIVIDUAL_SUBJECT',
                isMandatory: true,
                order: areaOrder,
              },
              select: { id: true },
            });
          }
          areaOrder++;

          // Asignaturas del área
          const subjCount = a.subjects.length || 1;
          let subjOrder = 0;
          for (const s of a.subjects) {
            let subjectId = s.subjectId ?? null;
            const newSubjectName = s.newSubjectName?.trim();
            if (!subjectId && newSubjectName) {
              const existingSubj = await tx.subject.findFirst({
                where: { areaId, name: newSubjectName, AND: this.scopeWhere('subject', dto.institutionId) },
                select: { id: true },
              });
              subjectId =
                existingSubj?.id ??
                (
                  await tx.subject.create({
                    data: {
                      areaId,
                      name: newSubjectName,
                      subjectType: (s.subjectType as any) ?? 'MANDATORY',
                      order: subjOrder,
                    },
                    select: { id: true },
                  })
                ).id;
            }
            if (!subjectId) continue;

            const hours = Number.isFinite(s.weeklyHours) ? Math.max(0, Math.trunc(s.weeklyHours)) : 0;
            const existingTS = await tx.templateSubject.findFirst({
              where: { templateAreaId: ta.id, subjectId, AND: this.scopeWhere('templateSubject', dto.institutionId) },
              select: { id: true },
            });
            if (existingTS) {
              await tx.templateSubject.update({ where: { id: existingTS.id, AND: this.scopeWhere('templateSubject', dto.institutionId) }, data: { weeklyHours: hours } });
            } else {
              await tx.templateSubject.create({
                data: {
                  templateAreaId: ta.id,
                  subjectId,
                  weeklyHours: hours,
                  weightPercentage: Math.round((100 / subjCount) * 10) / 10,
                  order: subjOrder,
                },
              });
            }
            subjOrder++;
          }
        }

        // 3. Asignar la plantilla al grado
        if (existingGT) {
          if (existingGT.templateId !== templateId) {
            await tx.gradeTemplate.update({
              where: { gradeId_academicYearId: { gradeId, academicYearId }, AND: this.scopeWhere('gradeTemplate', dto.institutionId) },
              data: { templateId },
            });
          }
        } else {
          await tx.gradeTemplate.create({ data: { gradeId, templateId, academicYearId } });
        }

        return { success: true, templateId, gradeId, areasProcessed: dto.areas.length };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 },
    );
  }

  async syncTemplateFromActiveAssignments(
    gradeId: string,
    academicYearId: string,
    institutionId: string,
    options?: { countInAverage?: boolean },
  ) {
    await this.assertGradeYear(gradeId, academicYearId, institutionId);
    if (!this.transactional) return this.withTransaction(service => service.syncTemplateFromActiveAssignments(gradeId, academicYearId, institutionId, options));
    const grade = await this.prisma.grade.findFirst({
      where: { id: gradeId, AND: this.scopeWhere('grade', institutionId) },
      select: {
        id: true,
        institutionId: true,
        name: true,
        stage: true,
      },
    });

    if (!grade) {
      throw new NotFoundException('Grado no encontrado');
    }

    const assignments = await this.prisma.teacherAssignment.findMany({
      where: { institutionId, academicYearId, group: { gradeId }, endDate: null, AND: this.scopeWhere('teacherAssignment', institutionId) },
      include: {
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
            area: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
      },
    });

    if (assignments.length === 0) {
      throw new BadRequestException('No hay asignaciones activas para sincronizar este grado');
    }

    const level = this.mapGradeStageToAcademicLevel(grade.stage);

    const existingGradeTemplate = await this.prisma.gradeTemplate.findFirst({
      where: { gradeId, academicYearId, AND: this.scopeWhere('gradeTemplate', institutionId) },
      include: {
        template: {
          include: {
            templateAreas: { where: this.scopeWhere('templateArea', institutionId),
              include: {
                area: true,
                templateSubjects: { where: this.scopeWhere('templateSubject', institutionId),  include: { subject: true } },
              },
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    });

    let template = existingGradeTemplate?.template;
    if (template && template.academicYearId !== academicYearId) {
      throw new BadRequestException('La plantilla asignada no corresponde al año académico');
    }

    if (!template) {
      const reusableTemplate = await this.prisma.academicTemplate.findFirst({
        where: { institutionId, academicYearId, level, isActive: true, gradeTemplates: { none: {} }, AND: this.scopeWhere('academicTemplate', institutionId) },
        include: {
          templateAreas: { where: this.scopeWhere('templateArea', institutionId),
            include: {
              area: true,
              templateSubjects: { where: this.scopeWhere('templateSubject', institutionId),  include: { subject: true } },
            },
            orderBy: { order: 'asc' },
          },
        },
        orderBy: [
          { isDefault: 'desc' },
          { createdAt: 'asc' },
        ],
      });

      if (reusableTemplate) {
        template = reusableTemplate;
      }
    }

    if (!template) {
      template = await this.createTemplate({
        institutionId,
        academicYearId,
        name: `Plantilla ${grade.name}`,
        description: `Plantilla creada desde las asignaciones activas de ${grade.name}`,
        level,
        isDefault: false,
        achievementsPerPeriod: 1,
        useAttitudinalAchievement: false,
      });
    }

    if (!template) throw new NotFoundException('Plantilla no encontrada');
    if (!existingGradeTemplate || existingGradeTemplate.templateId !== template.id) {
      await this.assignTemplateToGrade(gradeId, template.id, academicYearId, institutionId, existingGradeTemplate?.overrides);
    }

    const templateAreas = template.templateAreas ?? [];
    const templateAreaMap = new Map(templateAreas.map(area => [area.areaId, area]));

    const isConvivencia = (subject: { name: string; code: string | null }) => {
      return subject.code?.toUpperCase() === 'CONV' || /convivencia/i.test(subject.name);
    };

    const groupedAssignments = new Map<string, {
      area: { id: string; name: string; code: string | null };
      subjects: Map<string, { id: string; name: string; code: string | null; weeklyHours: number }>;
    }>();

    for (const assignment of assignments) {
      const subject = assignment.subject;
      if (!subject.area) {
        throw new BadRequestException(
          `La asignatura "${subject.name}" no tiene área asociada. Asigne el área en el catálogo antes de sincronizar la plantilla.`,
        );
      }

      if (!groupedAssignments.has(subject.area.id)) {
        groupedAssignments.set(subject.area.id, {
          area: subject.area,
          subjects: new Map(),
        });
      }

      const bucket = groupedAssignments.get(subject.area.id)!;
      const current = bucket.subjects.get(subject.id);
      const weeklyHours = assignment.weeklyHours ?? current?.weeklyHours ?? 0;

      bucket.subjects.set(subject.id, {
        id: subject.id,
        name: subject.name,
        code: subject.code,
        weeklyHours,
      });
    }

    const areaCount = groupedAssignments.size || 1;
    let areaOrder = templateAreas.length;

    for (const [areaId, bucket] of groupedAssignments.entries()) {
      let templateArea = templateAreaMap.get(areaId);
      const isConvivenciaArea = bucket.area.code?.toUpperCase() === 'CONV' || /convivencia/i.test(bucket.area.name);
      const specialArea = isConvivenciaArea && options?.countInAverage === false;

      if (!templateArea) {
        templateArea = await this.prisma.templateArea.create({
          data: {
            templateId: template.id,
            areaId: bucket.area.id,
            weightPercentage: specialArea ? 0 : (templateAreas.length === 0 ? Math.round((100 / areaCount) * 10) / 10 : 0),
            calculationType: specialArea ? 'INFORMATIVE' : 'AVERAGE',
            approvalRule: 'AREA_AVERAGE',
            recoveryRule: 'INDIVIDUAL_SUBJECT',
            isMandatory: !specialArea,
            order: areaOrder++,
          },
          include: {
            area: true,
            templateSubjects: { where: this.scopeWhere('templateSubject', institutionId),  include: { subject: true } },
          },
        });
        templateAreaMap.set(areaId, templateArea);
      } else if (
        (specialArea && (templateArea.calculationType !== 'INFORMATIVE' || templateArea.weightPercentage !== 0 || templateArea.isMandatory)) ||
        (!specialArea && isConvivenciaArea && (templateArea.calculationType !== 'AVERAGE' || templateArea.isMandatory === false))
      ) {
        templateArea = await this.prisma.templateArea.update({
          where: { id: templateArea.id, AND: this.scopeWhere('templateArea', institutionId) },
          data: {
            weightPercentage: specialArea ? 0 : (templateArea.weightPercentage > 0 ? templateArea.weightPercentage : Math.round((100 / areaCount) * 10) / 10),
            calculationType: specialArea ? 'INFORMATIVE' : 'AVERAGE',
            isMandatory: specialArea ? false : true,
          },
          include: {
            area: true,
            templateSubjects: { where: this.scopeWhere('templateSubject', institutionId),  include: { subject: true } },
          },
        });
        templateAreaMap.set(areaId, templateArea);
      }

      const subjectCount = bucket.subjects.size || 1;
      let subjectOrder = templateArea.templateSubjects.length;

      for (const subject of bucket.subjects.values()) {
        const existingSubject = templateArea.templateSubjects.find(ts => ts.subjectId === subject.id);
        const specialSubject = isConvivencia(subject);

        if (!existingSubject) {
          const created = await this.prisma.templateSubject.create({
            data: {
              templateAreaId: templateArea.id,
              subjectId: subject.id,
              weeklyHours: specialSubject ? 1 : subject.weeklyHours,
              weightPercentage: specialSubject ? 100 : (templateAreas.length === 0 ? Math.round((100 / subjectCount) * 10) / 10 : 0),
              isDominant: false,
              order: subjectOrder++,
              achievementsPerPeriod: specialSubject ? 1 : undefined,
              useAttitudinalAchievement: specialSubject ? true : undefined,
            },
            include: { subject: true },
          });
          templateArea.templateSubjects.push(created);
          continue;
        }

        if (specialSubject) {
          await this.prisma.templateSubject.update({
            where: { id: existingSubject.id, AND: this.scopeWhere('templateSubject', institutionId) },
            data: {
              weeklyHours: 1,
              weightPercentage: 100,
              useAttitudinalAchievement: true,
              achievementsPerPeriod: 1,
            },
          });
          continue;
        }

        if (existingSubject.weeklyHours === 0 && subject.weeklyHours > 0) {
          await this.prisma.templateSubject.update({
            where: { id: existingSubject.id, AND: this.scopeWhere('templateSubject', institutionId) },
            data: { weeklyHours: subject.weeklyHours },
          });
        }
      }
    }

    return this.getGradeTemplate(gradeId, academicYearId, institutionId);
  }

  async removeTemplateFromGrade(gradeId: string, academicYearId: string, institutionId: string) {
    await this.assertGradeYear(gradeId, academicYearId, institutionId);
    return this.deleteInScope('gradeTemplate', { gradeId, academicYearId }, institutionId);
  }

  async getGradeTemplate(gradeId: string, academicYearId: string, institutionId: string) {
    await this.assertGradeYear(gradeId, academicYearId, institutionId);
    return this.prisma.gradeTemplate.findFirst({
      where: { gradeId, academicYearId, AND: this.scopeWhere('gradeTemplate', institutionId) },
      include: {
        grade: true,
        academicYear: true,
        template: {
          include: {
            templateAreas: { where: this.scopeWhere('templateArea', institutionId),
              include: {
                area: true,
                templateSubjects: { where: this.scopeWhere('templateSubject', institutionId),  include: { subject: true } },
              },
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    });
  }

  async listGradesWithTemplates(institutionId: string, academicYearId: string) {
    await this.loadInScope('academicYear', academicYearId, institutionId);
    // Grados de ESTA institución con su plantilla asignada PARA ESTE AÑO.
    // El filtro por institutionId es obligatorio: sin él la pantalla listaba los
    // grados de TODAS las instituciones de la base (fuga multi-tenant), y los
    // ajenos aparecían como "Sin asignar" — se veían como duplicados.
    const grades = await this.prisma.grade.findMany({
      where: { institutionId, AND: this.scopeWhere('grade', institutionId) },
      include: {
        gradeTemplates: {
          where: { AND: [{ academicYearId }, this.scopeWhere('gradeTemplate', institutionId)] },
          include: { template: true, academicYear: true },
        },
      },
      orderBy: [{ stage: 'asc' }, { number: 'asc' }],
    });

    const gradeIds = grades.map(grade => grade.id);
    const assignmentCounts = gradeIds.length > 0
      ? await this.prisma.teacherAssignment.groupBy({
          by: ['groupId'],
          where: { institutionId, academicYearId, endDate: null, group: { gradeId: { in: gradeIds } }, AND: this.scopeWhere('teacherAssignment', institutionId) },
          _count: { _all: true },
        })
      : [];

    const groupGrades = gradeIds.length > 0
      ? await this.prisma.group.findMany({
          where: { gradeId: { in: gradeIds }, AND: this.scopeWhere('group', institutionId) },
          select: { id: true, gradeId: true },
        })
      : [];

    const groupToGrade = new Map(groupGrades.map(group => [group.id, group.gradeId]));
    const countsByGrade = new Map<string, number>();

    for (const item of assignmentCounts) {
      const gradeId = groupToGrade.get(item.groupId);
      if (!gradeId) continue;
      countsByGrade.set(gradeId, (countsByGrade.get(gradeId) || 0) + item._count._all);
    }

    return grades.map(grade => ({
      ...grade,
      activeAssignmentsCount: countsByGrade.get(grade.id) || 0,
    }));
  }

  private mapGradeStageToAcademicLevel(stage: GradeStage): AcademicLevel {
    switch (stage) {
      case 'PREESCOLAR':
        return 'PREESCOLAR';
      case 'BASICA_PRIMARIA':
        return 'PRIMARIA';
      case 'BASICA_SECUNDARIA':
        return 'SECUNDARIA';
      case 'MEDIA':
      default:
        return 'MEDIA';
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXCEPCIONES POR GRUPO
  // ═══════════════════════════════════════════════════════════════════════════

  async addGroupException(data: {
    groupId: string;
    subjectId: string;
    academicYearId: string;  // 🔥 REQUERIDO
    type: GroupExceptionType;
    weeklyHours?: number;
    weightPercentage?: number;
    reason?: string;
  }, institutionId: string) {
    await this.assertGroupYear(data.groupId, data.academicYearId, institutionId);
    await this.loadInScope('subject', data.subjectId, institutionId);
    // Verificar si ya existe PARA ESTE AÑO
    const existing = await this.prisma.groupSubjectException.findFirst({
      where: { groupId: data.groupId, subjectId: data.subjectId, academicYearId: data.academicYearId, AND: this.scopeWhere('groupSubjectException', institutionId) },
    });

    if (existing) {
      // Actualizar
      return this.prisma.groupSubjectException.update({
        where: { id: existing.id, AND: this.scopeWhere('groupSubjectException', institutionId) },
        data: {
          type: data.type,
          weeklyHours: data.weeklyHours,
          weightPercentage: data.weightPercentage,
          reason: data.reason,
        },
        include: { subject: { include: { area: true } }, academicYear: true },
      });
    }

    return this.prisma.groupSubjectException.create({
      data: { groupId: data.groupId, subjectId: data.subjectId, academicYearId: data.academicYearId, type: data.type, weeklyHours: data.weeklyHours, weightPercentage: data.weightPercentage, reason: data.reason },
      include: { subject: { include: { area: true } }, academicYear: true },
    });
  }

  async removeGroupException(groupId: string, subjectId: string, academicYearId: string, institutionId: string) {
    await this.assertGroupYear(groupId, academicYearId, institutionId);
    await this.loadInScope('subject', subjectId, institutionId);
    return this.deleteInScope('groupSubjectException', { groupId, subjectId, academicYearId }, institutionId);
  }

  async getGroupExceptions(groupId: string, academicYearId: string, institutionId: string) {
    await this.assertGroupYear(groupId, academicYearId, institutionId);
    return this.prisma.groupSubjectException.findMany({
      where: { groupId, academicYearId, AND: this.scopeWhere('groupSubjectException', institutionId) },
      include: { subject: { include: { area: true } }, academicYear: true },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OBTENER ESTRUCTURA ACADÉMICA EFECTIVA
  // Resuelve la herencia: Plantilla → Grado → Grupo (con excepciones)
  // ═══════════════════════════════════════════════════════════════════════════

  async getEffectiveStructureForGroupInScope(groupId: string, academicYearId: string, institutionId: string) {
    await this.assertGroupYear(groupId, academicYearId, institutionId);
    // Obtener el grupo con su grado
    const group = await this.prisma.group.findFirst({
      where: { id: groupId, campus: { institutionId }, grade: { institutionId }, AND: this.scopeWhere('group', institutionId) },
      include: {
        grade: true,
        subjectExceptions: {
          where: { AND: [{ academicYearId, subject: { area: { institutionId } } }, this.scopeWhere('groupSubjectException', institutionId)] },
          include: { subject: true },
        },
      },
    });

    if (!group) {
      throw new NotFoundException('Grupo no encontrado');
    }

    // Obtener la plantilla asignada al grado PARA ESTE AÑO
    const gradeTemplate = await this.prisma.gradeTemplate.findFirst({
      where: { gradeId: group.gradeId, academicYearId, template: { institutionId }, grade: { institutionId }, academicYear: { institutionId }, AND: this.scopeWhere('gradeTemplate', institutionId) },
      include: {
        template: {
          include: {
            templateAreas: {
              where: { AND: [{ area: { institutionId } }, this.scopeWhere('templateArea', institutionId)] },
              include: {
                area: true,
                templateSubjects: {
                  where: { AND: [{ subject: { area: { institutionId } } }, this.scopeWhere('templateSubject', institutionId)] },
                  include: { subject: true },
                  orderBy: { order: 'asc' },
                },
              },
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    });

    if (!gradeTemplate) {
      return { group, areas: [], message: 'El grado no tiene una plantilla académica asignada para este año' };
    }

    const template = gradeTemplate.template;
    const exceptions = group.subjectExceptions;
    const excludedSubjectIds = new Set(
      exceptions.filter(e => e.type === 'EXCLUDE').map(e => e.subjectId)
    );

    // Construir estructura efectiva
    const effectiveAreas = template.templateAreas.map(ta => {
      const effectiveSubjects = ta.templateSubjects
        .filter(ts => !excludedSubjectIds.has(ts.subjectId))
        .map(ts => {
          // Buscar si hay modificación para esta asignatura
          const modification = exceptions.find(
            e => e.subjectId === ts.subjectId && e.type === 'MODIFY'
          );

          return {
            ...ts,
            weeklyHours: modification?.weeklyHours ?? ts.weeklyHours,
            weightPercentage: modification?.weightPercentage ?? ts.weightPercentage,
            hasModification: !!modification,
          };
        });

      return {
        ...ta,
        templateSubjects: effectiveSubjects,
        subjectCount: effectiveSubjects.length,
      };
    });

    return {
      group,
      template,
      areas: effectiveAreas,
      exceptions,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ENUMS
  // ═══════════════════════════════════════════════════════════════════════════

  getEnums() {
    return {
      academicLevels: [
        { value: 'PREESCOLAR', label: 'Preescolar' },
        { value: 'PRIMARIA', label: 'Primaria' },
        { value: 'SECUNDARIA', label: 'Secundaria' },
        { value: 'MEDIA', label: 'Media' },
        { value: 'MEDIA_TECNICA', label: 'Media Técnica' },
        { value: 'OTRO', label: 'Otro' },
      ],
      calculationTypes: [
        { value: 'INFORMATIVE', label: 'Informativa (no afecta promoción)' },
        { value: 'AVERAGE', label: 'Promedio simple' },
        { value: 'WEIGHTED', label: 'Promedio ponderado' },
        { value: 'DOMINANT', label: 'Asignatura dominante' },
      ],
      approvalRules: [
        { value: 'AREA_AVERAGE', label: 'Por promedio del área' },
        { value: 'ALL_SUBJECTS_PASS', label: 'Todas las asignaturas aprobadas' },
        { value: 'DOMINANT_SUBJECT_PASS', label: 'Asignatura dominante aprobada' },
      ],
      recoveryRules: [
        { value: 'INDIVIDUAL_SUBJECT', label: 'Por asignatura individual' },
        { value: 'FULL_AREA', label: 'Área completa' },
        { value: 'CONDITIONAL', label: 'Condicional' },
        { value: 'NONE', label: 'No permite recuperación' },
      ],
      subjectTypes: [
        { value: 'MANDATORY', label: 'Obligatoria' },
        { value: 'ELECTIVE', label: 'Electiva' },
        { value: 'OPTIONAL', label: 'Opcional' },
        { value: 'TECHNICAL', label: 'Técnica' },
      ],
      exceptionTypes: [
        { value: 'EXCLUDE', label: 'Excluir del grupo' },
        { value: 'INCLUDE', label: 'Incluir adicional' },
        { value: 'MODIFY', label: 'Modificar configuración' },
      ],
    };
  }
}
