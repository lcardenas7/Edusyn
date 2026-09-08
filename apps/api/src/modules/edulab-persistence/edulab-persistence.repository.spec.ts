import { ForbiddenException } from '@nestjs/common';
import { tenantContext } from '../../prisma/tenant-context';
import {
  EduLabPersistenceConflict,
  EduLabPersistenceRepository,
  hashEduLabPayload,
} from './edulab-persistence.repository';

describe('EduLabPersistenceRepository', () => {
  const identity = {
    institutionId: 'institution-a',
    userId: 'user-a1',
    clientAttemptId: 'client-attempt-1',
    experienceId: 'experience-1',
    definitionId: 'fuga-laboratorio',
    definitionVersion: 1,
    contentHash: `sha256:${'a'.repeat(64)}`,
    runtimeDefinitionHash: 'edulab-fnv1a32-1234abcd',
    engineVersion: '0.1.0',
    mode: 'EXPLORE' as const,
    seed: 'incident-a',
    stateHash: 'edulab-fnv1a32-5678abcd',
  };

  function makeRepository() {
    const tx = {
      eduLabAttempt: {
        findUnique: jest.fn().mockResolvedValue({ id: 'attempt-1' }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'attempt-1', concurrencyVersion: 1 }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      eduLabEvent: {
        findUnique: jest.fn().mockResolvedValue(null),
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };
    const prisma = {
      eduLabAttempt: {
        findUnique: jest.fn().mockResolvedValue(null),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    return { repository: new EduLabPersistenceRepository(prisma as any), prisma, tx };
  }

  function inContext<T>(tx: any, callback: () => T): T {
    return tenantContext.run(
      { tx, institutionId: identity.institutionId, userId: identity.userId },
      callback,
    );
  }

  it('fails closed when user context is absent or mismatched', async () => {
    const { repository } = makeRepository();
    await expect(repository.createAttempt(identity)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns the existing attempt for an identical creation key', async () => {
    const { repository, prisma, tx } = makeRepository();
    prisma.eduLabAttempt.findUnique.mockResolvedValue({ id: 'attempt-1', ...identity });

    await expect(inContext(tx, () => repository.createAttempt(identity))).resolves.toMatchObject({ id: 'attempt-1' });
    expect(prisma.eduLabAttempt.createMany).not.toHaveBeenCalled();
  });

  it('handles a concurrent identical creation without aborting the transaction', async () => {
    const { repository, prisma, tx } = makeRepository();
    prisma.eduLabAttempt.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'attempt-1', ...identity });
    prisma.eduLabAttempt.createMany.mockResolvedValue({ count: 0 });

    await expect(inContext(tx, () => repository.createAttempt(identity))).resolves.toMatchObject({ id: 'attempt-1' });
    expect(prisma.eduLabAttempt.createMany).toHaveBeenCalledWith({ data: [identity], skipDuplicates: true });
  });

  it('creates and then reads a new attempt inside the protected context', async () => {
    const { repository, prisma, tx } = makeRepository();
    prisma.eduLabAttempt.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'attempt-1', ...identity });

    await expect(inContext(tx, () => repository.createAttempt(identity))).resolves.toMatchObject({ id: 'attempt-1' });
    expect(prisma.eduLabAttempt.createMany).toHaveBeenCalledWith({ data: [identity], skipDuplicates: true });
  });

  it('rejects reuse of a creation key with different immutable input', async () => {
    const { repository, prisma, tx } = makeRepository();
    prisma.eduLabAttempt.findUnique.mockResolvedValue({ id: 'attempt-1', ...identity, seed: 'other-seed' });

    await expect(inContext(tx, () => repository.createAttempt(identity))).rejects.toMatchObject({
      code: 'IDEMPOTENCY_CONFLICT',
    });
  });

  it('canonicalizes payloads before hashing', () => {
    expect(hashEduLabPayload({ b: 2, a: 1 })).toBe(hashEduLabPayload({ a: 1, b: 2 }));
    expect(() => hashEduLabPayload({ unsafe: 1.5 })).toThrow('safe integers');
  });

  it('reserves the stream with compare-and-swap before inserting events', async () => {
    const { repository, prisma, tx } = makeRepository();
    const order: string[] = [];
    tx.eduLabAttempt.updateMany.mockImplementation(async () => {
      order.push('cas');
      return { count: 1 };
    });
    tx.eduLabEvent.createMany.mockImplementation(async () => {
      order.push('events');
      return { count: 2 };
    });

    await inContext(tx, () => repository.appendDecision({
      institutionId: identity.institutionId,
      userId: identity.userId,
      attemptId: 'attempt-1',
      expectedVersion: 0,
      expectedStreamSequence: 0n,
      stateHash: 'edulab-fnv1a32-9999aaaa',
      logicalTick: 1,
      decisionSequence: 1,
      engineEventSequence: 1,
      status: 'ACTIVE',
      events: [
        {
          id: 'event-1', kind: 'INTENT_ACCEPTED', eventType: 'intent.accepted',
          intentId: 'intent-1', decisionSequence: 1, logicalTick: 1,
          idempotencyKey: 'intent-1', correlationId: 'attempt-1', payload: { primitive: 'inspect' },
        },
        {
          id: 'event-2', kind: 'DOMAIN_EVENT', eventType: 'hazard_identified',
          decisionSequence: 1, engineEventSequence: 1, logicalTick: 1,
          idempotencyKey: 'event-2', causationId: 'intent-1', correlationId: 'attempt-1', payload: {},
        },
      ],
    }));

    expect(order).toEqual(['cas', 'events']);
    expect(tx.eduLabEvent.createMany.mock.calls[0][0].data.map((event: any) => event.streamSequence))
      .toEqual([1n, 2n]);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('rejects a stale optimistic version before writing events', async () => {
    const { repository, tx } = makeRepository();
    tx.eduLabAttempt.updateMany.mockResolvedValue({ count: 0 });

    await expect(inContext(tx, () => repository.appendDecision({
      institutionId: identity.institutionId,
      userId: identity.userId,
      attemptId: 'attempt-1',
      expectedVersion: 0,
      expectedStreamSequence: 0n,
      stateHash: identity.stateHash,
      logicalTick: 1,
      decisionSequence: 1,
      engineEventSequence: 0,
      status: 'ACTIVE',
      events: [{
        id: 'event-1', kind: 'INTENT_ACCEPTED', eventType: 'intent.accepted',
        intentId: 'intent-1', decisionSequence: 1, logicalTick: 1,
        idempotencyKey: 'intent-1', correlationId: 'attempt-1', payload: { primitive: 'inspect' },
      }],
    }))).rejects.toBeInstanceOf(EduLabPersistenceConflict);
    expect(tx.eduLabEvent.createMany).not.toHaveBeenCalled();
  });
});
