import { BadRequestException } from '@nestjs/common';
import { buildGate, ConstruyeService, teamSignal, validateSessionNote, validateStaticManifest, validateTeamBrief, validateVersionEvidence } from './construye.service';

const EMPTY_JOURNEY = { affected: '', whyItMatters: '', solution: '', screens: '', later: '', successCheck: '', sharePitch: '', reflection: '' };

describe('validateStaticManifest', () => {
  it('acepta el conjunto estático mínimo', () => {
    expect(validateStaticManifest({ files: [
      { path: 'index.html', content: '<main>Hola</main>' },
      { path: 'styles.css', content: 'main { color: teal }' },
      { path: 'app.js', content: 'console.log("hola")' },
    ] })).toEqual(expect.objectContaining({ files: expect.any(Array) }));
  });

  it('rechaza archivos ejecutables o dependencias externas', () => {
    expect(() => validateStaticManifest({ files: [
      { path: 'index.html', content: '<main></main>' },
      { path: 'package.json', content: '{"dependencies":{}}' },
    ] })).toThrow(BadRequestException);
  });

  it('exige una página de entrada', () => {
    expect(() => validateStaticManifest({ files: [{ path: 'app.js', content: '' }] })).toThrow(BadRequestException);
  });
});

describe('validateTeamBrief', () => {
  it('normaliza únicamente los campos pedagógicos certificados', () => {
    expect(validateTeamBrief({
      problem: '  Reducir residuos  ', audience: 'Estudiantes', subject: 'Ciencias', grade: '9.º',
      features: 'Clasificar residuos', style: 'Claro', offsets: [1, 2], code: '<script />',
    })).toEqual({
      ...EMPTY_JOURNEY,
      problem: 'Reducir residuos', audience: 'Estudiantes', subject: 'Ciencias', grade: '9.º',
      features: 'Clasificar residuos', style: 'Claro',
    });
  });

  it('permite guardar un borrador parcial sin inventar contenido', () => {
    expect(validateTeamBrief({ problem: 'Una idea', grade: '8.º' })).toEqual({
      ...EMPTY_JOURNEY,
      problem: 'Una idea', audience: '', subject: '', grade: '8.º', features: '', style: '',
    });
  });

  it('rechaza grados fuera del contrato', () => {
    expect(() => validateTeamBrief({ grade: 'Universidad' })).toThrow(BadRequestException);
  });
});

describe('ConstruyeService.updateBrief', () => {
  it('actualiza el estado actual y agrega una entrada histórica en la misma transacción', async () => {
    const updatedTeam = { id: 'team-1', projectId: 'project-1', brief: { problem: 'Reducir residuos' } };
    const journalEntry = { id: 'journal-1', type: 'BRIEF_UPDATED' };
    const tx = {
      construyeTeam: { update: jest.fn().mockResolvedValue(updatedTeam) },
      construyeJournalEntry: { create: jest.fn().mockResolvedValue(journalEntry) },
    };
    const prisma = {
      construyeTeam: { findFirst: jest.fn().mockResolvedValue({ id: 'team-1', projectId: 'project-1', brief: null }) },
      construyeTeamMember: { findFirst: jest.fn().mockResolvedValue({ studentEnrollmentId: 'enrollment-1', studentEnrollment: { id: 'enrollment-1', studentId: 'student-1' } }) },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new ConstruyeService(prisma as any);

    await expect(service.updateBrief('team-1', 'institution-1', 'user-1', {
      brief: { problem: 'Reducir residuos', grade: '8.º' },
    })).resolves.toEqual({ team: updatedTeam, journalEntry });

    expect(tx.construyeTeam.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'team-1' },
      data: expect.objectContaining({ brief: expect.objectContaining({ problem: 'Reducir residuos' }), briefUpdatedAt: expect.any(Date) }),
    }));
    expect(tx.construyeJournalEntry.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        institutionId: 'institution-1', projectId: 'project-1', teamId: 'team-1',
        actorEnrollmentId: 'enrollment-1', type: 'BRIEF_UPDATED',
        detail: expect.objectContaining({ changedFields: expect.arrayContaining(['problem']) }),
      }),
    }));
  });
});

describe('recorrido pedagógico', () => {
  it('conserva los campos nuevos del recorrido y los briefs antiguos siguen siendo válidos', () => {
    const brief = validateTeamBrief({ problem: 'Fila larga en la tienda', affected: 'Estudiantes de primaria', successCheck: 'Si pido, aparece mi turno' });
    expect(brief).toEqual(expect.objectContaining({ problem: 'Fila larga en la tienda', affected: 'Estudiantes de primaria', successCheck: 'Si pido, aparece mi turno', solution: '' }));
    expect(() => validateTeamBrief({ problem: 'x', audience: 'y', subject: '', grade: '10.º', features: 'z', style: '' })).not.toThrow();
  });

  it('pide solo problema, versión 1 y prueba antes de la primera versión', () => {
    expect(buildGate(null, 0, false)).toEqual({ canSaveFirstVersion: false, unlockedByTeacher: false, hasVersions: false, missing: ['problem', 'features', 'successCheck'] });
    expect(buildGate({ problem: 'Fila larga', features: 'Lista de pedidos', successCheck: 'Aparece el pedido' }, 0, false).canSaveFirstVersion).toBe(true);
    expect(buildGate({ problem: 'Fila larga', features: '  ', successCheck: 'ok' }, 0, false).missing).toEqual(['features', 'successCheck']);
  });

  it('no bloquea equipos con versiones anteriores ni equipos habilitados por el docente', () => {
    expect(buildGate(null, 2, false).canSaveFirstVersion).toBe(true);
    expect(buildGate({}, 0, true).canSaveFirstVersion).toBe(true);
  });

  it('valida la evidencia de versión sin exigirla a clientes anteriores', () => {
    expect(validateVersionEvidence(undefined)).toBeNull();
    expect(validateVersionEvidence({ attempted: ' Agregar tareas ', tested: 'Escribí una y apareció' })).toEqual({ attempted: 'Agregar tareas', tested: 'Escribí una y apareció', learned: '', explained: '', peerFeedback: '' });
    expect(() => validateVersionEvidence({ attempted: 'Algo' })).toThrow(BadRequestException);
    expect(() => validateVersionEvidence({ tested: 'Algo' })).toThrow(BadRequestException);
  });
});

describe('ConstruyeService.createVersion', () => {
  const manifest = { files: [{ path: 'index.html', content: '<main></main>' }] };
  function setup({ brief = null as unknown, latest = null as unknown, unlock = null as unknown } = {}) {
    const tx = {
      construyeVersion: { findFirst: jest.fn().mockResolvedValue(latest), create: jest.fn().mockResolvedValue({ id: 'v1', number: 1 }) },
      construyeJournalEntry: { findFirst: jest.fn().mockResolvedValue(unlock), create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      construyeTeam: { findFirst: jest.fn().mockResolvedValue({ id: 'team-1', projectId: 'project-1', brief }) },
      construyeTeamMember: { findFirst: jest.fn().mockResolvedValue({ studentEnrollmentId: 'enrollment-1', studentEnrollment: { id: 'enrollment-1', studentId: 'student-1' } }) },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    return { tx, service: new ConstruyeService(prisma as any) };
  }

  it('rechaza la primera versión si el equipo no ha contado su plan', async () => {
    const { tx, service } = setup({ brief: { problem: 'Fila larga' } });
    await expect(service.createVersion('team-1', 'institution-1', 'user-1', { manifest })).rejects.toThrow(BadRequestException);
    expect(tx.construyeVersion.create).not.toHaveBeenCalled();
  });

  it('acepta la primera versión con la excepción del docente y guarda la evidencia en la bitácora', async () => {
    const { tx, service } = setup({ unlock: { id: 'unlock-1' } });
    await service.createVersion('team-1', 'institution-1', 'user-1', { manifest, evidence: { attempted: 'Primer formulario', tested: 'Agregué una tarea' } });
    expect(tx.construyeVersion.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ number: 1, label: 'Primer formulario' }) }));
    expect(tx.construyeJournalEntry.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      type: 'VERSION_CREATED',
      detail: expect.objectContaining({ evidence: { attempted: 'Primer formulario', tested: 'Agregué una tarea', learned: '', explained: '', peerFeedback: '' } }),
    }) }));
  });

  it('no aplica la condición cuando el equipo ya tenía versiones', async () => {
    const { tx, service } = setup({ latest: { number: 3 } });
    await service.createVersion('team-1', 'institution-1', 'user-1', { manifest, label: 'Cliente anterior' });
    expect(tx.construyeJournalEntry.findFirst).not.toHaveBeenCalled();
    expect(tx.construyeVersion.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ number: 4, label: 'Cliente anterior' }) }));
  });
});

describe('ConstruyeService.unlockBuild', () => {
  it('solo el docente dueño del aula registra la excepción, con el docente como autor', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'entry-1' });
    const prisma = {
      construyeTeam: { findFirst: jest.fn().mockResolvedValue({ id: 'team-1', projectId: 'project-1' }) },
      construyeProject: { findFirst: jest.fn().mockResolvedValue({ id: 'project-1', classroomId: 'classroom-1' }) },
      classroom: { findFirst: jest.fn().mockResolvedValue({ id: 'classroom-1', teacherAssignment: { teacherId: 'teacher-1' } }) },
      construyeJournalEntry: { create },
    };
    const service = new ConstruyeService(prisma as any);
    await service.unlockBuild('team-1', 'institution-1', 'teacher-1', { reason: 'Trabajan en papel' });
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ actorUserId: 'teacher-1', type: 'TEACHER_COMMENT', detail: { kind: 'BUILD_UNLOCKED' } }) });
    await expect(service.unlockBuild('team-1', 'institution-1', 'otro-docente', {})).rejects.toThrow();
  });
});

describe('etapa compartir, evidencia ampliada y notas de sesión', () => {
  it('guarda la presentación y la reflexión del equipo', () => {
    expect(validateTeamBrief({ sharePitch: 'Nuestro problema era…', reflection: 'Aprendimos a probar' })).toEqual(expect.objectContaining({ sharePitch: 'Nuestro problema era…', reflection: 'Aprendimos a probar' }));
  });

  it('acepta qué parte del código explican y lo que dijo otro equipo', () => {
    expect(validateVersionEvidence({ attempted: 'Borrar tareas', tested: 'Borré una', explained: 'El botón está en app.js', peerFeedback: 'Les confundió el color' }))
      .toEqual({ attempted: 'Borrar tareas', tested: 'Borré una', learned: '', explained: 'El botón está en app.js', peerFeedback: 'Les confundió el color' });
  });

  it('valida las tarjetas de meta y de salida', () => {
    expect(validateSessionNote({ kind: 'GOAL', goal: ' Que se puedan borrar tareas ' })).toEqual({ kind: 'GOAL', goal: 'Que se puedan borrar tareas' });
    expect(validateSessionNote({ kind: 'EXIT', met: 'partly', blocker: 'No sabemos borrar' })).toEqual({ kind: 'EXIT', met: 'partly', blocker: 'No sabemos borrar', next: '' });
    expect(() => validateSessionNote({ kind: 'GOAL', goal: '' })).toThrow(BadRequestException);
    expect(() => validateSessionNote({ kind: 'EXIT', met: 'tal vez' })).toThrow(BadRequestException);
    expect(() => validateSessionNote({ kind: 'OTRA' })).toThrow(BadRequestException);
  });
});

describe('teamSignal', () => {
  const now = new Date('2026-09-20T15:00:00Z');
  const at = (iso: string) => new Date(iso);

  it('marca en rojo un pedido de ayuda hasta que hay avance o respuesta del docente', () => {
    expect(teamSignal([{ type: 'HELP_REQUESTED', createdAt: at('2026-09-20T10:00:00Z') }, { type: 'VERSION_CREATED', createdAt: at('2026-09-19T10:00:00Z') }], now)).toEqual({ level: 'red', reason: 'Pidió ayuda' });
    expect(teamSignal([{ type: 'TEACHER_COMMENT', createdAt: at('2026-09-20T11:00:00Z') }, { type: 'HELP_REQUESTED', createdAt: at('2026-09-20T10:00:00Z') }], now).level).toBe('green');
  });

  it('marca en rojo un bloqueo reportado en la salida', () => {
    const signal = teamSignal([{ type: 'SESSION_NOTE', createdAt: at('2026-09-20T12:00:00Z'), detail: { kind: 'EXIT', met: 'partly', blocker: 'La lista no se actualiza' } }], now);
    expect(signal).toEqual({ level: 'red', reason: 'Bloqueo: La lista no se actualiza' });
  });

  it('marca en amarillo la inactividad y la meta no cumplida', () => {
    expect(teamSignal([], now).level).toBe('yellow');
    expect(teamSignal([{ type: 'BRIEF_UPDATED', createdAt: at('2026-09-10T10:00:00Z') }], now).reason).toBe('Sin actividad en la última semana');
    expect(teamSignal([{ type: 'SESSION_NOTE', createdAt: at('2026-09-20T12:00:00Z'), detail: { kind: 'EXIT', met: 'no', blocker: '' } }], now).level).toBe('yellow');
  });

  it('marca en verde a un equipo activo sin alertas', () => {
    expect(teamSignal([{ type: 'BRIEF_UPDATED', createdAt: at('2026-09-20T10:00:00Z') }], now)).toEqual({ level: 'green', reason: 'Avanza' });
  });
});
