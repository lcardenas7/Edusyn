import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'node:crypto';
import request = require('supertest');

import { JwtStrategy } from '../auth/jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';
import { ClassroomB1Controller } from './classroom-b1.controller';
import { ClassroomService } from './classroom.service';
import { ClassroomTenantAccessService } from './classroom-tenant-access.service';
import { A, B, conteo, fixture, noWrites } from '../../../test/fixtures/classroom-b1.fixture';

/**
 * Laboratorio HTTP de Classroom Bloque 1 (17 rutas).
 *
 * HTTP real, verificación de JWT real con secreto aleatorio, `RolesGuard` real, `ValidationPipe`
 * con la misma configuración que `main.ts` (`whitelist` + `transform` + `forbidNonWhitelisted`),
 * controlador y servicios reales; lo único sustituido es la persistencia —el doble A/B que
 * filtra de verdad—. Sin base de datos, sin RLS y sin credenciales ni datos reales: **lo que se
 * demuestra aquí es la guarda de la aplicación**.
 */
describe('Classroom Bloque 1 · aislamiento HTTP con sesiones firmadas localmente', () => {
  let app: INestApplication;
  let data: ReturnType<typeof fixture>;
  let jwt: JwtService;

  beforeEach(async () => {
    data = fixture();
    const secret = randomBytes(32).toString('hex');
    jwt = new JwtService({ secret });
    const module = await Test.createTestingModule({
      controllers: [ClassroomB1Controller],
      providers: [
        JwtStrategy,
        { provide: ConfigService, useValue: { getOrThrow: () => secret } },
        { provide: PrismaService, useValue: data.prisma },
        // Servicios reales cableados sobre el doble (el fixture ya los construye así).
        { provide: ClassroomService, useValue: data.service },
        { provide: ClassroomTenantAccessService, useValue: data.access },
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
    role = 'DOCENTE',
    sub = 'teacher-shared',
    isSuperAdmin = false,
  ) => jwt.sign(
    { sub, email: 'sintetico@example.invalid', institutionId, roles: role ? [role] : [], isSuperAdmin },
    { expiresIn: '1m' },
  );

  /**
   * Matriz de cruce: cada entrada usa identificadores del OTRO colegio.
   * 15 rutas con id; `GET /classrooms` y `GET /classrooms/available-assignments` no llevan id —
   * su aislamiento se demuestra por contenido en las pruebas legítimas de más abajo.
   */
  const rutasCruzadas = [
    ['post', '/classrooms', { teacherAssignmentId: 'ta-FOREIGN' }],
    ['get', '/classrooms/class-FOREIGN', undefined],
    ['put', '/classrooms/class-FOREIGN', { title: 'intruso' }],
    ['get', '/classrooms/class-FOREIGN/students', undefined],
    ['post', '/classrooms/class-FOREIGN/activities', { type: 'TASK', title: 'intrusa' }],
    ['get', '/classrooms/class-FOREIGN/activities', undefined],
    ['get', '/classrooms/activities/act-FOREIGN-pub', undefined],
    ['put', '/classrooms/activities/act-FOREIGN-pub', { title: 'intruso' }],
    ['put', '/classrooms/activities/act-FOREIGN-pub/publish', {}],
    ['put', '/classrooms/activities/act-FOREIGN-pub/unpublish', undefined],
    ['put', '/classrooms/activities/act-FOREIGN-pub/dependencies', { prerequisites: [] }],
    ['put', '/classrooms/activities/act-FOREIGN-restr/assign-students', { studentEnrollmentIds: ['enr-FOREIGN1'], isRestrictedToAssigned: true }],
    ['get', '/classrooms/activities/act-FOREIGN-restr/assignments', undefined],
    ['get', '/classrooms/class-FOREIGN/students-for-assignment', undefined],
    ['delete', '/classrooms/activities/act-FOREIGN-pub?force=true', undefined],
  ] as const;

  describe.each([[A, 'B'], [B, 'A']])('actor de %s contra el colegio %s', (institution, ajeno) => {
    it.each(rutasCruzadas)('%s %s responde 404 sin escribir', async (method, path, body) => {
      const url = path.replaceAll('FOREIGN', ajeno);
      const req = (http() as any)[method](url).auth(token(institution), { type: 'bearer' });
      if (body) req.send(JSON.parse(JSON.stringify(body).replaceAll('FOREIGN', ajeno)));
      await req.expect(404);
      noWrites(data);
      expect(conteo(data.rows, 'classroom', A)).toBe(7);
      expect(conteo(data.rows, 'classroom', B)).toBe(1);
      expect(data.rows.activityAssignment).toHaveLength(3);
      expect(data.rows.activityDependency).toHaveLength(1);
    });

    it('el 404 de un id ajeno es indistinguible del de uno inexistente', async () => {
      const r1 = await http().get(`/classrooms/class-${ajeno}`).auth(token(institution), { type: 'bearer' });
      const r2 = await http().get('/classrooms/class-que-no-existe').auth(token(institution), { type: 'bearer' });
      expect(r1.status).toBe(404);
      expect(r2.status).toBe(404);
      expect(r1.body.message).toBe(r2.body.message);
    });
  });

  // ─── Identidad, roles y contexto ──────────────────────────────────────────
  it('sin token no se entra a ninguna de las 17 rutas', async () => {
    await http().get('/classrooms').expect(401);
    await http().get('/classrooms/class-A').expect(401);
    await http().put('/classrooms/activities/act-A-pub/publish').send({}).expect(401);
    noWrites(data);
  });

  it.each([
    ['post', '/classrooms', 'ESTUDIANTE'],
    ['put', '/classrooms/class-A', 'ESTUDIANTE'],
    ['get', '/classrooms/class-A/students', 'ESTUDIANTE'],
    ['get', '/classrooms/class-A/students', 'ACUDIENTE'],
    ['put', '/classrooms/activities/act-A-pub/assign-students', 'ESTUDIANTE'],
    ['delete', '/classrooms/activities/act-A-pub', 'COORDINADOR-X-INVENTADO'],
  ])('%s %s con rol %s sigue prohibido (403)', async (method, path, role) => {
    await (http() as any)[method](path)
      .auth(token(A, role, role === 'ESTUDIANTE' ? 'user-A1' : 'actor-x'), { type: 'bearer' })
      .send(method === 'get' || method === 'delete' ? undefined : { teacherAssignmentId: 'ta-A', studentEnrollmentIds: [], isRestrictedToAssigned: false, title: 'x' })
      .expect(403);
    noWrites(data);
  });

  it('una sesión sin institución responde 400, no 500', async () => {
    await http()
      .get('/classrooms')
      .auth(token(null, 'DOCENTE', 'usuario-fantasma'), { type: 'bearer' })
      .expect(400);
    noWrites(data);
  });

  it('una sesión sin institutionId en el JWT cae al fallback determinista de InstitutionUser', async () => {
    // teacher-shared está en A (joinedAt más antiguo) y en B: el fallback resuelve A.
    const r = await http()
      .get('/classrooms')
      .auth(token(null, 'DOCENTE', 'teacher-shared'), { type: 'bearer' })
      .expect(200);
    const ids = r.body.map((c: any) => c.id);
    expect(ids).toContain('class-A');
    expect(ids).not.toContain('class-B');
  });

  // ─── Body forjado: el ValidationPipe rechaza campos no declarados ──────────
  it.each([
    ['institutionId', { teacherAssignmentId: 'ta-disponible-A', institutionId: B }],
    ['teacherId', { teacherAssignmentId: 'ta-disponible-A', teacherId: 'teacher-shared' }],
    ['studentId', { teacherAssignmentId: 'ta-disponible-A', studentId: 'student-B1' }],
    ['role', { teacherAssignmentId: 'ta-disponible-A', role: 'student' }],
  ])('POST /classrooms con %s forjado en el cuerpo responde 400', async (_campo, body) => {
    await http().post('/classrooms').auth(token(A), { type: 'bearer' }).send(body).expect(400);
    noWrites(data);
  });

  it('un campo forjado en el cuerpo de actividad responde 400', async () => {
    await http()
      .put('/classrooms/activities/act-A-pub')
      .auth(token(A), { type: 'bearer' })
      .send({ title: 'ok', institutionId: B })
      .expect(400);
    noWrites(data);
  });

  // ─── El query `role` ya no concede nada ────────────────────────────────────
  it.each(['student', 'teacher', 'inventado'])('?role=%s no cambia la rama ni el permiso', async (role) => {
    // Docente propietario: con o sin role=student sigue viendo la rama docente (con borrador).
    const conRole = await http()
      .get(`/classrooms/class-A/activities?role=${role}`)
      .auth(token(A), { type: 'bearer' })
      .expect(200);
    expect(conRole.body.some((a: any) => a.id === 'act-A-draft')).toBe(true); // rama docente
    // Estudiante: role=teacher NO lo lleva a la rama docente — no ve el borrador.
    const deAlumno = await http()
      .get(`/classrooms/class-A/activities?role=${role}`)
      .auth(token(A, 'ESTUDIANTE', 'user-A1'), { type: 'bearer' })
      .expect(200);
    expect(deAlumno.body.some((a: any) => a.id === 'act-A-draft')).toBe(false);
    noWrites(data);
  });

  it('la respuesta del estudiante es idéntica con y sin el query role', async () => {
    const sin = await http().get('/classrooms/class-A/activities').auth(token(A, 'ESTUDIANTE', 'user-A1'), { type: 'bearer' }).expect(200);
    const con = await http().get('/classrooms/class-A/activities?role=teacher').auth(token(A, 'ESTUDIANTE', 'user-A1'), { type: 'bearer' }).expect(200);
    expect(con.body.map((a: any) => a.id)).toEqual(sin.body.map((a: any) => a.id));
  });

  // ─── SuperAdmin por HTTP: institución explícita, relaciones intactas ───────
  it('SuperAdmin con institución resuelta ve el aula de ESA institución y no la otra', async () => {
    const propia = await http()
      .get('/classrooms/class-B')
      .auth(token(B, '', 'root', true), { type: 'bearer' })
      .expect(200);
    expect(propia.body.id).toBe('class-B');
    await http()
      .get('/classrooms/class-A')
      .auth(token(B, '', 'root', true), { type: 'bearer' })
      .expect(404); // nunca se salta la validación de relaciones
    // Tampoco gestiona: no es el docente asignado.
    await http()
      .put('/classrooms/class-B')
      .auth(token(B, '', 'root', true), { type: 'bearer' })
      .send({ title: 'x' })
      .expect(403);
    noWrites(data);
  });

  // ─── El otro docente del mismo colegio ────────────────────────────────────
  it('el otro docente de A recibe 403 dentro de su colegio y 404 fuera', async () => {
    await http().get('/classrooms/class-A/students').auth(token(A, 'DOCENTE', 'teacher-otro-A'), { type: 'bearer' }).expect(403);
    await http().get('/classrooms/class-B/students').auth(token(A, 'DOCENTE', 'teacher-otro-A'), { type: 'bearer' }).expect(404);
    noWrites(data);
  });

  // ─── Estudiantes por HTTP ──────────────────────────────────────────────────
  it('un estudiante no ve el aula de otro grupo/año ni la del otro colegio: 404', async () => {
    await http().get('/classrooms/class-A').auth(token(A, 'ESTUDIANTE', 'user-A3'), { type: 'bearer' }).expect(404);
    await http().get('/classrooms/class-A').auth(token(A, 'ESTUDIANTE', 'user-A4'), { type: 'bearer' }).expect(404);
    await http().get('/classrooms/class-A').auth(token(B, 'ESTUDIANTE', 'user-B1'), { type: 'bearer' }).expect(404);
    noWrites(data);
  });

  it('un estudiante no puede listar estudiantes ni destinatarios (403 de rol, sin PII)', async () => {
    await http().get('/classrooms/class-A/students').auth(token(A, 'ESTUDIANTE', 'user-A1'), { type: 'bearer' }).expect(403);
    await http().get('/classrooms/activities/act-A-restr/assignments').auth(token(A, 'ESTUDIANTE', 'user-A1'), { type: 'bearer' }).expect(403);
    noWrites(data);
    expect(data.calls.filter((c) => c.model === 'studentEnrollment' && c.method === 'findMany')).toEqual([]);
  });

  it('la actividad restringida: el asignado la abre, el compañero recibe 404', async () => {
    const propia = await http()
      .get('/classrooms/activities/act-A-restr')
      .auth(token(A, 'ESTUDIANTE', 'user-A1'), { type: 'bearer' })
      .expect(200);
    expect(propia.body.id).toBe('act-A-restr');
    await http()
      .get('/classrooms/activities/act-A-restr')
      .auth(token(A, 'ESTUDIANTE', 'user-A2'), { type: 'bearer' })
      .expect(404);
    // El borrador es 404 para cualquier estudiante.
    await http()
      .get('/classrooms/activities/act-A-draft')
      .auth(token(A, 'ESTUDIANTE', 'user-A1'), { type: 'bearer' })
      .expect(404);
  });

  // ─── Lote mixto por HTTP: falla completo antes de escribir ─────────────────
  it('assign-students con una matrícula ajena entre válidas responde 404 y no escribe nada', async () => {
    await http()
      .put('/classrooms/activities/act-A-restr/assign-students')
      .auth(token(A), { type: 'bearer' })
      .send({ studentEnrollmentIds: ['enr-A2', 'enr-B1'], isRestrictedToAssigned: true })
      .expect(404);
    expect(data.rows.activityAssignment.map((a: any) => a.id)).toEqual(['aa-A1', 'aa-B1', 'aa-inc-A']);
    noWrites(data);
  });

  it('dependencies con un prerrequisito del otro colegio responde 404 y no escribe nada', async () => {
    await http()
      .put('/classrooms/activities/act-A-draft/dependencies')
      .auth(token(A), { type: 'bearer' })
      .send({ prerequisites: [{ prerequisiteId: 'act-A-pub' }, { prerequisiteId: 'act-B-pub' }] })
      .expect(404);
    expect(data.rows.activityDependency).toHaveLength(1);
    noWrites(data);
  });

  // ─── Flujos legítimos por HTTP con contenido comprobable ───────────────────
  it('el docente lista sus aulas con conteos y no ve las del otro colegio', async () => {
    const r = await http().get('/classrooms').auth(token(A), { type: 'bearer' }).expect(200);
    const ids = r.body.map((c: any) => c.id);
    expect(ids).toContain('class-A');
    expect(ids).not.toContain('class-B');
    expect(r.body.find((c: any) => c.id === 'class-A').studentCount).toBe(2); // sin la matrícula incoherente
    // El mismo usuario con sesión en B solo ve lo de B.
    const rB = await http().get('/classrooms').auth(token(B), { type: 'bearer' }).expect(200);
    expect(rB.body.map((c: any) => c.id)).toEqual(['class-B']);
  });

  it('available-assignments solo muestra asignaciones libres de la institución de la sesión', async () => {
    const r = await http().get('/classrooms/available-assignments').auth(token(A), { type: 'bearer' }).expect(200);
    expect(r.body.map((t: any) => t.id)).toEqual(['ta-disponible-A']);
  });

  it('el docente crea su aula y deja de ver la asignación como disponible', async () => {
    const r = await http()
      .post('/classrooms')
      .auth(token(A), { type: 'bearer' })
      .send({ teacherAssignmentId: 'ta-disponible-A' })
      .expect(201);
    expect(r.body.institutionId).toBe(A);
    expect(r.body.title).toBe('Materia A - Grado A A-02');
    const disp = await http().get('/classrooms/available-assignments').auth(token(A), { type: 'bearer' }).expect(200);
    expect(disp.body).toEqual([]);
  });

  it('getById legítimo del docente trae contenido; el del estudiante trae su matrícula', async () => {
    const delDocente = await http().get('/classrooms/class-A').auth(token(A), { type: 'bearer' }).expect(200);
    expect(delDocente.body.sections).toHaveLength(2); // incluida la sección oculta
    expect(delDocente.body.announcements).toHaveLength(1);
    expect(delDocente.body.currentPeriod?.id).toBe('term-A');
    const delAlumno = await http().get('/classrooms/class-A').auth(token(A, 'ESTUDIANTE', 'user-A1'), { type: 'bearer' }).expect(200);
    expect(delAlumno.body.studentEnrollmentId).toBe('enr-A1');
  });

  it('el docente edita su aula', async () => {
    const r = await http()
      .put('/classrooms/class-A')
      .auth(token(A), { type: 'bearer' })
      .send({ title: 'Aula renombrada' })
      .expect(200);
    expect(r.body.title).toBe('Aula renombrada');
  });

  it('getStudents devuelve la PII del grupo propio filtrada por cadena', async () => {
    const r = await http().get('/classrooms/class-A/students').auth(token(A), { type: 'bearer' }).expect(200);
    expect(r.body.map((e: any) => e.id).sort()).toEqual(['enr-A1', 'enr-A2']);
    expect(JSON.stringify(r.body)).not.toContain('DeB');
  });

  it('ciclo completo de actividad: crear borrador, publicar programado, publicar ya, despublicar', async () => {
    const creada = await http()
      .post('/classrooms/class-A/activities')
      .auth(token(A), { type: 'bearer' })
      .send({ type: 'TASK', title: 'Tarea HTTP', dueDate: '2026-03-10' })
      .expect(201);
    expect(creada.body.isPublished).toBe(false);
    expect(creada.body.dueDate).toBe('2026-03-10T05:00:00.000Z');
    const programada = await http()
      .put(`/classrooms/activities/${creada.body.id}/publish`)
      .auth(token(A), { type: 'bearer' })
      .send({ scheduledPublishAt: '2026-12-01' })
      .expect(200);
    expect(programada.body.isPublished).toBe(false);
    expect(programada.body.scheduledPublishAt).toBe('2026-12-01T05:00:00.000Z');
    const inmediata = await http()
      .put(`/classrooms/activities/${creada.body.id}/publish`)
      .auth(token(A), { type: 'bearer' })
      .send({})
      .expect(200);
    expect(inmediata.body.isPublished).toBe(true);
    const despublicada = await http()
      .put(`/classrooms/activities/${creada.body.id}/unpublish`)
      .auth(token(A), { type: 'bearer' })
      .expect(200);
    expect(despublicada.body.isPublished).toBe(false);
  });

  it('la rama docente lista borradores, conteos y prerrequisitos; la de estudiante no', async () => {
    const docente = await http().get('/classrooms/class-A/activities').auth(token(A), { type: 'bearer' }).expect(200);
    expect(docente.body).toHaveLength(4);
    expect(docente.body.find((a: any) => a.id === 'act-A-pub').gradingPending).toBe(1);
    const alumno = await http().get('/classrooms/class-A/activities').auth(token(A, 'ESTUDIANTE', 'user-A1'), { type: 'bearer' }).expect(200);
    expect(alumno.body.map((a: any) => a.id).sort()).toEqual(['act-A-dep', 'act-A-pub', 'act-A-restr']);
    expect(alumno.body.find((a: any) => a.id === 'act-A-dep').locked).toBe(true);
  });

  it('assign-students legítimo y luego assignments refleja los destinatarios', async () => {
    const r = await http()
      .put('/classrooms/activities/act-A-pub/assign-students')
      .auth(token(A), { type: 'bearer' })
      .send({ studentEnrollmentIds: ['enr-A1', 'enr-A2'], isRestrictedToAssigned: true })
      .expect(200);
    expect(r.body.isRestrictedToAssigned).toBe(true);
    expect(r.body.assignedStudents).toHaveLength(2);
    const lista = await http().get('/classrooms/activities/act-A-pub/assignments').auth(token(A), { type: 'bearer' }).expect(200);
    expect(lista.body).toHaveLength(2);
    expect(JSON.stringify(lista.body)).not.toContain('DeB');
  });

  it('students-for-assignment devuelve las matrículas activas propias', async () => {
    const r = await http().get('/classrooms/class-A/students-for-assignment').auth(token(A), { type: 'bearer' }).expect(200);
    expect(r.body.map((e: any) => e.enrollmentId).sort()).toEqual(['enr-A1', 'enr-A2']);
  });

  it('dependencies legítimo reemplaza el conjunto; deleteActivity pide confirmación y borra con force', async () => {
    const deps = await http()
      .put('/classrooms/activities/act-A-draft/dependencies')
      .auth(token(A), { type: 'bearer' })
      .send({ prerequisites: [{ prerequisiteId: 'act-A-pub', condition: 'GRADED' }] })
      .expect(200);
    expect(deps.body).toEqual([expect.objectContaining({ prerequisiteId: 'act-A-pub', condition: 'GRADED' })]);
    const confirmacion = await http()
      .delete('/classrooms/activities/act-A-pub')
      .auth(token(A), { type: 'bearer' })
      .expect(200);
    expect(confirmacion.body).toMatchObject({ success: false, requiresConfirmation: true, submissionCount: 3 });
    const borrada = await http()
      .delete('/classrooms/activities/act-A-pub?force=true')
      .auth(token(A), { type: 'bearer' })
      .expect(200);
    expect(borrada.body).toEqual({ success: true });
  });

  // ─── Revisión adversarial de Astra (2026-09-12): regresiones HTTP ──────────
  it('assignments NO devuelve el destinatario incoherente preexistente ni PII de B', async () => {
    const r = await http()
      .get('/classrooms/activities/act-A-restr/assignments')
      .auth(token(A), { type: 'bearer' })
      .expect(200);
    expect(r.body.map((a: any) => a.id)).toEqual(['aa-A1']);
    expect(JSON.stringify(r.body)).not.toContain('DeB');
    // Indistinguible de un recurso inexistente.
    const ajena = await http().get('/classrooms/activities/act-B-restr/assignments').auth(token(A), { type: 'bearer' });
    const inexistente = await http().get('/classrooms/activities/act-que-no-existe/assignments').auth(token(A), { type: 'bearer' });
    expect(ajena.status).toBe(404);
    expect(inexistente.status).toBe(404);
    expect(ajena.body.message).toBe(inexistente.body.message);
  });

  it('el listado del docente no incluye aulas con la cadena incoherente (año, grupo o materia de B)', async () => {
    const r = await http().get('/classrooms').auth(token(A), { type: 'bearer' }).expect(200);
    const ids = r.body.map((c: any) => c.id);
    expect(ids).toContain('class-A');
    expect(ids).not.toContain('class-inc-A');
    expect(ids).not.toContain('class-inc-year-A');
    expect(ids).not.toContain('class-inc-subject-A');
  });

  it('getById del estudiante: sin sección/material ocultos y conteo solo de publicadas', async () => {
    const r = await http().get('/classrooms/class-A').auth(token(A, 'ESTUDIANTE', 'user-A1'), { type: 'bearer' }).expect(200);
    expect(r.body.sections.map((s: any) => s.id)).toEqual(['section-A1']);
    expect(r.body.sections[0].materials.map((m: any) => m.id)).toEqual(['mat-A1']);
    expect(JSON.stringify(r.body)).not.toContain('Unidad oculta');
    expect(JSON.stringify(r.body)).not.toContain('Material oculto');
    expect(r.body._count.activities).toBe(3);
  });

  it('getActivity del estudiante no expone el conteo interno de entregas', async () => {
    const r = await http()
      .get('/classrooms/activities/act-A-pub')
      .auth(token(A, 'ESTUDIANTE', 'user-A1'), { type: 'bearer' })
      .expect(200);
    expect(r.body._count).toBeUndefined();
    const docente = await http().get('/classrooms/activities/act-A-pub').auth(token(A), { type: 'bearer' }).expect(200);
    expect(docente.body._count.submissions).toBe(3);
  });

  it('createActivity con academicTermId, rubricId o sectionId ajenos/incompatibles responde 404 sin escribir', async () => {
    for (const extra of [
      { academicTermId: 'term-B' },
      { academicTermId: 'term-old-A' },
      { rubricId: 'rubric-B' },
      { sectionId: 'section-B1' },
    ]) {
      await http()
        .post('/classrooms/class-A/activities')
        .auth(token(A), { type: 'bearer' })
        .send({ type: 'TASK', title: 'intrusa', ...extra })
        .expect(404);
    }
    noWrites(data);
    const legit = await http()
      .post('/classrooms/class-A/activities')
      .auth(token(A), { type: 'bearer' })
      .send({ type: 'TASK', title: 'compatible', academicTermId: 'term-A', rubricId: 'rubric-A', sectionId: 'section-A1' })
      .expect(201);
    expect(legit.body.academicTermId).toBe('term-A');
    expect(legit.body.rubricId).toBe('rubric-A');
  });
});
