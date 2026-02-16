import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { createHash } from 'crypto';
import { ElectionAuditAction } from '@prisma/client';

export interface AuditLogInput {
  processId: string;
  electionId?: string;
  action: ElectionAuditAction;
  actorId?: string;
  actorType: 'USER' | 'STUDENT' | 'SYSTEM';
  actorIp?: string;
  payload?: Record<string, any>;
  previousState?: Record<string, any>;
  newState?: Record<string, any>;
}

@Injectable()
export class ElectionAuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Genera un checksum SHA-256 del contenido del log
   * Incluye el checksum anterior para crear una cadena criptográfica fuerte (blockchain-style)
   */
  private generateChecksum(
    data: Omit<AuditLogInput, 'processId'> & { previousChecksum?: string; timestamp: Date },
  ): string {
    const content = JSON.stringify({
      action: data.action,
      actorId: data.actorId,
      actorType: data.actorType,
      payload: data.payload,
      previousState: data.previousState,
      newState: data.newState,
      previousChecksum: data.previousChecksum,
      timestamp: data.timestamp.toISOString(),
    });
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Registra una acción en el audit log inmutable
   * Cada entrada incluye el checksum del log anterior para formar una cadena criptográfica
   */
  async log(input: AuditLogInput, tx?: any): Promise<void> {
    const prismaClient = tx || this.prisma;
    const timestamp = new Date();

    // Obtener el último log del proceso para encadenar (incluye checksum)
    const lastLog = await prismaClient.electionAuditLog.findFirst({
      where: { processId: input.processId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, checksum: true },
    });

    const checksum = this.generateChecksum({
      ...input,
      previousChecksum: lastLog?.checksum,
      timestamp,
    });

    await prismaClient.electionAuditLog.create({
      data: {
        processId: input.processId,
        electionId: input.electionId,
        action: input.action,
        actorId: input.actorId,
        actorType: input.actorType,
        actorIp: input.actorIp,
        payload: input.payload,
        previousState: input.previousState,
        newState: input.newState,
        checksum,
        previousLogId: lastLog?.id,
        createdAt: timestamp,
      },
    });
  }

  /**
   * Registra un voto emitido (sin revelar por quién votó)
   */
  async logVote(
    processId: string,
    electionId: string,
    voterId: string,
    actorIp?: string,
    tx?: any,
  ): Promise<void> {
    await this.log(
      {
        processId,
        electionId,
        action: 'VOTE_CAST',
        actorId: voterId,
        actorType: 'STUDENT',
        actorIp,
        payload: {
          electionId,
          votedAt: new Date().toISOString(),
        },
      },
      tx,
    );
  }

  /**
   * Registra un intento de voto duplicado
   */
  async logDuplicateVoteAttempt(
    processId: string,
    electionId: string,
    voterId: string,
    actorIp?: string,
    tx?: any,
  ): Promise<void> {
    await this.log(
      {
        processId,
        electionId,
        action: 'VOTE_ATTEMPTED_DUPLICATE',
        actorId: voterId,
        actorType: 'STUDENT',
        actorIp,
        payload: {
          electionId,
          attemptedAt: new Date().toISOString(),
        },
      },
      tx,
    );
  }

  /**
   * Registra un intento de voto inválido
   */
  async logInvalidVoteAttempt(
    processId: string,
    electionId: string,
    voterId: string,
    reason: string,
    actorIp?: string,
    tx?: any,
  ): Promise<void> {
    await this.log(
      {
        processId,
        electionId,
        action: 'VOTE_ATTEMPTED_INVALID',
        actorId: voterId,
        actorType: 'STUDENT',
        actorIp,
        payload: {
          electionId,
          reason,
          attemptedAt: new Date().toISOString(),
        },
      },
      tx,
    );
  }

  /**
   * Registra cambio de estado del proceso
   */
  async logStatusChange(
    processId: string,
    previousStatus: string,
    newStatus: string,
    userId: string,
    actorIp?: string,
    tx?: any,
  ): Promise<void> {
    await this.log(
      {
        processId,
        action: 'PROCESS_STATUS_CHANGED',
        actorId: userId,
        actorType: 'USER',
        actorIp,
        previousState: { status: previousStatus },
        newState: { status: newStatus },
      },
      tx,
    );
  }

  /**
   * Registra bloqueo del proceso
   */
  async logProcessLocked(
    processId: string,
    userId: string,
    actorIp?: string,
    tx?: any,
  ): Promise<void> {
    await this.log(
      {
        processId,
        action: 'PROCESS_LOCKED',
        actorId: userId,
        actorType: 'USER',
        actorIp,
        payload: {
          lockedAt: new Date().toISOString(),
        },
      },
      tx,
    );
  }

  /**
   * Registra cierre del proceso con snapshot
   */
  async logProcessClosed(
    processId: string,
    userId: string,
    finalHash: string,
    actorIp?: string,
    tx?: any,
  ): Promise<void> {
    await this.log(
      {
        processId,
        action: 'PROCESS_CLOSED',
        actorId: userId,
        actorType: 'USER',
        actorIp,
        payload: {
          closedAt: new Date().toISOString(),
          finalHash,
        },
      },
      tx,
    );
  }

  /**
   * Registra cálculo de resultados
   */
  async logResultsCalculated(
    processId: string,
    electionId: string,
    resultsSummary: Record<string, any>,
    tx?: any,
  ): Promise<void> {
    await this.log(
      {
        processId,
        electionId,
        action: 'RESULTS_CALCULATED',
        actorType: 'SYSTEM',
        payload: {
          calculatedAt: new Date().toISOString(),
          summary: resultsSummary,
        },
      },
      tx,
    );
  }

  /**
   * Registra creación de snapshot final
   */
  async logSnapshotCreated(
    processId: string,
    snapshotHash: string,
    tx?: any,
  ): Promise<void> {
    await this.log(
      {
        processId,
        action: 'RESULTS_SNAPSHOT_CREATED',
        actorType: 'SYSTEM',
        payload: {
          createdAt: new Date().toISOString(),
          snapshotHash,
        },
      },
      tx,
    );
  }

  /**
   * Registra aprobación de candidato
   */
  async logCandidateApproved(
    processId: string,
    electionId: string,
    candidateId: string,
    userId: string,
    actorIp?: string,
    tx?: any,
  ): Promise<void> {
    await this.log(
      {
        processId,
        electionId,
        action: 'CANDIDATE_APPROVED',
        actorId: userId,
        actorType: 'USER',
        actorIp,
        payload: {
          candidateId,
          approvedAt: new Date().toISOString(),
        },
      },
      tx,
    );
  }

  /**
   * Registra rechazo de candidato
   */
  async logCandidateRejected(
    processId: string,
    electionId: string,
    candidateId: string,
    userId: string,
    reason: string,
    actorIp?: string,
    tx?: any,
  ): Promise<void> {
    await this.log(
      {
        processId,
        electionId,
        action: 'CANDIDATE_REJECTED',
        actorId: userId,
        actorType: 'USER',
        actorIp,
        payload: {
          candidateId,
          reason,
          rejectedAt: new Date().toISOString(),
        },
      },
      tx,
    );
  }

  /**
   * Verifica la integridad de la cadena de audit logs
   * Recalcula cada checksum usando el checksum anterior (cadena criptográfica)
   */
  async verifyChainIntegrity(processId: string): Promise<{
    isValid: boolean;
    totalLogs: number;
    invalidLogs: string[];
  }> {
    const logs = await this.prisma.electionAuditLog.findMany({
      where: { processId },
      orderBy: { createdAt: 'asc' },
    });

    const invalidLogs: string[] = [];

    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      const expectedPreviousLogId = i > 0 ? logs[i - 1].id : null;
      const expectedPreviousChecksum = i > 0 ? logs[i - 1].checksum : undefined;

      // Verificar que el previousLogId sea correcto
      if (log.previousLogId !== expectedPreviousLogId) {
        invalidLogs.push(log.id);
        continue;
      }

      // Recalcular checksum usando el checksum anterior (cadena criptográfica)
      const recalculatedChecksum = this.generateChecksum({
        action: log.action,
        actorId: log.actorId ?? undefined,
        actorType: log.actorType as 'USER' | 'STUDENT' | 'SYSTEM',
        payload: log.payload as Record<string, any> | undefined,
        previousState: log.previousState as Record<string, any> | undefined,
        newState: log.newState as Record<string, any> | undefined,
        previousChecksum: expectedPreviousChecksum,
        timestamp: log.createdAt,
      });

      if (log.checksum !== recalculatedChecksum) {
        invalidLogs.push(log.id);
      }
    }

    return {
      isValid: invalidLogs.length === 0,
      totalLogs: logs.length,
      invalidLogs,
    };
  }

  /**
   * Obtiene el historial de auditoría de un proceso
   */
  async getAuditHistory(
    processId: string,
    options?: {
      action?: ElectionAuditAction;
      electionId?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    return this.prisma.electionAuditLog.findMany({
      where: {
        processId,
        ...(options?.action && { action: options.action }),
        ...(options?.electionId && { electionId: options.electionId }),
      },
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 100,
      skip: options?.offset || 0,
    });
  }
}
