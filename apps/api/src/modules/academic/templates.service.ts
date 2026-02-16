import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AcademicLevel, AreaCalculationType, AreaApprovalRule, AreaRecoveryRule, GroupExceptionType } from '@prisma/client';

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
    // Obtener todos los grados y sus plantillas asignadas PARA ESTE AÑO
    const grades = await this.prisma.grade.findMany({
      include: {
        gradeTemplates: {
          where: { academicYearId },
          include: { template: true, academicYear: true },
        },
      },
      orderBy: [{ stage: 'asc' }, { number: 'asc' }],
    });

    return grades;
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
