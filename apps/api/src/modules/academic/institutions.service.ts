import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { CreateInstitutionDto } from './dto/create-institution.dto';

@Injectable()
export class InstitutionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateInstitutionDto) {
    return this.prisma.institution.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        daneCode: dto.daneCode,
        nit: dto.nit,
        status: 'TRIAL',
      },
    });
  }

  async list() {
    return this.prisma.institution.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Devuelve el estado de configuración inicial de una institución.
   * Infiere el paso actual a partir de la presencia de datos (no requiere flag manual).
   *
   * Orden canónico de dependencias (auditoría UX §1.2):
   *   IDENTITY → ACADEMIC_YEAR → LEVELS → GRADES → SUBJECTS → GROUPS → TEACHERS → WORKLOAD → STUDENTS → DONE
   */
  async getSetupStatus(institutionId: string) {
    const [
      institution,
      academicYearCount,
      gradeCount,
      subjectCount,
      groupCount,
      teacherCount,
      teacherAssignmentCount,
      studentCount,
    ] = await Promise.all([
      this.prisma.institution.findUnique({
        where: { id: institutionId },
        select: {
          id: true,
          name: true,
          logo: true,
          daneCode: true,
          nit: true,
          academicLevelsConfig: true,
        },
      }),
      this.prisma.academicYear.count({ where: { institutionId } }),
      this.prisma.grade.count({ where: { institutionId } }),
      this.prisma.subject.count({ where: { area: { institutionId } } }),
      this.prisma.group.count({ where: { campus: { institutionId } } }),
      this.prisma.user.count({
        where: {
          institutionUsers: { some: { institutionId } },
          roles: { some: { role: { name: 'DOCENTE' } } },
        },
      }),
      this.prisma.teacherAssignment.count({ where: { institutionId } }),
      this.prisma.student.count({ where: { institutionId } }),
    ]);

    // Niveles académicos viven en Institution.academicLevelsConfig (JSON)
    const levelsConfig = institution?.academicLevelsConfig as any;
    const academicLevelCount = Array.isArray(levelsConfig)
      ? levelsConfig.length
      : levelsConfig && typeof levelsConfig === 'object' && Array.isArray(levelsConfig.levels)
        ? levelsConfig.levels.length
        : 0;

    const steps = [
      {
        key: 'IDENTITY',
        label: 'Identidad institucional',
        complete: !!(institution?.name && institution.logo),
        count: institution ? (institution.logo ? 2 : 1) : 0,
        target: 2, // name + logo
        path: '/institution/profile',
      },
      {
        key: 'ACADEMIC_YEAR',
        label: 'Año académico',
        complete: academicYearCount > 0,
        count: academicYearCount,
        target: 1,
        path: '/academic/year/setup',
      },
      {
        key: 'LEVELS',
        label: 'Niveles académicos',
        complete: academicLevelCount > 0,
        count: academicLevelCount,
        target: 1,
        path: '/academic/config/levels',
      },
      {
        key: 'GRADES',
        label: 'Grados',
        complete: gradeCount > 0,
        count: gradeCount,
        target: 1,
        path: '/institution/structure',
      },
      {
        key: 'SUBJECTS',
        label: 'Asignaturas',
        complete: subjectCount > 0,
        count: subjectCount,
        target: 1,
        path: '/academic/catalog',
      },
      {
        key: 'GROUPS',
        label: 'Grupos',
        complete: groupCount > 0,
        count: groupCount,
        target: 1,
        path: '/institution/structure',
      },
      {
        key: 'TEACHERS',
        label: 'Docentes',
        complete: teacherCount > 0,
        count: teacherCount,
        target: 1,
        path: '/teachers',
      },
      {
        key: 'WORKLOAD',
        label: 'Carga académica',
        complete: teacherAssignmentCount > 0,
        count: teacherAssignmentCount,
        target: 1,
        path: '/academic/assignments',
      },
      {
        key: 'STUDENTS',
        label: 'Estudiantes',
        complete: studentCount > 0,
        count: studentCount,
        target: 1,
        path: '/students/enrollments',
      },
    ];

    // El paso actual es el primero incompleto; si todos están completos, DONE
    const currentStep = steps.find((s) => !s.complete);
    const completedCount = steps.filter((s) => s.complete).length;
    const progress = Math.round((completedCount / steps.length) * 100);

    return {
      institution: {
        id: institution?.id,
        name: institution?.name,
        logo: institution?.logo,
      },
      currentStep: currentStep?.key ?? 'DONE',
      currentStepLabel: currentStep?.label ?? 'Configuración completada',
      nextPath: currentStep?.path ?? null,
      progress,
      completedCount,
      totalSteps: steps.length,
      steps,
    };
  }
}
