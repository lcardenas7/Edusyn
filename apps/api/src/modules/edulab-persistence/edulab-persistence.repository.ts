import { createHash } from 'crypto';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { tenantContext } from '../../prisma/tenant-context';

export class EduLabPersistenceConflict extends Error {
  constructor(public readonly code: 'IDEMPOTENCY_CONFLICT' | 'VERSION_CONFLICT') {
    super(code);
  }
}

export interface CreateEduLabAttemptInput {
  institutionId: string;
  userId: string;
  clientAttemptId: string;
  experienceId: string;
  definitionId: string;
  definitionVersion: number;
  contentHash: string;
  runtimeDefinitionHash: string;
  engineVersion: string;
  mode: 'EXPLORE' | 'GUIDED_PRACTICE';
  seed: string;
  stateHash: string;
}

export interface PersistableEduLabEvent {
  id: string;
  kind: 'INTENT_ACCEPTED' | 'DOMAIN_EVENT' | 'CHECKPOINT' | 'ATTEMPT_FINISHED';
  eventType: string;
  intentId?: string;
  decisionSequence: number;
  engineEventSequence?: number;
  logicalTick: number;
  idempotencyKey: string;
  causationId?: string;
  correlationId: string;
  payload: Record<string, unknown>;
}

export interface AppendEduLabDecisionInput {
  institutionId: string;
  userId: string;
  attemptId: string;
  expectedVersion: number;
  expectedStreamSequence: bigint;
  stateHash: string;
  logicalTick: number;
  decisionSequence: number;
  engineEventSequence: number;
  status: 'ACTIVE' | 'COMPLETED' | 'ABANDONED';
  endingId?: string;
  checkpointId?: string;
  events: PersistableEduLabEvent[];
}

const MAX_PAYLOAD_BYTES = 16 * 1024;
const MAX_PAYLOAD_DEPTH = 12;
const MAX_PAYLOAD_KEYS = 128;

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) throw new TypeError('EduLab payload numbers must be safe integers.');
    return String(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value !== 'object') throw new TypeError('EduLab payload contains a non-JSON value.');
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
    .join(',')}}`;
}

function validatePayload(value: unknown, depth = 0): void {
  if (depth > MAX_PAYLOAD_DEPTH) throw new TypeError('EduLab payload is too deep.');
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'string') {
    if (value.length > 4096) throw new TypeError('EduLab payload string is too long.');
    return;
  }
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) throw new TypeError('EduLab payload numbers must be safe integers.');
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > MAX_PAYLOAD_KEYS) throw new TypeError('EduLab payload array is too large.');
    value.forEach((item) => validatePayload(item, depth + 1));
    return;
  }
  if (typeof value !== 'object') throw new TypeError('EduLab payload contains a non-JSON value.');
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > MAX_PAYLOAD_KEYS) throw new TypeError('EduLab payload has too many keys.');
  entries.forEach(([, item]) => validatePayload(item, depth + 1));
}

export function hashEduLabPayload(payload: Record<string, unknown>): string {
  validatePayload(payload);
  const canonical = canonicalJson(payload);
  if (Buffer.byteLength(canonical, 'utf8') > MAX_PAYLOAD_BYTES) {
    throw new TypeError('EduLab payload exceeds the byte limit.');
  }
  return `sha256:${createHash('sha256').update(canonical, 'utf8').digest('hex')}`;
}

function assertContext(institutionId: string, userId: string): void {
  const context = tenantContext.getStore();
  if (!context?.tx || context.institutionId !== institutionId || context.userId !== userId) {
    throw new ForbiddenException('EduLab persistence requires matching tenant and user context.');
  }
}

function sameAttemptIdentity(existing: any, input: CreateEduLabAttemptInput): boolean {
  return existing.experienceId === input.experienceId
    && existing.definitionId === input.definitionId
    && existing.definitionVersion === input.definitionVersion
    && existing.contentHash === input.contentHash
    && existing.runtimeDefinitionHash === input.runtimeDefinitionHash
    && existing.engineVersion === input.engineVersion
    && existing.mode === input.mode
    && existing.seed === input.seed;
}

@Injectable()
export class EduLabPersistenceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createAttempt(input: CreateEduLabAttemptInput): Promise<any> {
    assertContext(input.institutionId, input.userId);
    const where = {
      institutionId_userId_clientAttemptId: {
        institutionId: input.institutionId,
        userId: input.userId,
        clientAttemptId: input.clientAttemptId,
      },
    };
    const existing = await (this.prisma as any).eduLabAttempt.findUnique({ where });
    if (existing) {
      if (!sameAttemptIdentity(existing, input)) {
        throw new EduLabPersistenceConflict('IDEMPOTENCY_CONFLICT');
      }
      return existing;
    }

    await (this.prisma as any).eduLabAttempt.createMany({
      data: [input],
      skipDuplicates: true,
    });
    const persisted = await (this.prisma as any).eduLabAttempt.findUnique({ where });
    if (!persisted || !sameAttemptIdentity(persisted, input)) {
      throw new EduLabPersistenceConflict('IDEMPOTENCY_CONFLICT');
    }
    return persisted;
  }

  async appendDecision(input: AppendEduLabDecisionInput): Promise<any> {
    assertContext(input.institutionId, input.userId);
    if (input.events.length === 0 || input.events[0]?.kind !== 'INTENT_ACCEPTED') {
      throw new TypeError('An accepted decision must start with INTENT_ACCEPTED.');
    }

    const prepared = input.events.map((event, index) => ({
      ...event,
      institutionId: input.institutionId,
      attemptId: input.attemptId,
      streamSequence: input.expectedStreamSequence + BigInt(index + 1),
      payloadHash: hashEduLabPayload(event.payload),
    }));
    const accepted = prepared[0]!;
    const finalStreamSequence = input.expectedStreamSequence + BigInt(prepared.length);

    return this.prisma.$transaction(async (tx: any) => {
      const duplicate = await tx.eduLabEvent.findUnique({
        where: {
          attemptId_idempotencyKey: {
            attemptId: input.attemptId,
            idempotencyKey: accepted.idempotencyKey,
          },
        },
      });
      if (duplicate) {
        if (duplicate.payloadHash !== accepted.payloadHash) {
          throw new EduLabPersistenceConflict('IDEMPOTENCY_CONFLICT');
        }
        return tx.eduLabAttempt.findUniqueOrThrow({ where: { id: input.attemptId } });
      }

      const updated = await tx.eduLabAttempt.updateMany({
        where: {
          id: input.attemptId,
          institutionId: input.institutionId,
          userId: input.userId,
          status: 'ACTIVE',
          concurrencyVersion: input.expectedVersion,
          streamSequence: input.expectedStreamSequence,
        },
        data: {
          stateHash: input.stateHash,
          logicalTick: input.logicalTick,
          decisionSequence: input.decisionSequence,
          engineEventSequence: input.engineEventSequence,
          streamSequence: finalStreamSequence,
          concurrencyVersion: { increment: 1 },
          status: input.status,
          endingId: input.endingId ?? null,
          checkpointId: input.checkpointId ?? null,
          completedAt: input.status === 'COMPLETED' ? new Date() : null,
        },
      });
      if (updated.count !== 1) throw new EduLabPersistenceConflict('VERSION_CONFLICT');

      await tx.eduLabEvent.createMany({ data: prepared });
      return tx.eduLabAttempt.findUniqueOrThrow({ where: { id: input.attemptId } });
    });
  }
}
