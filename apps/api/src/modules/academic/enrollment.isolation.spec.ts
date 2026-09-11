import { NotFoundException } from '@nestjs/common';
import { EnrollmentService } from './enrollment.service';
import { EnrollmentReportsService } from './enrollment-reports.service';
import { GradeChangeService } from './grade-change.service';
import { TemplatesService } from './templates.service';
import { StudentGradesService } from '../evaluation/student-grades.service';
import { AttendanceService } from '../attendance/attendance.service';

import { A, B, fixture, noWrites } from '../../../test/fixtures/enrollment.fixture';

describe('Enrollment integral entry isolation', () => {
  it('does not reactivate a withdrawn student into a full group', async () => {
    const { service, rows, prisma } = fixture();
    rows.studentEnrollment[0].status = 'WITHDRAWN';
    rows.group[0].maxCapacity = 1;
    rows.group[0]._count.studentEnrollments = 1;
    await expect(service.reactivateStudent({ enrollmentId: 'enr-A', reason: 'Synthetic', performedById: 'actor' }, A)).rejects.toThrow('no tiene cupos');
    expect(prisma.studentEnrollment.update).not.toHaveBeenCalled();
  });

  it.each(['year', 'student'])('does not accept an approved act for another %s in the same school', async invalid => {
    const { gradeChange, rows, prisma } = fixture();
    rows.group.push({ ...rows.group[0], id: 'group-A2' });
    rows.academicAct[0].academicYearId = invalid === 'year' ? 'year-other' : 'year-A';
    rows.academicAct[0].studentEnrollmentId = invalid === 'student' ? 'enr-other' : 'enr-A';
    await expect(gradeChange.changeGrade({ enrollmentId: 'enr-A', newGroupId: 'group-A2', academicActId: 'act-A', reason: 'Synthetic', performedById: 'actor', movementType: 'ADMINISTRATIVE' } as any, A)).rejects.toThrow('acta debe corresponder');
    expect(prisma.studentEnrollment.update).not.toHaveBeenCalled();
  });

  it('rolls back withdrawal when its audit event cannot be saved', async () => {
    const { service, prisma, rows } = fixture();
    prisma.enrollmentEvent.create.mockRejectedValueOnce(new Error('Synthetic audit failure'));
    await expect(service.withdrawStudent({ enrollmentId: 'enr-A', reason: 'Synthetic', performedById: 'actor' }, A)).rejects.toThrow('Synthetic audit failure');
    expect(rows.studentEnrollment.find(r => r.id === 'enr-A').status).toBe('ACTIVE');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('rolls back group, notes and attendance if destination snapshot fails', async () => {
    const { gradeChange, prisma, rows } = fixture();
    rows.group.push({ ...rows.group[0], id: 'group-A2' });
    rows.teacherAssignment.push({ ...rows.teacherAssignment[0], id: 'ta-A2', groupId: 'group-A2' });
    for (const model of ['partialGrade', 'attendanceRecord']) rows[model].push({ institutionId: A, studentEnrollmentId: 'enr-A', teacherAssignmentId: 'ta-A' });
    prisma.gradeTemplate.findFirst.mockRejectedValueOnce(new Error('Synthetic snapshot failure'));
    await expect(gradeChange.changeGrade({ enrollmentId: 'enr-A', newGroupId: 'group-A2', reason: 'Synthetic', performedById: 'actor', movementType: 'ADMINISTRATIVE' } as any, A)).rejects.toThrow('Synthetic snapshot failure');
    expect(prisma.partialGrade.updateMany).toHaveBeenCalled();
    expect(rows.studentEnrollment.find(r => r.id === 'enr-A').groupId).toBe('group-A');
    expect(rows.partialGrade[0].teacherAssignmentId).toBe('ta-A');
    expect(rows.attendanceRecord[0].teacherAssignmentId).toBe('ta-A');
    expect(rows.enrollmentEvent).toEqual([]);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('keeps the existing snapshot when destination has no academic template', async () => {
    const { service, prisma, rows } = fixture();
    rows.enrollmentArea.push({ id: 'snapshot-A', enrollmentId: 'enr-A', institutionId: A });
    await expect(service.regenerateAcademicSnapshot('enr-A', A)).rejects.toThrow('no tiene estructura académica');
    expect(rows.enrollmentArea[0].id).toBe('snapshot-A');
    expect(prisma.enrollmentArea.deleteMany).not.toHaveBeenCalled();
  });

  it('commits an owned same-grade move and its audit together', async () => {
    const { gradeChange, prisma, rows } = fixture();
    rows.group.push({ ...rows.group[0], id: 'group-A2' });
    await gradeChange.changeGrade({ enrollmentId: 'enr-A', newGroupId: 'group-A2', reason: 'Synthetic', performedById: 'actor', movementType: 'ADMINISTRATIVE' } as any, A);
    expect(rows.studentEnrollment.find(r => r.id === 'enr-A').groupId).toBe('group-A2');
    expect(rows.studentEnrollment.find(r => r.id === 'enr-B').groupId).toBe('group-B');
    expect(rows.enrollmentEvent).toHaveLength(1);
    expect(rows.enrollmentEvent[0].institutionId).toBe(A);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  const actions = [
    ['read', (s: EnrollmentService, x: string, institution: string) => s.getEnrollmentById(`enr-${x}`, institution)],
    ['history', (s: EnrollmentService, x: string, institution: string) => s.getEnrollmentHistory(`enr-${x}`, institution)],
    ['student history', (s: EnrollmentService, x: string, institution: string) => s.getStudentEnrollmentHistory(`student-${x}`, institution)],
    ['withdraw', (s: EnrollmentService, x: string, institution: string) => s.withdrawStudent({ enrollmentId: `enr-${x}`, reason: 'Synthetic', performedById: 'actor' }, institution)],
    ['transfer', (s: EnrollmentService, x: string, institution: string) => s.transferStudent({ enrollmentId: `enr-${x}`, reason: 'Synthetic', performedById: 'actor' }, institution)],
    ['change group', (s: EnrollmentService, x: string, institution: string) => s.changeGroup({ enrollmentId: `enr-${x}`, newGroupId: 'group-A', reason: 'Synthetic', performedById: 'actor', movementType: 'ADMINISTRATIVE' }, institution)],
    ['reactivate', (s: EnrollmentService, x: string, institution: string) => s.reactivateStudent({ enrollmentId: `enr-${x}`, reason: 'Synthetic', performedById: 'actor' }, institution)],
    ['academic structure', (s: EnrollmentService, x: string, institution: string) => s.getEnrollmentAcademicStructure(`enr-${x}`, institution)],
    ['regenerate snapshot', (s: EnrollmentService, x: string, institution: string) => s.regenerateAcademicSnapshot(`enr-${x}`, institution)],
    ['statistics', (s: EnrollmentService, x: string, institution: string) => s.getEnrollmentStats(`year-${x}`, institution)],
    ['capacity', (s: EnrollmentService, x: string, institution: string) => s.getCapacityByAcademicYear(`year-${x}`, institution)],
    ['group capacity', (s: EnrollmentService, x: string, institution: string) => s.getGroupCapacity(`group-${x}`, 'year-A', institution)],
    ['update capacity', (s: EnrollmentService, x: string, institution: string) => s.updateGroupCapacity(`group-${x}`, 5, institution)],
    ['list by year', (s: EnrollmentService, x: string, institution: string) => s.getEnrollments({ academicYearId: `year-${x}` }, institution)],
    ['list by group', (s: EnrollmentService, x: string, institution: string) => s.getEnrollments({ groupId: `group-${x}` }, institution)],
    ['list by grade', (s: EnrollmentService, x: string, institution: string) => s.getEnrollments({ gradeId: `grade-${x}` }, institution)],
    ['enroll student', (s: EnrollmentService, x: string, institution: string) => s.enrollStudent({ studentId: `student-${x}`, groupId: 'group-A', academicYearId: 'year-A', enrolledById: 'actor' }, institution)],
    ['migrate grades', (s: EnrollmentService, x: string, institution: string) => s.migrateGradesToNewGroup(`enr-${x}`, 'group-A', 'group-A', 'year-A', institution)],
  ] as const;

  describe.each([[A, 'B'], [B, 'A']])('actor %s against %s', (institution, foreign) => {
    it.each(actions)('%s rejects before data collections, events and writes', async (_name, action) => {
      const { service, prisma, templates } = fixture();
      await expect(action(service, foreign, institution)).rejects.toBeInstanceOf(NotFoundException);
      noWrites(prisma);
      expect(templates.getEffectiveStructureForGroupInScope).not.toHaveBeenCalled();
      for (const [model, delegate] of Object.entries(prisma) as any) {
        if (model === '$transaction') continue;
        expect(delegate.findMany).not.toHaveBeenCalled();
        expect(delegate.count).not.toHaveBeenCalled();
        expect(delegate.groupBy).not.toHaveBeenCalled();
      }
    });
  });

  it.each(['group', 'year'])('create-and-enroll refuses a foreign %s before student lookup/transaction', async field => {
    const { service, prisma } = fixture();
    await expect(service.createStudentAndEnroll({ institutionId: B, groupId: field === 'group' ? 'group-B' : 'group-A', academicYearId: field === 'year' ? 'year-B' : 'year-A', documentType: 'TI', documentNumber: 'synthetic-new', firstName: 'Synthetic', lastName: 'Test', enrolledById: 'actor' }, A)).rejects.toBeInstanceOf(NotFoundException);
    noWrites(prisma);
    expect(prisma.student.findUnique).not.toHaveBeenCalled();
  });

  it('an owned enrollment cannot move grades into a foreign group', async () => {
    const { service, prisma } = fixture();
    await expect(service.migrateGradesToNewGroup('enr-A', 'group-A', 'group-B', 'year-A', A)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.teacherAssignment.findMany).not.toHaveBeenCalled();
    noWrites(prisma);
  });

  it('changing an owned enrollment to a foreign group stops before moving any notes', async () => {
    const { service, prisma } = fixture();
    await expect(service.changeGroup({ enrollmentId: 'enr-A', newGroupId: 'group-B', reason: 'Synthetic', performedById: 'actor', movementType: 'ADMINISTRATIVE' }, A)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.teacherAssignment.findMany).not.toHaveBeenCalled();
    noWrites(prisma);
  });

  it('unfiltered listing still only returns the actor institution', async () => {
    const { service } = fixture();
    expect((await service.getEnrollments({}, A)).map(row => row.id)).toEqual(['enr-A']);
  });

  it.each(['generateEnrollmentListPdf', 'generateEnrollmentListExcel', 'generateStatsByGradePdf'] as const)('%s rejects the foreign year before reading students or creating output', async method => {
    const { reports, prisma } = fixture();
    await expect(method === 'generateStatsByGradePdf'
      ? reports[method]('year-B', A) : reports[method]('year-B', undefined, A)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.studentEnrollment.findMany).not.toHaveBeenCalled();
    noWrites(prisma);
  });

  it.each(['validateGradeChange', 'changeGrade'] as const)('%s rejects foreign enrollment before loading rules or moving records', async method => {
    const { gradeChange, prisma, rules } = fixture();
    await expect(gradeChange[method]({ enrollmentId: 'enr-B', newGroupId: 'group-A' } as any, A)).rejects.toBeInstanceOf(NotFoundException);
    expect(rules.getContext).not.toHaveBeenCalled();
    expect(prisma.group.findFirst).not.toHaveBeenCalled();
    noWrites(prisma);
  });

  it('snapshot template resolution rejects a foreign year before loading a group/template', async () => {
    const { prisma } = fixture();
    const service = new TemplatesService(prisma);
    await expect(service.getEffectiveStructureForGroupInScope('group-A', 'year-B', A)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.group.findFirst).not.toHaveBeenCalled();
    expect(prisma.gradeTemplate.findFirst).not.toHaveBeenCalled();
    noWrites(prisma);
  });

  it('a foreign act stops grade change before reading enrollment, notes or rules', async () => {
    const { gradeChange, prisma, rules } = fixture();
    await expect(gradeChange.changeGrade({ enrollmentId: 'enr-A', newGroupId: 'group-A', academicActId: 'act-B' } as any, A)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.studentEnrollment.findFirst).not.toHaveBeenCalled();
    expect(rules.getContext).not.toHaveBeenCalled();
    noWrites(prisma);
  });

  it.each(['enrollment', 'year', 'assignment'])('annual grade refuses a foreign %s before reading any grades', async foreign => {
    const { prisma } = fixture();
    const svc = new StudentGradesService(prisma, {} as any);
    await expect(svc.calculateAnnualGrade(foreign === 'enrollment' ? 'enr-B' : 'enr-A', foreign === 'assignment' ? 'ta-B' : 'ta-A', foreign === 'year' ? 'year-B' : 'year-A', A)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.academicTerm.findMany).not.toHaveBeenCalled();
    expect(prisma.periodFinalGrade.findFirst).not.toHaveBeenCalled();
    expect(prisma.partialGrade.findMany).not.toHaveBeenCalled();
    noWrites(prisma);
  });

  it('term calculation refuses a foreign period before reading a plan or grades', async () => {
    const { prisma } = fixture();
    const svc = new StudentGradesService(prisma, {} as any);
    await expect(svc.calculateTermGrade('enr-A', 'ta-A', 'term-B', A)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.evaluationPlan.findFirst).not.toHaveBeenCalled();
    expect(prisma.partialGrade.findMany).not.toHaveBeenCalled();
  });

  it('component calculation refuses a foreign component before reading grades', async () => {
    const { prisma } = fixture();
    const svc = new StudentGradesService(prisma, {} as any);
    await expect(svc.calculateComponentAverage('enr-A', 'term-A', 'component-B', A)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.studentGrade.findMany).not.toHaveBeenCalled();
  });

  it.each(['enrollment', 'period'])('attendance summary refuses a foreign %s before reading records', async foreign => {
    const { prisma } = fixture();
    const svc = new AttendanceService(prisma, {} as any);
    await expect(svc.getStudentSummary(foreign === 'enrollment' ? 'enr-B' : 'enr-A', A, foreign === 'period' ? 'term-B' : undefined)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.attendanceRecord.findMany).not.toHaveBeenCalled();
  });

  it('moving notes and attendance scopes every read/write and preserves school B', async () => {
    const { service, prisma, rows } = fixture();
    rows.group.push({ ...rows.group[0], id: 'group-A2' });
    rows.teacherAssignment.push({ ...rows.teacherAssignment[0], id: 'ta-A2', groupId: 'group-A2' });
    for (const model of ['partialGrade', 'attendanceRecord']) {
      rows[model].push({ institutionId: A, studentEnrollmentId: 'enr-A', teacherAssignmentId: 'ta-A' });
      rows[model].push({ institutionId: B, studentEnrollmentId: 'enr-A', teacherAssignmentId: 'ta-A' });
    }
    rows.tutoringAttendance.push({ institutionId: A, studentEnrollmentId: 'enr-A', groupId: 'group-A' }, { institutionId: B, studentEnrollmentId: 'enr-A', groupId: 'group-A' });
    await service.migrateGradesToNewGroup('enr-A', 'group-A', 'group-A2', 'year-A', A);
    for (const model of ['partialGrade', 'attendanceRecord']) {
      expect(rows[model].find(r => r.institutionId === A).teacherAssignmentId).toBe('ta-A2');
      expect(rows[model].find(r => r.institutionId === B).teacherAssignmentId).toBe('ta-A');
      expect(prisma[model].updateMany.mock.calls[0][0].where.institutionId).toBe(A);
    }
    expect(rows.tutoringAttendance.find(r => r.institutionId === B).groupId).toBe('group-A');
  });
});
