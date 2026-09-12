import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'node:crypto';
import request = require('supertest');

import { JwtStrategy } from '../auth/jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { AttendanceAuditService } from './attendance-audit.service';
import { TutoringAttendanceController } from './tutoring-attendance.controller';
import { TutoringAttendanceService } from './tutoring-attendance.service';
import { A, B, DIA, conteo, fixture, noAudit, noWrites } from '../../../test/fixtures/attendance.fixture';

/**
 * Laboratorio HTTP de Asistencia.
 *
 * HTTP real, verificación de JWT real, `RolesGuard` real, `ValidationPipe` con la misma
 * configuración que `main.ts` (`whitelist` + `forbidNonWhitelisted`), controladores y servicios
 * reales; lo único sustituido es la persistencia —el doble A/B que filtra de verdad—. Sin base de
 * datos, sin RLS y sin credenciales ni datos reales: **lo que se demuestra aquí es la guarda de la
 * aplicación**, no el aislamiento de PostgreSQL.
 *
 * Las 17 rutas del módulo aparecen en la matriz de más abajo.
 */
describe('Asistencia · aislamiento HTTP con sesiones firmadas localmente', () => {
  let app: INestApplication;
  let data: ReturnType<typeof fixture>;
  let jwt: JwtService;

  beforeEach(async () => {
    data = fixture();
    const secret = randomBytes(32).toString('hex');
    jwt = new JwtService({ secret });
    const module = await Test.createTestingModule({
      controllers: [AttendanceController, TutoringAttendanceController],
      providers: [
        JwtStrategy,
        { provide: ConfigService, useValue: { getOrThrow: () => secret } },
        { provide: PrismaService, useValue: data.prisma },
        { provide: AttendanceService, useValue: data.service },
        { provide: AttendanceAuditService, useValue: data.audit },
        { provide: TutoringAttendanceService, useValue: data.tutoring },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
  });
  afterEach(async () => { await app?.close(); });

  const http = () => request(app.getHttpServer());

  const token = (
    institutionId: string | null,
    role = 'ADMIN_INSTITUTIONAL',
    sub = 'actor-sintetico',
    isSuperAdmin = false,
  ) => jwt.sign(
    { sub, email: 'sintetico@example.invalid', institutionId, roles: role ? [role] : [], isSuperAdmin },
    { expiresIn: '1m' },
  );

  const dia = DIA.toISOString();

  /**
   * Matriz de cruce: cada entrada usa identificadores del OTRO colegio.
   * 15 de las 17 rutas; `status` y `toggle` van aparte porque su respuesta legítima NO es 404:
   * reciben `institutionId` y deben IGNORARLO, que es una prueba distinta.
   */
  const rutasCruzadas = [
    // — attendance.controller.ts —
    ['post', '/attendance', { teacherAssignmentId: 'ta-FOREIGN', date: dia, records: [{ studentEnrollmentId: 'enr-FOREIGN1', status: 'PRESENT' }] }, 'ADMIN_INSTITUTIONAL'],
    ['put', '/attendance/rec-FOREIGN1', { status: 'ABSENT' }, 'ADMIN_INSTITUTIONAL'],
    ['get', `/attendance/by-assignment/ta-FOREIGN?date=${dia}`, undefined, 'ADMIN_INSTITUTIONAL'],
    ['get', '/attendance/by-student/enr-FOREIGN1', undefined, 'ADMIN_INSTITUTIONAL'],
    ['get', '/attendance/summary/enr-FOREIGN1', undefined, 'ADMIN_INSTITUTIONAL'],
    ['get', '/attendance/report/consolidated?academicYearId=year-FOREIGN', undefined, 'ADMIN_INSTITUTIONAL'],
    ['get', '/attendance/report/teacher-compliance?academicYearId=year-FOREIGN', undefined, 'ADMIN_INSTITUTIONAL'],
    ['get', `/attendance/report/ta-FOREIGN?startDate=${dia}&endDate=${dia}`, undefined, 'ADMIN_INSTITUTIONAL'],
    ['get', '/attendance/report-by-group/group-FOREIGN?academicYearId=year-FOREIGN', undefined, 'ADMIN_INSTITUTIONAL'],
    ['get', '/attendance/detailed-report?academicYearId=year-FOREIGN', undefined, 'ADMIN_INSTITUTIONAL'],
    // — tutoring-attendance.controller.ts —
    ['post', '/tutoring-attendance/record', { groupId: 'group-FOREIGN', date: dia, records: [{ studentEnrollmentId: 'enr-FOREIGN1', status: 'PRESENT' }] }, 'ADMIN_INSTITUTIONAL'],
    ['get', `/tutoring-attendance/by-group?groupId=group-FOREIGN&date=${dia}`, undefined, 'ADMIN_INSTITUTIONAL'],
    ['get', '/tutoring-attendance/student-summary?studentEnrollmentId=enr-FOREIGN1', undefined, 'ADMIN_INSTITUTIONAL'],
    ['get', '/tutoring-attendance/report-by-group?groupId=group-FOREIGN&academicYearId=year-FOREIGN', undefined, 'ADMIN_INSTITUTIONAL'],
    ['get', '/tutoring-attendance/detailed-report?academicYearId=year-FOREIGN', undefined, 'ADMIN_INSTITUTIONAL'],
  ] as const;

  describe.each([[A, 'B'], [B, 'A']])('actor de %s contra el colegio %s', (institution, ajeno) => {
    it.each(rutasCruzadas)('%s %s responde 404 sin escribir ni auditar', async (method, path, body, role) => {
      const url = path.replaceAll('FOREIGN', ajeno);
      const req = (http() as any)[method](url).auth(token(institution, role), { type: 'bearer' });
      if (body) req.send(JSON.parse(JSON.stringify(body).replaceAll('FOREIGN', ajeno)));
      await req.expect(404);
      noWrites(data.prisma);
      noAudit(data.prisma);
      expect(conteo(data.rows, 'attendanceRecord', A)).toBe(2);
      expect(conteo(data.rows, 'attendanceRecord', B)).toBe(2);
    });

    // ─── Las dos rutas que reciben institutionId y deben ignorarlo ───────────
    it('GET /tutoring-attendance/status ignora el institutionId del otro colegio', async () => {
      const r = await http()
        .get(`/tutoring-attendance/status?institutionId=school-${ajeno}`)
        .auth(token(institution), { type: 'bearer' })
        .expect(200);
      const propios = institution === A ? 'group-A' : 'group-B';
      expect(r.body.directedGroups.map((g: any) => g.id)).toEqual([propios]);
      expect(data.prisma.group.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ campus: { institutionId: institution } }) }),
      );
    });

    it('POST /tutoring-attendance/toggle ignora el institutionId del otro colegio y no toca su configuración', async () => {
      const ajenoId = `school-${ajeno}`;
      await http()
        .post('/tutoring-attendance/toggle')
        .auth(token(institution), { type: 'bearer' })
        .send({ enabled: false, institutionId: ajenoId })
        .expect(201);
      expect(data.rows.institutionModule.find((m) => m.institutionId === institution).features).toEqual([]);
      expect(data.rows.institutionModule.find((m) => m.institutionId === ajenoId).features).toEqual(['TUTORING_ATTENDANCE']);
    });
  });

  // ─── Identidad del estudiante ─────────────────────────────────────────────
  describe('un ESTUDIANTE solo consulta su propia matrícula', () => {
    it('la suya responde 200', async () => {
      const r = await http()
        .get('/attendance/summary/enr-A1')
        .auth(token(A, 'ESTUDIANTE', 'user-A1'), { type: 'bearer' })
        .expect(200);
      expect(r.body).toMatchObject({ total: 1, present: 1 });
    });

    it('la de un COMPAÑERO del mismo colegio responde 404, no 403', async () => {
      await http()
        .get('/attendance/summary/enr-A2')
        .auth(token(A, 'ESTUDIANTE', 'user-A1'), { type: 'bearer' })
        .expect(404);
      noWrites(data.prisma);
    });

    it('tampoco puede listar los registros de un compañero', async () => {
      await http()
        .get('/attendance/by-student/enr-A2')
        .auth(token(A, 'ESTUDIANTE', 'user-A1'), { type: 'bearer' })
        .expect(404);
    });

    it('una matrícula de otro colegio responde 404 igual que una inexistente', async () => {
      for (const id of ['enr-B1', 'enr-que-no-existe']) {
        await http()
          .get(`/attendance/summary/${id}`)
          .auth(token(A, 'ESTUDIANTE', 'user-A1'), { type: 'bearer' })
          .expect(404);
      }
    });
  });

  // ─── Roles ────────────────────────────────────────────────────────────────
  it.each([
    ['post', '/attendance', 'ESTUDIANTE'],
    ['put', '/attendance/rec-A1', 'ESTUDIANTE'],
    ['get', '/attendance/report/consolidated?academicYearId=year-A', 'ESTUDIANTE'],
    ['get', '/attendance/detailed-report?academicYearId=year-A', 'DOCENTE'],
    ['post', '/tutoring-attendance/toggle', 'DOCENTE'],
  ])('%s %s con rol %s sigue prohibido', async (method, path, role) => {
    await (http() as any)[method](path)
      .auth(token(A, role), { type: 'bearer' })
      .send(method === 'get' ? undefined : { status: 'ABSENT', enabled: true })
      .expect(403);
    noWrites(data.prisma);
  });

  it('sin token no se entra a ninguna ruta', async () => {
    await http().get('/attendance/detailed-report?academicYearId=year-A').expect(401);
    await http().get('/tutoring-attendance/status').expect(401);
    noWrites(data.prisma);
  });

  // ─── Cuerpo con institutionId falsificado ─────────────────────────────────
  it('un institutionId falsificado en el cuerpo de POST /attendance lo rechaza el ValidationPipe', async () => {
    await http()
      .post('/attendance')
      .auth(token(A, 'DOCENTE'), { type: 'bearer' })
      .send({ institutionId: B, teacherAssignmentId: 'ta-A', date: dia, records: [{ studentEnrollmentId: 'enr-A1', status: 'PRESENT' }] })
      .expect(400);
    noWrites(data.prisma);
  });

  it('un institutionId falsificado en el registro de tutoría se ignora: manda el del actor', async () => {
    await http()
      .post('/tutoring-attendance/record')
      .auth(token(A, 'DOCENTE', 'teacher-A'), { type: 'bearer' })
      .send({ institutionId: B, groupId: 'group-A', date: '2026-03-09T00:00:00.000Z', records: [{ studentEnrollmentId: 'enr-A1', status: 'PRESENT' }] })
      .expect(201);
    expect(conteo(data.rows, 'tutoringAttendance', B)).toBe(2);
    expect(conteo(data.rows, 'tutoringAttendance', A)).toBe(3);
  });

  it('un teacherId falsificado no convierte al peticionario en director de grupo', async () => {
    await http()
      .post('/tutoring-attendance/record')
      .auth(token(A, 'DOCENTE', 'otro-docente'), { type: 'bearer' })
      .send({ teacherId: 'teacher-A', groupId: 'group-A', date: dia, records: [{ studentEnrollmentId: 'enr-A1', status: 'PRESENT' }] })
      .expect(403);
    noWrites(data.prisma);
  });

  // ─── Contexto y fechas ────────────────────────────────────────────────────
  it('una sesión sin institución responde 400, no 500', async () => {
    await http()
      .get('/attendance/detailed-report?academicYearId=year-A')
      .auth(token(null, 'ADMIN_INSTITUTIONAL', 'usuario-sin-institucion'), { type: 'bearer' })
      .expect(400);
    noWrites(data.prisma);
  });

  it.each([
    ['/attendance/by-assignment/ta-A?date=no-es-fecha'],
    [`/attendance/report/ta-A?startDate=mal&endDate=${dia}`],
    ['/tutoring-attendance/by-group?groupId=group-A&date=mal'],
  ])('una fecha inválida en %s responde 400', async (url) => {
    await http().get(url).auth(token(A), { type: 'bearer' }).expect(400);
    noWrites(data.prisma);
  });

  // ─── Lo legítimo sigue funcionando ────────────────────────────────────────
  it('el docente registra asistencia en su propia asignación', async () => {
    const r = await http()
      .post('/attendance')
      .auth(token(A, 'DOCENTE', 'teacher-A'), { type: 'bearer' })
      .send({ teacherAssignmentId: 'ta-A', date: '2026-03-10T00:00:00.000Z', records: [
        { studentEnrollmentId: 'enr-A1', status: 'PRESENT' },
        { studentEnrollmentId: 'enr-A2', status: 'ABSENT' },
      ] })
      .expect(201);
    expect(r.body).toHaveLength(2);
    expect(conteo(data.rows, 'attendanceRecord', A)).toBe(4);
    expect(conteo(data.rows, 'attendanceRecord', B)).toBe(2);
    expect(data.prisma.attendanceAuditEvent.createMany).toHaveBeenCalledTimes(1);
  });

  it('el consolidado propio responde con su aritmética', async () => {
    const r = await http()
      .get('/attendance/report/consolidated?academicYearId=year-A')
      .auth(token(A, 'RECTOR'), { type: 'bearer' })
      .expect(200);
    expect(r.body.byGrade).toHaveLength(1);
    expect(r.body.byGrade[0]).toMatchObject({ name: 'Grado A', total: 2, present: 1, absent: 1, attendanceRate: 50 });
    expect(r.body.bySubject).toEqual([expect.objectContaining({ name: 'Materia A', total: 2 })]);
  });

  it('el reporte por grupo propio responde 200', async () => {
    const r = await http()
      .get('/attendance/report-by-group/group-A?academicYearId=year-A')
      .auth(token(A, 'COORDINADOR'), { type: 'bearer' })
      .expect(200);
    expect(JSON.stringify(r.body)).toContain('ApellidoA');
  });

  it('un docente que no dirige el grupo recibe 403 dentro de su colegio, y 404 fuera', async () => {
    await http()
      .get('/tutoring-attendance/report-by-group?groupId=group-A&academicYearId=year-A')
      .auth(token(A, 'DOCENTE', 'docente-sin-direccion'), { type: 'bearer' })
      .expect(403);
    await http()
      .get('/tutoring-attendance/report-by-group?groupId=group-B&academicYearId=year-B')
      .auth(token(A, 'DOCENTE', 'docente-sin-direccion'), { type: 'bearer' })
      .expect(404);
  });

  it('el SuperAdmin de plataforma sí puede fijar la institución explícitamente', async () => {
    await http()
      .post('/tutoring-attendance/toggle')
      .auth(token(null, '', 'root', true), { type: 'bearer' })
      .send({ enabled: false, institutionId: B })
      .expect(201);
    expect(data.rows.institutionModule.find((m) => m.institutionId === B).features).toEqual([]);
    expect(data.rows.institutionModule.find((m) => m.institutionId === A).features).toEqual(['TUTORING_ATTENDANCE']);
  });
});
