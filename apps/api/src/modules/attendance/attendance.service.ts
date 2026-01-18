import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { RecordAttendanceDto, UpdateAttendanceDto } from './dto/record-attendance.dto';

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async recordBulk(dto: RecordAttendanceDto) {
    const date = new Date(dto.date);

    const operations = dto.records.map((record) =>
      this.prisma.attendanceRecord.upsert({
        where: {
          teacherAssignmentId_studentEnrollmentId_date: {
            teacherAssignmentId: dto.teacherAssignmentId,
            studentEnrollmentId: record.studentEnrollmentId,
            date,
          },
        },
        update: {
          status: record.status,
          observations: record.observations,
        },
        create: {
          teacherAssignmentId: dto.teacherAssignmentId,
          studentEnrollmentId: record.studentEnrollmentId,
          date,
          status: record.status,
          observations: record.observations,
        },
      }),
    );

    return this.prisma.$transaction(operations);
  }

  async update(id: string, dto: UpdateAttendanceDto) {
    return this.prisma.attendanceRecord.update({
      where: { id },
      data: {
        status: dto.status,
        observations: dto.observations,
      },
    });
  }

  async getByAssignmentAndDate(teacherAssignmentId: string, date: string) {
    return this.prisma.attendanceRecord.findMany({
      where: {
        teacherAssignmentId,
        date: new Date(date),
      },
      include: {
        studentEnrollment: {
          include: {
            student: true,
          },
        },
      },
      orderBy: {
        studentEnrollment: {
          student: {
            lastName: 'asc',
          },
        },
      },
    });
  }

  async getByStudent(studentEnrollmentId: string, startDate?: string, endDate?: string) {
    return this.prisma.attendanceRecord.findMany({
      where: {
        studentEnrollmentId,
        ...(startDate && endDate
          ? {
              date: {
                gte: new Date(startDate),
                lte: new Date(endDate),
              },
            }
          : {}),
      },
      include: {
        teacherAssignment: {
          include: {
            subject: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    });
  }

  async getStudentSummary(studentEnrollmentId: string, academicTermId?: string) {
    const whereClause: any = { studentEnrollmentId };

    if (academicTermId) {
      const term = await this.prisma.academicTerm.findUnique({
        where: { id: academicTermId },
      });
      if (term?.startDate && term?.endDate) {
        whereClause.date = {
          gte: term.startDate,
          lte: term.endDate,
        };
      }
    }

    const records = await this.prisma.attendanceRecord.findMany({
      where: whereClause,
    });

    const summary = {
      total: records.length,
      present: records.filter((r) => r.status === 'PRESENT').length,
      absent: records.filter((r) => r.status === 'ABSENT').length,
      late: records.filter((r) => r.status === 'LATE').length,
      excused: records.filter((r) => r.status === 'EXCUSED').length,
      attendanceRate: 0,
    };

    if (summary.total > 0) {
      summary.attendanceRate = Math.round(
        ((summary.present + summary.late + summary.excused) / summary.total) * 100,
      );
    }

    return summary;
  }

  async getGroupAttendanceReport(teacherAssignmentId: string, startDate: string, endDate: string) {
    const assignment = await this.prisma.teacherAssignment.findUnique({
      where: { id: teacherAssignmentId },
      include: {
        group: true,
        subject: true,
      },
    });

    if (!assignment) {
      throw new Error('Teacher assignment not found');
    }

    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: {
        groupId: assignment.groupId,
        academicYearId: assignment.academicYearId,
        status: 'ACTIVE',
      },
      include: {
        student: true,
        attendanceRecords: {
          where: {
            teacherAssignmentId,
            date: {
              gte: new Date(startDate),
              lte: new Date(endDate),
            },
          },
        },
      },
      orderBy: {
        student: {
          lastName: 'asc',
        },
      },
    });

    return enrollments.map((enrollment) => {
      const records = enrollment.attendanceRecords;
      const total = records.length;
      const present = records.filter((r) => r.status === 'PRESENT').length;
      const absent = records.filter((r) => r.status === 'ABSENT').length;
      const late = records.filter((r) => r.status === 'LATE').length;
      const excused = records.filter((r) => r.status === 'EXCUSED').length;

      return {
        student: {
          id: enrollment.student.id,
          firstName: enrollment.student.firstName,
          lastName: enrollment.student.lastName,
          documentNumber: enrollment.student.documentNumber,
        },
        enrollmentId: enrollment.id,
        summary: {
          total,
          present,
          absent,
          late,
          excused,
          attendanceRate: total > 0 ? Math.round(((present + late + excused) / total) * 100) : 0,
        },
      };
    });
  }
}
