import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'node:crypto';
import request = require('supertest');
import { JwtStrategy } from '../auth/jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';
import { EnrollmentController } from './enrollment.controller';
import { EnrollmentService } from './enrollment.service';
import { GradeChangeController } from './grade-change.controller';
import { GradeChangeService } from './grade-change.service';
import { EnrollmentReportsController } from './enrollment-reports.controller';
import { EnrollmentReportsService } from './enrollment-reports.service';
import { A, B, fixture, noWrites } from '../../../test/fixtures/enrollment.fixture';

// Real HTTP, JWT verification, RolesGuard, controllers and services; only storage
// is replaced by the filtering A/B fixture. No database, RLS or real credentials.
describe('Enrollment HTTP isolation with local signed sessions', () => {
  let app: INestApplication;
  let data: ReturnType<typeof fixture>;
  let jwt: JwtService;
  beforeEach(async () => {
    data = fixture();
    const secret = randomBytes(32).toString('hex');
    jwt = new JwtService({ secret });
    const module = await Test.createTestingModule({
      controllers: [EnrollmentController, GradeChangeController, EnrollmentReportsController],
      providers: [
        JwtStrategy, { provide: ConfigService, useValue: { getOrThrow: () => secret } },
        { provide: PrismaService, useValue: data.prisma },
        { provide: EnrollmentService, useValue: data.service },
        { provide: GradeChangeService, useValue: data.gradeChange },
        { provide: EnrollmentReportsService, useValue: data.reports },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });
  afterEach(async () => { await app?.close(); });
  const token = (institutionId: string, role = 'ADMIN_INSTITUTIONAL') => jwt.sign({ sub: 'synthetic-actor', email: 'synthetic@example.invalid', institutionId, roles: [role] }, { expiresIn: '1m' });

  const routes = [
    ['get', '/enrollments/enr-FOREIGN', undefined],
    ['get', '/enrollments/enr-FOREIGN/history', undefined],
    ['get', '/enrollments/student/student-FOREIGN/history', undefined],
    ['get', '/enrollments/enr-FOREIGN/academic-structure', undefined],
    ['get', '/enrollments/stats/year-FOREIGN', undefined],
    ['get', '/enrollments/capacity/year-FOREIGN', undefined],
    ['get', '/enrollments?academicYearId=year-FOREIGN', undefined],
    ['get', '/enrollments?groupId=group-FOREIGN', undefined],
    ['get', '/enrollments/capacity/year-FOREIGN/group/group-FOREIGN', undefined],
    ['put', '/enrollments/capacity/group/group-FOREIGN', { maxCapacity: 5 }],
    ['post', '/enrollments', { studentId: 'student-FOREIGN', groupId: 'group-A', academicYearId: 'year-A' }],
    ['post', '/enrollments/create-and-enroll', { institutionId: 'school-FOREIGN', groupId: 'group-FOREIGN', academicYearId: 'year-FOREIGN', documentType: 'TI', documentNumber: 'synthetic-new', firstName: 'Synthetic', lastName: 'Test' }],
    ['post', '/enrollments/enr-FOREIGN/withdraw', { reason: 'Synthetic' }],
    ['post', '/enrollments/enr-FOREIGN/transfer', { reason: 'Synthetic' }],
    ['post', '/enrollments/enr-FOREIGN/reactivate', { reason: 'Synthetic' }],
    ['post', '/enrollments/enr-FOREIGN/change-group', { newGroupId: 'group-A', reason: 'Synthetic', movementType: 'ADMINISTRATIVE' }],
    ['post', '/enrollments/enr-FOREIGN/regenerate-snapshot', {}],
    ['post', '/grade-change/validate', { enrollmentId: 'enr-FOREIGN', newGroupId: 'group-A' }],
    ['post', '/grade-change/execute', { enrollmentId: 'enr-FOREIGN', newGroupId: 'group-A', gradeChangeType: 'SAME_GRADE', movementType: 'ADMINISTRATIVE', reason: 'Synthetic' }],
    ['get', '/enrollment-reports/list/year-FOREIGN/pdf', undefined],
    ['get', '/enrollment-reports/list/year-FOREIGN/excel', undefined],
    ['get', '/enrollment-reports/stats/year-FOREIGN/pdf', undefined],
  ] as const;

  describe.each([[A, 'B'], [B, 'A']])('actor %s against school %s', (institution, foreign) => {
    it.each(routes)('%s %s rejects before collections or writes', async (method, path, body) => {
      const url = path.replaceAll('FOREIGN', foreign);
      const req = request(app.getHttpServer())[method](url).auth(token(institution), { type: 'bearer' });
      if (body) req.send(JSON.parse(JSON.stringify(body).replaceAll('FOREIGN', foreign)));
      await req.expect(404);
      noWrites(data.prisma);
      expect(data.prisma.studentEnrollment.findMany).not.toHaveBeenCalled();
      expect(data.prisma.enrollmentEvent.findMany).not.toHaveBeenCalled();
      expect(data.prisma.partialGrade.findMany).not.toHaveBeenCalled();
    });
  });

  it('authenticates a teacher and limits listing to their institution despite a forged query', async () => {
    const result = await request(app.getHttpServer()).get('/enrollments?institutionId=school-B').auth(token(A, 'DOCENTE'), { type: 'bearer' }).expect(200);
    expect(result.body.map((e: any) => e.id)).toEqual(['enr-A']);
  });

  it('does not reveal a foreign student when looking up their document', async () => {
    const result = await request(app.getHttpServer()).get('/enrollments/find-student?documentNumber=doc-B&institutionId=school-B').auth(token(A), { type: 'bearer' }).expect(200);
    expect(result.body?.id).not.toBe('student-B');
    expect(data.prisma.student.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { institutionId_documentNumber: { institutionId: A, documentNumber: 'doc-B' } } }));
    noWrites(data.prisma);
  });

  it('rejects an unauthenticated request before any resource lookup', async () => {
    await request(app.getHttpServer()).get('/enrollments/enr-A').expect(401);
    expect(data.prisma.studentEnrollment.findFirst).not.toHaveBeenCalled();
  });

  it('rejects teacher group mutations using the real role guard', async () => {
    await request(app.getHttpServer()).post('/enrollments/enr-A/change-group').auth(token(A, 'DOCENTE'), { type: 'bearer' }).send({ newGroupId: 'group-A', reason: 'Synthetic' }).expect(403);
    expect(data.prisma.studentEnrollment.findFirst).not.toHaveBeenCalled();
    noWrites(data.prisma);
  });
});
