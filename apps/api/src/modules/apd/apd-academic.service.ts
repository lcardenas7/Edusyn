import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Servicio de cruce rendimiento académico vs APD.
 *
 * Compara el desempeño académico de estudiantes con perfil APD activo
 * contra el promedio institucional usando PeriodFinalGrade.
 */
@Injectable()
export class ApdAcademicService {
  constructor(private readonly prisma: PrismaService) {}

  async getAcademicCrossover(institutionId: string, academicTermId?: string) {
    // 1. Perfiles APD activos → set de enrollmentIds
    const activeProfiles = await this.prisma.educationalSupportProfile.findMany({
      where: { institutionId, active: true },
      select: {
        id: true,
        studentId: true,
        supportCategory: true,
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            enrollments: {
              where: { status: 'ACTIVE' },
              take: 1,
              select: {
                id: true,
                group: {
                  select: {
                    id: true,
                    name: true,
                    grade: { select: { id: true, name: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    // Map enrollmentId → studentId for APD students
    const apdEnrollmentIds = new Set<string>();
    const enrollmentToStudent = new Map<string, string>();
    for (const p of activeProfiles) {
      const enrollment = p.student.enrollments[0];
      if (enrollment) {
        apdEnrollmentIds.add(enrollment.id);
        enrollmentToStudent.set(enrollment.id, p.studentId);
      }
    }

    // 2. Notas finales por período
    const termFilter = academicTermId ? { academicTermId } : {};
    const grades = await this.prisma.periodFinalGrade.findMany({
      where: { institutionId, ...termFilter },
      select: {
        studentEnrollmentId: true,
        finalScore: true,
        subjectId: true,
        studentEnrollment: {
          select: {
            group: {
              select: {
                id: true,
                name: true,
                grade: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    // 3. Separar APD vs no-APD
    const apdScores: number[] = [];
    const nonApdScores: number[] = [];
    const byGrade = new Map<
      string,
      {
        gradeName: string;
        apdScores: number[];
        nonApdScores: number[];
        apdStudents: Set<string>;
        nonApdStudents: Set<string>;
      }
    >();

    const apdStudentScores = new Map<string, number[]>();

    for (const g of grades) {
      const score = Number(g.finalScore);
      if (isNaN(score)) continue;

      const isApd = apdEnrollmentIds.has(g.studentEnrollmentId);
      const gradeId = g.studentEnrollment.group?.grade?.id || 'sin-grado';
      const gradeName = g.studentEnrollment.group?.grade?.name || 'Sin grado';

      if (isApd) {
        apdScores.push(score);
        const sid = enrollmentToStudent.get(g.studentEnrollmentId) || g.studentEnrollmentId;
        if (!apdStudentScores.has(sid)) apdStudentScores.set(sid, []);
        apdStudentScores.get(sid)!.push(score);
      } else {
        nonApdScores.push(score);
      }

      if (!byGrade.has(gradeId)) {
        byGrade.set(gradeId, { gradeName, apdScores: [], nonApdScores: [], apdStudents: new Set(), nonApdStudents: new Set() });
      }
      const entry = byGrade.get(gradeId)!;
      if (isApd) {
        entry.apdScores.push(score);
        entry.apdStudents.add(g.studentEnrollmentId);
      } else {
        entry.nonApdScores.push(score);
        entry.nonApdStudents.add(g.studentEnrollmentId);
      }
    }

    const avg = (arr: number[]) =>
      arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : null;
    const round2 = (n: number | null) => (n !== null ? Math.round(n * 100) / 100 : null);

    // 4. Detalle por estudiante APD
    const studentDetails = activeProfiles.map((p) => {
      const scores = apdStudentScores.get(p.studentId) || [];
      const studentAvg = avg(scores);
      const enrollment = p.student.enrollments[0];
      return {
        studentId: p.studentId,
        studentName: `${p.student.lastName} ${p.student.firstName}`,
        supportCategory: p.supportCategory,
        group: enrollment?.group?.name || null,
        grade: enrollment?.group?.grade?.name || null,
        averageGrade: round2(studentAvg),
        subjectCount: scores.length,
      };
    });
    studentDetails.sort((a, b) => (a.averageGrade ?? 99) - (b.averageGrade ?? 99));

    const globalApdAvg = avg(apdScores);
    const globalNonApdAvg = avg(nonApdScores);

    return {
      global: {
        apdStudentCount: apdEnrollmentIds.size,
        apdAverage: round2(globalApdAvg),
        nonApdAverage: round2(globalNonApdAvg),
        gap: globalApdAvg !== null && globalNonApdAvg !== null
          ? round2(globalNonApdAvg - globalApdAvg)
          : null,
      },
      byGrade: Array.from(byGrade.values())
        .map((v) => {
          const aA = avg(v.apdScores);
          const nA = avg(v.nonApdScores);
          return {
            grade: v.gradeName,
            apdStudents: v.apdStudents.size,
            nonApdStudents: v.nonApdStudents.size,
            apdAverage: round2(aA),
            nonApdAverage: round2(nA),
            gap: aA !== null && nA !== null ? round2(nA - aA) : null,
          };
        })
        .sort((a, b) => a.grade.localeCompare(b.grade)),
      students: studentDetails,
    };
  }
}
