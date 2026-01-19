import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class StatisticsService {
  constructor(private prisma: PrismaService) {}

  async getGeneralStats(institutionId: string, academicYearId?: string) {
    // Get current academic year if not provided
    let yearId = academicYearId;
    if (!yearId) {
      const currentYear = await this.prisma.academicYear.findFirst({
        where: { institutionId },
        orderBy: { year: 'desc' },
      });
      yearId = currentYear?.id;
    }

    if (!yearId) {
      return {
        totalStudents: 0,
        generalAverage: 0,
        approvalRate: 0,
        attendanceRate: 0,
      };
    }

    // Total students enrolled
    const totalStudents = await this.prisma.studentEnrollment.count({
      where: {
        academicYearId: yearId,
        status: 'ACTIVE',
        student: { institutionId },
      },
    });

    // Get all grades for the year
    const grades = await this.prisma.studentGrade.findMany({
      where: {
        studentEnrollment: {
          academicYearId: yearId,
          status: 'ACTIVE',
          student: { institutionId },
        },
      },
      select: { score: true },
    });

    // Calculate general average
    let generalAverage = 0;
    if (grades.length > 0) {
      const sum = grades.reduce((acc, g) => acc + Number(g.score), 0);
      generalAverage = Math.round((sum / grades.length) * 100) / 100;
    }

    // Get performance scale for approval threshold
    const scale = await this.prisma.performanceScale.findFirst({
      where: { institutionId, level: 'BASICO' },
    });
    const approvalThreshold = scale ? Number(scale.minScore) : 3.0;

    // Calculate approval rate from period final grades
    const periodGrades = await this.prisma.periodFinalGrade.findMany({
      where: {
        studentEnrollment: {
          academicYearId: yearId,
          status: 'ACTIVE',
          student: { institutionId },
        },
      },
      select: { finalScore: true },
    });

    let approvalRate = 0;
    if (periodGrades.length > 0) {
      const approved = periodGrades.filter(g => Number(g.finalScore) >= approvalThreshold).length;
      approvalRate = Math.round((approved / periodGrades.length) * 100);
    }

    // Calculate attendance rate
    const attendanceRecords = await this.prisma.attendanceRecord.findMany({
      where: {
        teacherAssignment: {
          academicYearId: yearId,
        },
        studentEnrollment: {
          student: { institutionId },
        },
      },
      select: { status: true },
    });

    let attendanceRate = 0;
    if (attendanceRecords.length > 0) {
      const present = attendanceRecords.filter(r => r.status === 'PRESENT' || r.status === 'LATE').length;
      attendanceRate = Math.round((present / attendanceRecords.length) * 100);
    }

    return {
      totalStudents,
      generalAverage,
      approvalRate,
      attendanceRate,
    };
  }

  async getPerformanceDistribution(institutionId: string, academicYearId?: string, academicTermId?: string) {
    // Get current academic year if not provided
    let yearId = academicYearId;
    if (!yearId) {
      const currentYear = await this.prisma.academicYear.findFirst({
        where: { institutionId },
        orderBy: { year: 'desc' },
      });
      yearId = currentYear?.id;
    }

    if (!yearId) {
      return [];
    }

    // Get performance scale
    const scale = await this.prisma.performanceScale.findMany({
      where: { institutionId },
      orderBy: { minScore: 'desc' },
    });

    if (scale.length === 0) {
      return [];
    }

    // Get grades
    const whereClause: any = {
      studentEnrollment: {
        academicYearId: yearId,
        status: 'ACTIVE',
        student: { institutionId },
      },
    };

    if (academicTermId) {
      whereClause.academicTermId = academicTermId;
    }

    const periodGrades = await this.prisma.periodFinalGrade.findMany({
      where: whereClause,
      select: { finalScore: true },
    });

    // Count by level
    const distribution = scale.map(s => {
      const count = periodGrades.filter(g => {
        const score = Number(g.finalScore);
        return score >= Number(s.minScore) && score <= Number(s.maxScore);
      }).length;

      return {
        level: s.level,
        count,
        percentage: periodGrades.length > 0 ? Math.round((count / periodGrades.length) * 100) : 0,
      };
    });

    return distribution;
  }

  async getSubjectStats(institutionId: string, academicYearId?: string, academicTermId?: string) {
    // Get current academic year if not provided
    let yearId = academicYearId;
    if (!yearId) {
      const currentYear = await this.prisma.academicYear.findFirst({
        where: { institutionId },
        orderBy: { year: 'desc' },
      });
      yearId = currentYear?.id;
    }

    if (!yearId) {
      return [];
    }

    // Get performance scale for approval threshold
    const scale = await this.prisma.performanceScale.findFirst({
      where: { institutionId, level: 'BASICO' },
    });
    const approvalThreshold = scale ? Number(scale.minScore) : 3.0;

    // Get all subjects with grades
    const subjects = await this.prisma.subject.findMany({
      where: {
        area: { institutionId },
      },
      include: {
        area: true,
        periodFinalGrades: {
          where: {
            studentEnrollment: {
              academicYearId: yearId,
              status: 'ACTIVE',
            },
            ...(academicTermId ? { academicTermId } : {}),
          },
          select: { finalScore: true },
        },
      },
    });

    const stats = subjects
      .filter(s => s.periodFinalGrades.length > 0)
      .map(subject => {
        const grades = subject.periodFinalGrades;
        const sum = grades.reduce((acc, g) => acc + Number(g.finalScore), 0);
        const avg = Math.round((sum / grades.length) * 100) / 100;
        const approved = grades.filter(g => Number(g.finalScore) >= approvalThreshold).length;
        const approvalRate = Math.round((approved / grades.length) * 100);

        return {
          id: subject.id,
          name: subject.name,
          areaName: subject.area.name,
          average: avg,
          approvalRate,
          totalGrades: grades.length,
        };
      })
      .sort((a, b) => b.average - a.average);

    return stats;
  }

  async getGroupStats(institutionId: string, academicYearId?: string, academicTermId?: string) {
    // Get current academic year if not provided
    let yearId = academicYearId;
    if (!yearId) {
      const currentYear = await this.prisma.academicYear.findFirst({
        where: { institutionId },
        orderBy: { year: 'desc' },
      });
      yearId = currentYear?.id;
    }

    if (!yearId) {
      return [];
    }

    // Get performance scale for approval threshold
    const scale = await this.prisma.performanceScale.findFirst({
      where: { institutionId, level: 'BASICO' },
    });
    const approvalThreshold = scale ? Number(scale.minScore) : 3.0;

    // Get all groups for this institution (via campus)
    const groups = await this.prisma.group.findMany({
      where: {
        campus: { institutionId },
      },
      include: {
        grade: { select: { name: true } },
      },
    });

    // Get enrollments with grades for each group
    const stats = await Promise.all(
      groups.map(async (group) => {
        const enrollments = await this.prisma.studentEnrollment.findMany({
          where: {
            groupId: group.id,
            academicYearId: yearId,
            status: 'ACTIVE',
          },
          include: {
            periodFinalGrades: {
              where: academicTermId ? { academicTermId } : {},
              select: { finalScore: true },
            },
          },
        });

        const allGrades = enrollments.flatMap(e => e.periodFinalGrades);
        
        let avg = 0;
        let approvalRate = 0;
        
        if (allGrades.length > 0) {
          const sum = allGrades.reduce((acc, g) => acc + Number(g.finalScore), 0);
          avg = Math.round((sum / allGrades.length) * 100) / 100;
          const approved = allGrades.filter(g => Number(g.finalScore) >= approvalThreshold).length;
          approvalRate = Math.round((approved / allGrades.length) * 100);
        }

        return {
          id: group.id,
          name: `${group.grade.name} - ${group.name}`,
          studentCount: enrollments.length,
          average: avg,
          approvalRate,
        };
      })
    );

    return stats
      .filter(s => s.studentCount > 0)
      .sort((a, b) => b.average - a.average);
  }

  async getFullStatistics(institutionId: string, academicYearId?: string, academicTermId?: string) {
    const [general, performanceDistribution, subjectStats, groupStats] = await Promise.all([
      this.getGeneralStats(institutionId, academicYearId),
      this.getPerformanceDistribution(institutionId, academicYearId, academicTermId),
      this.getSubjectStats(institutionId, academicYearId, academicTermId),
      this.getGroupStats(institutionId, academicYearId, academicTermId),
    ]);

    return {
      general,
      performanceDistribution,
      subjectStats,
      groupStats,
    };
  }
}
