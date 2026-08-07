import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AcademicLevel, AreaCalculationType, AreaApprovalRule, AreaRecoveryRule, GroupExceptionType, GradeStage } from '@prisma/client';

// ═══════════════════════════════════════════════════════════════════════════
// SERVICIO DE PLANTILLAS ACADÉMICAS
// Gestiona las plantillas que definen la estructura académica por nivel/grado
// ═══════════════════════════════════════════════════════════════════════════

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

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
    // Verificar nombre único por institución Y año
    const existing = await this.prisma.academicTemplate.findUnique({
      where: { 
        institutionId_academicYearId_name: { 
          institutionId: data.institutionId, 
          academicYearId: data.academicYearId,
          name: data.name 
        } 
      },
    });
    
    if (existing) {
      throw new BadRequestException(`Ya existe una plantilla "${data.name}" en este año académico`);
    }

    // Si es default, quitar default de otras plantillas del mismo nivel EN ESTE AÑO
    if (data.isDefault) {
      await this.prisma.academicTemplate.updateMany({
        where: { 
          institutionId: data.institutionId, 
          academicYearId: data.academicYearId,
          level: data.level, 
          isDefault: true 
        },
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
        templateAreas: {
          include: {
            area: true,
            templateSubjects: { include: { subject: true } },
          },
          orderBy: { order: 'asc' },
        },
        _count: { select: { gradeTemplates: true } },
      },
    });
  }

  async findTemplateById(id: string) {
    const template = await this.prisma.academicTemplate.findUnique({
      where: { id },
      include: {
        templateAreas: {
          include: {
            area: true,
            templateSubjects: {
              include: { subject: true },
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { order: 'asc' },
        },
        gradeTemplates: {
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
  }) {
    const template = await this.findTemplateById(id);

    // Si se marca como default, quitar default de otras
    if (data.isDefault) {
      await this.prisma.academicTemplate.updateMany({
        where: {
          institutionId: template.institutionId,
          level: data.level || template.level,
          isDefault: true,
          id: { not: id },
        },
        data: { isDefault: false },
      });
    }

    return this.prisma.academicTemplate.update({
      where: { id },
      data,
      include: {
        templateAreas: {
          include: {
            area: true,
            templateSubjects: { include: { subject: true } },
          },
          orderBy: { order: 'asc' },
        },
        _count: { select: { gradeTemplates: true } },
      },
    });
  }

  async deleteTemplate(id: string) {
    const template = await this.findTemplateById(id);
    
    // Verificar si tiene grados asignados
    if (template.gradeTemplates.length > 0) {
      throw new BadRequestException(
        'No se puede eliminar la plantilla porque tiene grados asignados. Desasigne los grados primero.'
      );
    }
    
    return this.prisma.academicTemplate.delete({ where: { id } });
  }

  async listTemplates(
    institutionId: string, 
    academicYearId: string,  // 🔥 REQUERIDO: Filtrar por año
    level?: AcademicLevel, 
    includeInactive = false
  ) {
    return this.prisma.academicTemplate.findMany({
      where: {
        institutionId,
        academicYearId,
        ...(level && { level }),
        ...(includeInactive ? {} : { isActive: true }),
      },
      include: {
        academicYear: true,
        templateAreas: {
          include: {
            area: true,
            templateSubjects: { include: { subject: true } },
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
  }) {
    // Verificar que no exista ya
    const existing = await this.prisma.templateArea.findUnique({
      where: { templateId_areaId: { templateId: data.templateId, areaId: data.areaId } },
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
        templateSubjects: { include: { subject: true } },
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
  }) {
    return this.prisma.templateArea.update({
      where: { id: templateAreaId },
      data,
      include: {
        area: true,
        templateSubjects: { include: { subject: true } },
      },
    });
  }

  async removeAreaFromTemplate(templateAreaId: string) {
    return this.prisma.templateArea.delete({ where: { id: templateAreaId } });
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
  }) {
    // Verificar que no exista ya
    const existing = await this.prisma.templateSubject.findUnique({
      where: { templateAreaId_subjectId: { templateAreaId: data.templateAreaId, subjectId: data.subjectId } },
    });
    
    if (existing) {
      throw new BadRequestException('Esta asignatura ya está en el área de la plantilla');
    }

    // Si es dominante, quitar dominante de otras asignaturas del área
    if (data.isDominant) {
      await this.prisma.templateSubject.updateMany({
        where: { templateAreaId: data.templateAreaId, isDominant: true },
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
  }) {
    const templateSubject = await this.prisma.templateSubject.findUnique({
      where: { id: templateSubjectId },
    });

    if (!templateSubject) {
      throw new NotFoundException('Configuración de asignatura no encontrada');
    }

    // Si es dominante, quitar dominante de otras
    if (data.isDominant) {
      await this.prisma.templateSubject.updateMany({
        where: { templateAreaId: templateSubject.templateAreaId, isDominant: true, id: { not: templateSubjectId } },
        data: { isDominant: false },
      });
    }

    return this.prisma.templateSubject.update({
      where: { id: templateSubjectId },
      data,
      include: { subject: true },
    });
  }

  async removeSubjectFromTemplateArea(templateSubjectId: string, force = false) {
    // Obtener la asignatura con su contexto
    const templateSubject = await this.prisma.templateSubject.findUnique({
      where: { id: templateSubjectId },
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

    const { institutionId, academicYearId } = templateSubject.templateArea.template;
    const subjectId = templateSubject.subjectId;

    // Verificar datos asociados
    const [teacherAssignments, partialGrades, finalGrades] = await Promise.all([
      this.prisma.teacherAssignment.count({
        where: { subjectId, academicYearId, institutionId },
      }),
      this.prisma.partialGrade.count({
        where: {
          teacherAssignment: { subjectId, academicYearId, institutionId },
        },
      }),
      this.prisma.periodFinalGrade.count({
        where: { subjectId, institutionId },
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

    return this.prisma.templateSubject.delete({ where: { id: templateSubjectId } });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ASIGNACIÓN DE PLANTILLAS A GRADOS (POR AÑO ACADÉMICO)
  // ═══════════════════════════════════════════════════════════════════════════

  async assignTemplateToGrade(
    gradeId: string, 
    templateId: string, 
    academicYearId: string,  // 🔥 REQUERIDO
    overrides?: any
  ) {
    // Verificar si ya tiene una plantilla asignada PARA ESTE AÑO
    const existing = await this.prisma.gradeTemplate.findUnique({
      where: { gradeId_academicYearId: { gradeId, academicYearId } },
    });
    
    if (existing) {
      // Actualizar la asignación existente
      return this.prisma.gradeTemplate.update({
        where: { id: existing.id },
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
    const grade = await this.prisma.grade.findUnique({
      where: { id: dto.gradeId },
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
        const existingGT = await tx.gradeTemplate.findUnique({
          where: { gradeId_academicYearId: { gradeId, academicYearId } },
          select: { templateId: true },
        });

        let templateId = existingGT?.templateId ?? null;
        if (!templateId) {
          let name = `Plantilla ${grade.name}`;
          const clash = await tx.academicTemplate.findUnique({
            where: { institutionId_academicYearId_name: { institutionId, academicYearId, name } },
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
            const existingArea = await tx.area.findUnique({
              where: { institutionId_name: { institutionId, name: newAreaName } },
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
          let ta = await tx.templateArea.findUnique({
            where: { templateId_areaId: { templateId, areaId } },
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
              const existingSubj = await tx.subject.findUnique({
                where: { areaId_name: { areaId, name: newSubjectName } },
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
            const existingTS = await tx.templateSubject.findUnique({
              where: { templateAreaId_subjectId: { templateAreaId: ta.id, subjectId } },
              select: { id: true },
            });
            if (existingTS) {
              await tx.templateSubject.update({ where: { id: existingTS.id }, data: { weeklyHours: hours } });
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
              where: { gradeId_academicYearId: { gradeId, academicYearId } },
              data: { templateId },
            });
          }
        } else {
          await tx.gradeTemplate.create({ data: { gradeId, templateId, academicYearId } });
        }

        return { success: true, templateId, gradeId, areasProcessed: dto.areas.length };
      },
      { timeout: 30000 },
    );
  }

  async syncTemplateFromActiveAssignments(
    gradeId: string,
    academicYearId: string,
    options?: { countInAverage?: boolean },
  ) {
    const grade = await this.prisma.grade.findUnique({
      where: { id: gradeId },
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
      where: {
        institutionId: grade.institutionId,
        academicYearId,
        group: { gradeId },
        endDate: null,
      },
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

    const existingGradeTemplate = await this.prisma.gradeTemplate.findUnique({
      where: { gradeId_academicYearId: { gradeId, academicYearId } },
      include: {
        template: {
          include: {
            templateAreas: {
              include: {
                area: true,
                templateSubjects: { include: { subject: true } },
              },
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    });

    let template = existingGradeTemplate?.template;

    if (!template) {
      const reusableTemplate = await this.prisma.academicTemplate.findFirst({
        where: {
          institutionId: grade.institutionId,
          academicYearId,
          level,
          isActive: true,
          gradeTemplates: { none: {} },
        },
        include: {
          templateAreas: {
            include: {
              area: true,
              templateSubjects: { include: { subject: true } },
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
        institutionId: grade.institutionId,
        academicYearId,
        name: `Plantilla ${grade.name}`,
        description: `Plantilla creada desde las asignaciones activas de ${grade.name}`,
        level,
        isDefault: false,
        achievementsPerPeriod: 1,
        useAttitudinalAchievement: false,
      });
    }

    if (!existingGradeTemplate || existingGradeTemplate.templateId !== template.id) {
      await this.assignTemplateToGrade(gradeId, template.id, academicYearId, existingGradeTemplate?.overrides);
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
            templateSubjects: { include: { subject: true } },
          },
        });
        templateAreaMap.set(areaId, templateArea);
      } else if (
        (specialArea && (templateArea.calculationType !== 'INFORMATIVE' || templateArea.weightPercentage !== 0 || templateArea.isMandatory)) ||
        (!specialArea && isConvivenciaArea && (templateArea.calculationType !== 'AVERAGE' || templateArea.isMandatory === false))
      ) {
        templateArea = await this.prisma.templateArea.update({
          where: { id: templateArea.id },
          data: {
            weightPercentage: specialArea ? 0 : (templateArea.weightPercentage > 0 ? templateArea.weightPercentage : Math.round((100 / areaCount) * 10) / 10),
            calculationType: specialArea ? 'INFORMATIVE' : 'AVERAGE',
            isMandatory: specialArea ? false : true,
          },
          include: {
            area: true,
            templateSubjects: { include: { subject: true } },
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
            where: { id: existingSubject.id },
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
            where: { id: existingSubject.id },
            data: { weeklyHours: subject.weeklyHours },
          });
        }
      }
    }

    return this.getGradeTemplate(gradeId, academicYearId);
  }

  async removeTemplateFromGrade(gradeId: string, academicYearId: string) {
    return this.prisma.gradeTemplate.delete({ 
      where: { gradeId_academicYearId: { gradeId, academicYearId } } 
    });
  }

  async getGradeTemplate(gradeId: string, academicYearId: string) {
    return this.prisma.gradeTemplate.findUnique({
      where: { gradeId_academicYearId: { gradeId, academicYearId } },
      include: {
        grade: true,
        academicYear: true,
        template: {
          include: {
            templateAreas: {
              include: {
                area: true,
                templateSubjects: { include: { subject: true } },
              },
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    });
  }

  async listGradesWithTemplates(institutionId: string, academicYearId: string) {
    // Grados de ESTA institución con su plantilla asignada PARA ESTE AÑO.
    // El filtro por institutionId es obligatorio: sin él la pantalla listaba los
    // grados de TODAS las instituciones de la base (fuga multi-tenant), y los
    // ajenos aparecían como "Sin asignar" — se veían como duplicados.
    const grades = await this.prisma.grade.findMany({
      where: { institutionId },
      include: {
        gradeTemplates: {
          where: { academicYearId },
          include: { template: true, academicYear: true },
        },
      },
      orderBy: [{ stage: 'asc' }, { number: 'asc' }],
    });

    const gradeIds = grades.map(grade => grade.id);
    const assignmentCounts = gradeIds.length > 0
      ? await this.prisma.teacherAssignment.groupBy({
          by: ['groupId'],
          where: {
            institutionId,
            academicYearId,
            endDate: null,
            group: { gradeId: { in: gradeIds } },
          },
          _count: { _all: true },
        })
      : [];

    const groupGrades = gradeIds.length > 0
      ? await this.prisma.group.findMany({
          where: { gradeId: { in: gradeIds } },
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
  }) {
    // Verificar si ya existe PARA ESTE AÑO
    const existing = await this.prisma.groupSubjectException.findUnique({
      where: { 
        groupId_subjectId_academicYearId: { 
          groupId: data.groupId, 
          subjectId: data.subjectId,
          academicYearId: data.academicYearId 
        } 
      },
    });
    
    if (existing) {
      // Actualizar
      return this.prisma.groupSubjectException.update({
        where: { id: existing.id },
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
      data,
      include: { subject: { include: { area: true } }, academicYear: true },
    });
  }

  async removeGroupException(groupId: string, subjectId: string, academicYearId: string) {
    return this.prisma.groupSubjectException.delete({
      where: { 
        groupId_subjectId_academicYearId: { groupId, subjectId, academicYearId } 
      },
    });
  }

  async getGroupExceptions(groupId: string, academicYearId: string) {
    return this.prisma.groupSubjectException.findMany({
      where: { groupId, academicYearId },
      include: { subject: { include: { area: true } }, academicYear: true },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OBTENER ESTRUCTURA ACADÉMICA EFECTIVA
  // Resuelve la herencia: Plantilla → Grado → Grupo (con excepciones)
  // ═══════════════════════════════════════════════════════════════════════════

  async getEffectiveStructureForGroup(groupId: string, academicYearId: string) {
    // Obtener el grupo con su grado
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        grade: true,
        subjectExceptions: {
          where: { academicYearId },
          include: { subject: true },
        },
      },
    });

    if (!group) {
      throw new NotFoundException('Grupo no encontrado');
    }

    // Obtener la plantilla asignada al grado PARA ESTE AÑO
    const gradeTemplate = await this.prisma.gradeTemplate.findUnique({
      where: { gradeId_academicYearId: { gradeId: group.gradeId, academicYearId } },
      include: {
        template: {
          include: {
            templateAreas: {
              include: {
                area: true,
                templateSubjects: {
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
