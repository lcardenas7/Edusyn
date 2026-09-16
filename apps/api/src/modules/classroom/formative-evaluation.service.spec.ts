import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { FormativeEvaluationService, peerRing, sanitizeDimensionInput, scoreAnswers, seededShuffle, shuffledPeerRing, validateManualPairs } from './formative-evaluation.service';

describe('peerRing (peer-ring-v1)', () => {
  it('nadie se evalúa a sí mismo, sin duplicados, y cada estudiante da y recibe k evaluaciones', () => {
    const ids = ['e5', 'e1', 'e4', 'e2', 'e3'];
    const pairs = peerRing(ids, 2);
    expect(pairs).toHaveLength(10);
    expect(pairs.every(p => p.evaluator !== p.target)).toBe(true);
    expect(new Set(pairs.map(p => `${p.evaluator}>${p.target}`)).size).toBe(pairs.length);
    for (const id of ids) {
      expect(pairs.filter(p => p.evaluator === id)).toHaveLength(2);
      expect(pairs.filter(p => p.target === id)).toHaveLength(2);
    }
  });

  it('es determinista y limita k al tamaño del grupo', () => {
    expect(peerRing(['b', 'a', 'c'], 2)).toEqual(peerRing(['c', 'b', 'a'], 2));
    expect(peerRing(['a', 'b'], 5)).toEqual([{ evaluator: 'a', target: 'b' }, { evaluator: 'b', target: 'a' }]);
    expect(() => peerRing(['solo'], 1)).toThrow(BadRequestException);
  });
});

describe('scoreAnswers', () => {
  const criteria = [
    { id: 'c1', weight: 60, levels: [{ id: 'c1l1', score: 1 }, { id: 'c1l2', score: 5 }] },
    { id: 'c2', weight: 40, levels: [{ id: 'c2l1', score: 2 }, { id: 'c2l2', score: 4 }] },
  ];

  it('pondera cada criterio', () => {
    expect(scoreAnswers(criteria, [{ criterionId: 'c1', levelId: 'c1l2' }, { criterionId: 'c2', levelId: 'c2l1' }])).toBe(3.8);
  });

  it('rechaza criterios faltantes, repetidos o niveles ajenos', () => {
    expect(() => scoreAnswers(criteria, [{ criterionId: 'c1', levelId: 'c1l1' }])).toThrow('Debes responder todos los criterios');
    expect(() => scoreAnswers(criteria, [{ criterionId: 'c1', levelId: 'c1l1' }, { criterionId: 'c1', levelId: 'c1l2' }])).toThrow('Cada criterio se responde una sola vez');
    expect(() => scoreAnswers(criteria, [{ criterionId: 'c1', levelId: 'c2l1' }, { criterionId: 'c2', levelId: 'c2l1' }])).toThrow(BadRequestException);
    expect(() => scoreAnswers(criteria, 'nada')).toThrow(BadRequestException);
  });
});

describe('sanitizeDimensionInput', () => {
  it('conserva solo lo que el docente decide y descarta campos internos', () => {
    const clean = sanitizeDimensionInput({ label: ' Coevaluación ', evaluatorType: 'PEER', rubricId: 'r1', peersPerStudent: 50, gradebookActivityIndex: 99, id: 'x', activityId: 'otro' });
    expect(clean).toEqual({ label: 'Coevaluación', evaluatorType: 'PEER', rubricId: 'r1', evaluationComponentId: null, peersPerStudent: 10, revealEvaluator: false, requireCommentReview: true, allowIncomplete: false });
  });

  it('no ofrece dimensiones que nadie podría responder todavía', () => {
    expect(() => sanitizeDimensionInput({ label: 'Docente', evaluatorType: 'TEACHER', rubricId: 'r1' })).toThrow(BadRequestException);
    expect(sanitizeDimensionInput({ label: 'Yo', evaluatorType: 'SELF', rubricId: 'r1', peersPerStudent: 3 }).peersPerStudent).toBeNull();
  });
});

function service(prisma: any, partialGrades: any = {}) {
  return new FormativeEvaluationService(prisma, partialGrades, {} as any);
}

describe('FormativeEvaluationService.submit', () => {
  it('sin matrícula activa no puede responder nada (el filtro nunca queda vacío)', async () => {
    const findAssignment = jest.fn();
    const svc = service({ studentEnrollment: { findFirst: jest.fn().mockResolvedValue(null) }, formativeEvaluationAssignment: { findFirst: findAssignment } });
    await expect(svc.submit('a1', 'inst', 'user', { answers: [] })).rejects.toThrow(ForbiddenException);
    expect(findAssignment).not.toHaveBeenCalled();
  });

  it('respeta el plazo de cierre', async () => {
    const svc = service({
      studentEnrollment: { findFirst: jest.fn().mockResolvedValue({ id: 'e1' }) },
      formativeEvaluationAssignment: { findFirst: jest.fn().mockResolvedValue({ status: 'PENDING', dimension: { rubricSnapshot: { criteria: [] } }, activity: { opensAt: null, closesAt: new Date('2020-01-01') } }) },
    });
    await expect(svc.submit('a1', 'inst', 'user', { answers: [] })).rejects.toThrow('El plazo para responder terminó');
  });

  it('guarda el puntaje y los comentarios recortados', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'a1', status: 'SUBMITTED' });
    const svc = service({
      studentEnrollment: { findFirst: jest.fn().mockResolvedValue({ id: 'e1' }) },
      formativeEvaluationAssignment: {
        findFirst: jest.fn().mockResolvedValue({ status: 'PENDING', dimension: { requireCommentReview: true, rubricSnapshot: { criteria: [{ id: 'c1', weight: 100, levels: [{ id: 'l1', score: 4 }] }] } }, activity: { opensAt: null, closesAt: null } }),
        update,
      },
    });
    await svc.submit('a1', 'inst', 'user', { answers: [{ criterionId: 'c1', levelId: 'l1' }], comments: [{ text: '  Buen trabajo  ' }, { text: '   ' }] });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ calculatedScore: 4, commentStatus: 'PENDING_REVIEW', qualitativeComments: [{ prompt: 'Comentario', text: 'Buen trabajo' }] }) }));
  });
});

describe('FormativeEvaluationService.publish', () => {
  it('crea autoevaluaciones y coevaluaciones balanceadas en una transacción', async () => {
    const createMany = jest.fn();
    const update = jest.fn();
    const prisma = {
      formativeEvaluationActivity: { findFirst: jest.fn().mockResolvedValue({ id: 'act', status: 'DRAFT', teacherAssignment: { groupId: 'g', academicYearId: 'y' }, dimensions: [{ id: 'dSelf', evaluatorType: 'SELF' }, { id: 'dPeer', evaluatorType: 'PEER', peersPerStudent: 2 }] }) },
      studentEnrollment: { findMany: jest.fn().mockResolvedValue([{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }]) },
      $transaction: jest.fn((cb: any) => cb({ formativeEvaluationAssignment: { createMany }, formativeEvaluationActivity: { update } })),
    };
    const result = await service(prisma).publish('act', 'inst', 'teacher');
    expect(result).toEqual({ published: true, assignments: 9, algorithmVersion: 'peer-shuffled-ring-v1' });
    const data = createMany.mock.calls[0][0].data;
    expect(data.filter((a: any) => a.dimensionId === 'dSelf').every((a: any) => a.evaluatorEnrollmentId === a.targetEnrollmentId)).toBe(true);
    expect(data.filter((a: any) => a.dimensionId === 'dPeer').some((a: any) => a.evaluatorEnrollmentId === a.targetEnrollmentId)).toBe(false);
  });

  it('solo publica borradores del propio docente', async () => {
    const svc = service({ formativeEvaluationActivity: { findFirst: jest.fn().mockResolvedValue(null) } });
    await expect(svc.publish('act', 'otra-inst', 'teacher')).rejects.toThrow(ForbiddenException);
  });
});

describe('FormativeEvaluationService.consolidate', () => {
  it('los faltantes quedan incompletos, nunca como 0', async () => {
    const upsert = jest.fn();
    const prisma = {
      formativeEvaluationActivity: { findFirst: jest.fn().mockResolvedValue({ id: 'act', status: 'PUBLISHED', dimensions: [{ id: 'd', allowIncomplete: false }], teacherAssignment: {} }) },
      formativeEvaluationAssignment: { findMany: jest.fn().mockResolvedValue([
        { dimensionId: 'd', targetEnrollmentId: 'e1', status: 'SUBMITTED', calculatedScore: 4 },
        { dimensionId: 'd', targetEnrollmentId: 'e1', status: 'SUBMITTED', calculatedScore: 3 },
        { dimensionId: 'd', targetEnrollmentId: 'e2', status: 'SUBMITTED', calculatedScore: 5 },
        { dimensionId: 'd', targetEnrollmentId: 'e2', status: 'PENDING', calculatedScore: null },
      ]) },
      $transaction: jest.fn((cb: any) => cb({ formativeEvaluationResult: { deleteMany: jest.fn(), upsert }, formativeEvaluationActivity: { update: jest.fn() } })),
    };
    const svc = service(prisma);
    jest.spyOn(svc, 'dashboard').mockResolvedValue(null as any);
    await svc.consolidate('act', 'inst', 'teacher');
    const created = upsert.mock.calls.map(call => call[0].create);
    expect(created.find((r: any) => r.studentEnrollmentId === 'e1')).toEqual(expect.objectContaining({ quantitativeScore: 3.5, isReady: true }));
    expect(created.find((r: any) => r.studentEnrollmentId === 'e2')).toEqual(expect.objectContaining({ quantitativeScore: null, isReady: false, receivedResponses: 1, expectedResponses: 2 }));
  });
});

describe('FormativeEvaluationService.sync', () => {
  it('la misma clave idempotente no vuelve a escribir en la planilla', async () => {
    const previous = { id: 's1', activityId: 'act', items: [] };
    const upsert = jest.fn();
    const svc = service({ formativeGradeSync: { findUnique: jest.fn().mockResolvedValue(previous) } }, { upsert });
    await expect(svc.sync('act', 'inst', 'teacher', { idempotencyKey: 'k', previewHash: 'h' })).resolves.toBe(previous);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('no reutiliza la clave de otra evaluación', async () => {
    const svc = service({ formativeGradeSync: { findUnique: jest.fn().mockResolvedValue({ id: 's1', activityId: 'otra' }) } });
    await expect(svc.sync('act', 'inst', 'teacher', { idempotencyKey: 'k', previewHash: 'h' })).rejects.toThrow(BadRequestException);
  });

  it('si dos solicitudes chocan con la misma clave, la segunda devuelve la primera', async () => {
    const existing = { id: 's1', activityId: 'act', items: [] };
    const findUnique = jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(existing);
    const svc = service({
      formativeGradeSync: { findUnique, create: jest.fn().mockRejectedValue(new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' })) },
      formativeEvaluationActivity: { findFirst: jest.fn().mockResolvedValue({ id: 'act', dimensions: [], teacherAssignment: {} }) },
    });
    jest.spyOn(svc, 'previewSync').mockResolvedValue({ hash: 'h', term: 'P1', rows: [], summary: { ready: 0, incomplete: 0, withoutComponent: 0 } });
    await expect(svc.sync('act', 'inst', 'teacher', { idempotencyKey: 'k', previewHash: 'h' })).resolves.toBe(existing);
  });

  it('rechaza una previsualización que cambió', async () => {
    const svc = service({ formativeGradeSync: { findUnique: jest.fn().mockResolvedValue(null) } });
    jest.spyOn(svc, 'previewSync').mockResolvedValue({ hash: 'nuevo', term: 'P1', rows: [], summary: { ready: 0, incomplete: 0, withoutComponent: 0 } });
    await expect(svc.sync('act', 'inst', 'teacher', { idempotencyKey: 'k', previewHash: 'viejo' })).rejects.toThrow('La previsualización cambió');
  });
});

describe('reparto de coevaluación', () => {
  const ids = ['e1', 'e2', 'e3', 'e4', 'e5', 'e6'];

  it('el reparto automático es al azar pero reproducible con la misma semilla y equilibrado', () => {
    expect(seededShuffle(ids, 'semilla-1')).toEqual(seededShuffle([...ids].reverse(), 'semilla-1'));
    const a = shuffledPeerRing(ids, 2, 'semilla-1');
    expect(a).toEqual(shuffledPeerRing(ids, 2, 'semilla-1'));
    expect(a.every(p => p.evaluator !== p.target)).toBe(true);
    for (const id of ids) {
      expect(a.filter(p => p.evaluator === id)).toHaveLength(2);
      expect(a.filter(p => p.target === id)).toHaveLength(2);
    }
    const distintas = ['s1', 's2', 's3', 's4', 's5'].map(seed => JSON.stringify(shuffledPeerRing(ids, 1, seed)));
    expect(new Set(distintas).size).toBeGreaterThan(1);
  });

  it('valida el reparto manual', () => {
    const ok = validateManualPairs([{ dimensionId: 'd', evaluator: 'e1', target: 'e2' }, { dimensionId: 'd', evaluator: 'e1', target: 'e2' }], ['d'], ids);
    expect(ok).toEqual([{ dimensionId: 'd', evaluator: 'e1', target: 'e2' }]);
    expect(() => validateManualPairs([{ dimensionId: 'd', evaluator: 'e1', target: 'e1' }], ['d'], ids)).toThrow('no puede coevaluarse');
    expect(() => validateManualPairs([{ dimensionId: 'd', evaluator: 'e1', target: 'intruso' }], ['d'], ids)).toThrow('no está activo');
    expect(() => validateManualPairs([{ dimensionId: 'otra', evaluator: 'e1', target: 'e2' }], ['d'], ids)).toThrow('no es de coevaluación');
    expect(() => validateManualPairs([], ['d'], ids)).toThrow('al menos una pareja');
    expect(() => validateManualPairs('x', ['d'], ids)).toThrow(BadRequestException);
  });

  it('publica con el reparto manual del docente', async () => {
    const createMany = jest.fn();
    const update = jest.fn();
    const prisma = {
      formativeEvaluationActivity: { findFirst: jest.fn().mockResolvedValue({ id: 'act', status: 'DRAFT', teacherAssignment: { groupId: 'g', academicYearId: 'y' }, dimensions: [{ id: 'dPeer', evaluatorType: 'PEER', peersPerStudent: 2 }] }) },
      studentEnrollment: { findMany: jest.fn().mockResolvedValue([{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }]) },
      $transaction: jest.fn((cb: any) => cb({ formativeEvaluationAssignment: { createMany }, formativeEvaluationActivity: { update } })),
    };
    const result = await service(prisma).publish('act', 'inst', 'teacher', { peer: { mode: 'manual', pairs: [{ dimensionId: 'dPeer', evaluator: 'e1', target: 'e3' }, { dimensionId: 'dPeer', evaluator: 'e3', target: 'e2' }] } });
    expect(result).toEqual({ published: true, assignments: 2, algorithmVersion: 'peer-manual-v1' });
    expect(createMany.mock.calls[0][0].data.map((a: any) => a.evaluatorEnrollmentId + '>' + a.targetEnrollmentId)).toEqual(['e1>e3', 'e3>e2']);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ assignmentSeed: null, algorithmVersion: 'peer-manual-v1' }) }));
  });

  it('la vista previa y la publicación con la misma semilla dan el mismo reparto', async () => {
    const activity = { id: 'act', status: 'DRAFT', teacherAssignment: { groupId: 'g', academicYearId: 'y' }, dimensions: [{ id: 'dPeer', label: 'Coevaluación', evaluatorType: 'PEER', peersPerStudent: 1 }] };
    const students = ids.map(id => ({ id, student: { firstName: id, lastName: 'X' } }));
    const createMany = jest.fn();
    const prisma = {
      formativeEvaluationActivity: { findFirst: jest.fn().mockResolvedValue(activity) },
      studentEnrollment: { findMany: jest.fn().mockResolvedValue(students) },
      $transaction: jest.fn((cb: any) => cb({ formativeEvaluationAssignment: { createMany }, formativeEvaluationActivity: { update: jest.fn() } })),
    };
    const svc = service(prisma);
    const preview = await svc.peerPreview('act', 'inst', 'teacher', 'semilla-fija-123');
    await svc.publish('act', 'inst', 'teacher', { peer: { mode: 'auto', seed: preview.seed } });
    const published = createMany.mock.calls[0][0].data.map((a: any) => ({ evaluator: a.evaluatorEnrollmentId, target: a.targetEnrollmentId }));
    expect(published).toEqual(preview.dimensions[0].pairs);
    expect(preview.students[0]).toEqual({ id: 'e1', name: 'e1 X' });
  });
});
