import { Prisma } from '@prisma/client';

/** Filtros B1 comprobados además con strictNullChecks contra el cliente generado. */
export function b1SectionWhere(
  ids: string[] | undefined, classroomId: string, academicYearId: string,
  institutionId: string, visibleOnly: boolean,
): Prisma.ClassroomSectionWhereInput {
  return {
    ...(ids ? { id: { in: ids } } : {}), classroomId, classroom: { institutionId },
    ...(visibleOnly ? { isVisible: true } : {}),
    OR: [
      { academicTermId: null },
      { academicTerm: { academicYearId, academicYear: { institutionId } } },
    ],
  };
}

export function b1RubricArgs(id: string, institutionId: string) {
  return {
    where: { id, institutionId },
    include: { criteria: {
      include: { levels: { orderBy: { order: 'asc' } } },
      orderBy: { order: 'asc' },
    } },
  } satisfies Prisma.AttitudinalRubricFindFirstArgs;
}

export function b1DependencyWhere(classroomId: string): Prisma.ActivityDependencyWhereInput {
  return { activity: { classroomId }, prerequisite: { classroomId } };
}

/** Conteos docentes: entregas históricas propias, sin matrículas de otro colegio. */
export function b1SubmissionWhere(institutionId: string): Prisma.ActivitySubmissionWhereInput {
  return { studentEnrollment: {
    institutionId, student: { institutionId }, academicYear: { institutionId },
    group: { campus: { institutionId }, grade: { institutionId } },
  } };
}
