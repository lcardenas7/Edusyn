import { NotFoundException } from '@nestjs/common';
import { EnrollmentService } from '../../src/modules/academic/enrollment.service';
import { EnrollmentReportsService } from '../../src/modules/academic/enrollment-reports.service';
import { GradeChangeService } from '../../src/modules/academic/grade-change.service';
import { TemplatesService } from '../../src/modules/academic/templates.service';
import { StudentGradesService } from '../../src/modules/evaluation/student-grades.service';
import { AttendanceService } from '../../src/modules/attendance/attendance.service';

export const A = 'school-A';
export const B = 'school-B';
const writeMethods = ['create', 'update', 'updateMany', 'deleteMany'];

function matches(row: any, where: any = {}): boolean {
  return Object.entries(where).every(([key, value]: [string, any]) => {
    if (value === undefined) return true;
    if (key === 'OR') return value.some((part: any) => matches(row, part));
    if (value && typeof value === 'object') {
      if ('in' in value) return value.in.includes(row[key]);
      if (key.includes('_') && !row[key]) return matches(row, value);
      return row[key] && matches(row[key], value);
    }
    return row[key] === value;
  });
}

export function fixture() {
  const rows: Record<string, any[]> = Object.fromEntries([
    'academicYear', 'student', 'group', 'grade', 'studentEnrollment', 'enrollmentEvent',
    'teacherAssignment', 'partialGrade', 'evaluativeActivity', 'studentGrade', 'attendanceRecord',
    'tutoringAttendance', 'enrollmentArea', 'enrollmentSubject', 'academicAct', 'gradeTemplate',
    'academicTerm', 'evaluationComponent', 'evaluationPlan', 'periodFinalGrade', 'finalComponent', 'finalComponentScope', 'finalComponentGrade',
  ].map(name => [name, []]));
  for (const [x, institutionId] of [['A', A], ['B', B]]) {
    const year = { id: `year-${x}`, institutionId, status: 'ACTIVE', year: 2026, name: 'Synthetic', institution: { name: 'Synthetic' } };
    const grade = { id: `grade-${x}`, institutionId, name: 'Synthetic', stage: 'BASICA_PRIMARIA', number: 1 };
    const group = { id: `group-${x}`, campus: { institutionId, name: 'Synthetic' }, grade, gradeId: grade.id, shift: { name: 'Synthetic' }, name: 'Synthetic', maxCapacity: null, _count: { studentEnrollments: 0 }, subjectExceptions: [] };
    const student = { id: `student-${x}`, institutionId, firstName: 'Synthetic', lastName: 'Test', documentNumber: `doc-${x}` };
    rows.academicYear.push(year); rows.grade.push(grade); rows.group.push(group); rows.student.push(student);
    rows.studentEnrollment.push({ id: `enr-${x}`, institutionId, studentId: student.id, student, groupId: group.id, group, academicYearId: year.id, academicYear: year, status: 'ACTIVE' });
    rows.academicAct.push({ id: `act-${x}`, institutionId, approvalDate: new Date() });
    rows.academicTerm.push({ id: `term-${x}`, academicYearId: year.id, academicYear: year, weightPercentage: 100, name: 'Synthetic' });
    rows.teacherAssignment.push({ id: `ta-${x}`, institutionId, academicYearId: year.id, groupId: group.id, group, subjectId: `subject-${x}`, subject: { name: 'Synthetic' } });
    rows.evaluationComponent.push({ id: `component-${x}`, institutionId });
  }
  const prisma: any = {};
  let nextId = 0;
  for (const [model, data] of Object.entries(rows)) {
    const find = ({ where }: any) => data.find(row => matches(row, where)) ?? null;
    prisma[model] = {
      findFirst: jest.fn(async (args: any) => find(args)),
      findUnique: jest.fn(async (args: any) => find(args)),
      findMany: jest.fn(async ({ where }: any) => data.filter(row => matches(row, where))),
      count: jest.fn(async ({ where }: any) => data.filter(row => matches(row, where)).length),
      groupBy: jest.fn(async () => []),
      create: jest.fn(async ({ data: input }: any) => {
        const row = { id: `new-${++nextId}`, ...input }; data.push(row); return row;
      }),
      update: jest.fn(async ({ where, data: input }: any) => {
        const row = find({ where }); if (!row) throw new Error('P2025'); Object.assign(row, input); return row;
      }),
      updateMany: jest.fn(async ({ where, data: input }: any) => {
        const found = data.filter(row => matches(row, where)); found.forEach(row => Object.assign(row, input)); return { count: found.length };
      }),
      deleteMany: jest.fn(async ({ where }: any) => {
        const found = data.filter(row => matches(row, where)); found.forEach(row => data.splice(data.indexOf(row), 1)); return { count: found.length };
      }),
    };
  }
  prisma.$transaction = jest.fn(async (fn: any) => {
    const before = JSON.parse(JSON.stringify(rows));
    const tx = Object.fromEntries(Object.entries(prisma).filter(([key]) => key !== '$transaction'));
    try { return await fn(tx); }
    catch (error) {
      for (const model of Object.keys(rows)) rows[model].splice(0, rows[model].length, ...before[model]);
      throw error;
    }
  });
  const lifecycle = { canModify: jest.fn(), canEnrollStudents: jest.fn() };
  const templates = { getEffectiveStructureForGroupInScope: jest.fn(async () => ({ areas: [] })) };
  const service = new EnrollmentService(prisma, lifecycle as any, templates as any);
  const reports = new EnrollmentReportsService(prisma);
  const rules = { getContext: jest.fn(async () => ({ minPassingGrade: 3 })) };
  const gradeChange = new GradeChangeService(prisma, {} as any, {} as any, rules as any, service);
  return { prisma, rows, service, reports, gradeChange, rules, templates };
}

export function noWrites(prisma: any) {
  expect(prisma.$transaction).not.toHaveBeenCalled();
  for (const [name, delegate] of Object.entries(prisma) as any) {
    if (name === '$transaction') continue;
    for (const method of writeMethods) expect(delegate[method]).not.toHaveBeenCalled();
  }
}

