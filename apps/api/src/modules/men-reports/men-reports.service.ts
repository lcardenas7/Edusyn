import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { EnrollmentStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { StudentsService } from '../academic/students.service';
import { GenerateReportDto, PromotionReportDto } from './dto/men-reports.dto';

@Injectable()
export class MenReportsService {
  constructor(
    private readonly prisma: PrismaService, // Solo para consultas que aún no tienen servicio
    private readonly studentsService: StudentsService,
  ) {}

  async generateSimatExport(dto: GenerateReportDto) {
    // Delegar a StudentsService para obtener matrículas
    const students = await this.studentsService.getEnrollmentsForMenReport({
      academicYearId: dto.academicYearId,
      gradeId: dto.gradeId,
      campusId: dto.campusId,
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('SIMAT');

    sheet.columns = [
      { header: 'TIPO_DOCUMENTO', key: 'tipoDoc', width: 15 },
      { header: 'NUMERO_DOCUMENTO', key: 'numDoc', width: 20 },
      { header: 'PRIMER_NOMBRE', key: 'nombre1', width: 20 },
      { header: 'SEGUNDO_NOMBRE', key: 'nombre2', width: 20 },
      { header: 'PRIMER_APELLIDO', key: 'apellido1', width: 20 },
      { header: 'SEGUNDO_APELLIDO', key: 'apellido2', width: 20 },
      { header: 'FECHA_NACIMIENTO', key: 'fechaNac', width: 15 },
      { header: 'GENERO', key: 'genero', width: 10 },
      { header: 'GRADO', key: 'grado', width: 10 },
      { header: 'GRUPO', key: 'grupo', width: 10 },
      { header: 'SEDE', key: 'sede', width: 25 },
      { header: 'ESTADO', key: 'estado', width: 15 },
    ];

    for (const enrollment of students) {
      // Usar propiedades del DTO EnrollmentForMenReport
      const s = enrollment.student;
      const g = enrollment.group;
      const names = s.firstName.split(' ');
      const lastNames = s.lastName.split(' ');

      sheet.addRow({
        tipoDoc: s.documentType || 'TI',
        numDoc: s.documentNumber,
        nombre1: names[0] || '',
        nombre2: names[1] || '',
        apellido1: lastNames[0] || '',
        apellido2: lastNames[1] || '',
        fechaNac: s.birthDate?.toISOString().split('T')[0] || '',
        genero: s.gender || '',
        grado: g.gradeName,
        grupo: g.name,
        sede: g.campusName || '',
        estado: enrollment.status,
      });
    }

    return workbook;
  }

  async generateEnrollmentStats(dto: GenerateReportDto) {
    // Delegar a StudentsService para obtener matrículas
    const enrollments = await this.studentsService.getEnrollmentsForMenReport({
      academicYearId: dto.academicYearId,
    });

    const byStatus: Record<string, number> = {};
    const byGrade: Record<string, { gradeName: string; groupName: string; campusName: string; count: number }> = {};

    for (const e of enrollments) {
      byStatus[e.status] = (byStatus[e.status] || 0) + 1;
      
      // Usar propiedades del DTO EnrollmentForMenReport
      const key = e.group.id;
      if (!byGrade[key]) {
        byGrade[key] = {
          gradeName: e.group.gradeName,
          groupName: e.group.name,
          campusName: e.group.campusName || '',
          count: 0,
        };
      }
      if (e.status === 'ACTIVE') {
        byGrade[key].count++;
      }
    }

    return {
      summary: {
        total: enrollments.length,
        byStatus: Object.entries(byStatus).map(([status, count]) => ({ status, count })),
      },
      byGrade: Object.values(byGrade).filter(g => g.count > 0),
    };
  }

  async generatePromotionReport(dto: PromotionReportDto) {
    // Delegar a StudentsService para obtener matrículas activas
    const enrollments = await this.studentsService.getEnrollmentsForMenReport({
      academicYearId: dto.academicYearId,
      status: EnrollmentStatus.ACTIVE,
    });

    const allGrades = await this.prisma.studentGrade.findMany({
      where: {
        studentEnrollmentId: { in: enrollments.map(e => e.id) },
      },
    });

    const gradesByEnrollment = new Map<string, typeof allGrades>();
    for (const g of allGrades) {
      if (!gradesByEnrollment.has(g.studentEnrollmentId)) {
        gradesByEnrollment.set(g.studentEnrollmentId, []);
      }
      gradesByEnrollment.get(g.studentEnrollmentId)!.push(g);
    }

    const results = enrollments.map((enrollment) => {
      const grades = gradesByEnrollment.get(enrollment.id) || [];
      const avgFinal = grades.length > 0
        ? grades.reduce((acc, g) => acc + Number(g.score), 0) / grades.length
        : 0;

      const failedSubjects = avgFinal < 3.0 ? 1 : 0;

      let promotionStatus: 'PROMOTED' | 'FAILED' | 'PENDING' = 'PENDING';
      if (grades.length > 0) {
        promotionStatus = failedSubjects <= 2 ? 'PROMOTED' : 'FAILED';
      }

      // Usar propiedades del DTO EnrollmentForMenReport
      return {
        studentId: enrollment.studentId,
        studentName: `${enrollment.student.firstName} ${enrollment.student.lastName}`,
        documentNumber: enrollment.student.documentNumber,
        gradeName: enrollment.group.gradeName,
        groupName: enrollment.group.name,
        finalAverage: avgFinal,
        failedSubjects,
        promotionStatus,
      };
    });

    const summary = {
      total: results.length,
      promoted: results.filter((r) => r.promotionStatus === 'PROMOTED').length,
      failed: results.filter((r) => r.promotionStatus === 'FAILED').length,
      pending: results.filter((r) => r.promotionStatus === 'PENDING').length,
      promotionRate: 0,
    };

    summary.promotionRate = summary.total > 0
      ? Math.round((summary.promoted / summary.total) * 100)
      : 0;

    return { summary, students: results };
  }

  async generatePromotionExcel(dto: PromotionReportDto) {
    const data = await this.generatePromotionReport(dto);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Promoción');

    sheet.columns = [
      { header: 'DOCUMENTO', key: 'documento', width: 15 },
      { header: 'ESTUDIANTE', key: 'estudiante', width: 35 },
      { header: 'GRADO', key: 'grado', width: 10 },
      { header: 'GRUPO', key: 'grupo', width: 10 },
      { header: 'PROMEDIO', key: 'promedio', width: 12 },
      { header: 'ÁREAS PERDIDAS', key: 'perdidas', width: 15 },
      { header: 'ESTADO', key: 'estado', width: 15 },
    ];

    for (const student of data.students) {
      sheet.addRow({
        documento: student.documentNumber,
        estudiante: student.studentName,
        grado: student.gradeName,
        grupo: student.groupName,
        promedio: student.finalAverage.toFixed(2),
        perdidas: student.failedSubjects,
        estado: student.promotionStatus === 'PROMOTED' ? 'PROMOVIDO'
          : student.promotionStatus === 'FAILED' ? 'REPROBADO' : 'PENDIENTE',
      });
    }

    return workbook;
  }

  async generateAttendanceReport(dto: GenerateReportDto) {
    const attendances = await this.prisma.attendanceRecord.findMany({
      where: {
        studentEnrollment: { academicYearId: dto.academicYearId },
      },
      include: {
        studentEnrollment: {
          include: {
            student: true,
            group: { include: { grade: true } },
          },
        },
      },
    });

    const byStudent = new Map<string, { present: number; absent: number; late: number; excused: number }>();

    for (const a of attendances) {
      const key = a.studentEnrollmentId;
      if (!byStudent.has(key)) {
        byStudent.set(key, { present: 0, absent: 0, late: 0, excused: 0 });
      }
      const stats = byStudent.get(key)!;
      if (a.status === 'PRESENT') stats.present++;
      else if (a.status === 'ABSENT') stats.absent++;
      else if (a.status === 'LATE') stats.late++;
      else if (a.status === 'EXCUSED') stats.excused++;
    }

    // Delegar a StudentsService para obtener matrículas activas
    const enrollments = await this.studentsService.getEnrollmentsForMenReport({
      academicYearId: dto.academicYearId,
      status: EnrollmentStatus.ACTIVE,
    });

    const results = enrollments.map((e) => {
      const stats = byStudent.get(e.id) || { present: 0, absent: 0, late: 0, excused: 0 };
      const total = stats.present + stats.absent + stats.late + stats.excused;
      const attendanceRate = total > 0 ? Math.round((stats.present / total) * 100) : 100;

      // Usar propiedades del DTO EnrollmentForMenReport
      return {
        studentName: `${e.student.firstName} ${e.student.lastName}`,
        documentNumber: e.student.documentNumber,
        gradeName: e.group.gradeName,
        groupName: e.group.name,
        ...stats,
        total,
        attendanceRate,
      };
    });

    return {
      summary: {
        totalStudents: results.length,
        avgAttendanceRate: results.length > 0
          ? Math.round(results.reduce((acc, r) => acc + r.attendanceRate, 0) / results.length)
          : 0,
      },
      students: results,
    };
  }
}
