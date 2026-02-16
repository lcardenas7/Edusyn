import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ElectionAuditService } from './election-audit.service';
import { createHash } from 'crypto';

@Injectable()
export class ElectionsService {
  constructor(
    private prisma: PrismaService,
    private auditService: ElectionAuditService,
  ) {}

  /**
   * Genera un hash SHA-256 de un objeto para verificación de integridad
   */
  private generateHash(data: any): string {
    return createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PROCESOS ELECTORALES
  // ═══════════════════════════════════════════════════════════════════════════

  async createProcess(data: {
    institutionId: string;
    academicYearId: string;
    name: string;
    description?: string;
    registrationStart?: Date | null;
    registrationEnd?: Date | null;
    campaignStart?: Date | null;
    campaignEnd?: Date | null;
    votingStart?: Date | null;
    votingEnd?: Date | null;
    enablePersonero?: boolean;
    enableContralor?: boolean;
    enableRepresentanteGrado?: boolean;
    enableRepresentanteCurso?: boolean;
    allowBlankVote?: boolean;
    createdById: string;
  }) {
    // Crear proceso electoral (se permiten múltiples procesos por año)
    const process = await this.prisma.electionProcess.create({
      data: {
        institution: { connect: { id: data.institutionId } },
        academicYear: { connect: { id: data.academicYearId } },
        createdBy: { connect: { id: data.createdById } },
        name: data.name,
        description: data.description,
        registrationStart: data.registrationStart || undefined,
        registrationEnd: data.registrationEnd || undefined,
        campaignStart: data.campaignStart || undefined,
        campaignEnd: data.campaignEnd || undefined,
        votingStart: data.votingStart || undefined,
        votingEnd: data.votingEnd || undefined,
        enablePersonero: data.enablePersonero ?? true,
        enableContralor: data.enableContralor ?? true,
        enableRepresentanteGrado: data.enableRepresentanteGrado ?? true,
        enableRepresentanteCurso: data.enableRepresentanteCurso ?? true,
        allowBlankVote: data.allowBlankVote ?? true,
      },
    });

    // Crear elecciones automáticamente según configuración
    await this.createElectionsForProcess(process.id, data.institutionId);

    return this.getProcessById(process.id);
  }

  private async createElectionsForProcess(processId: string, institutionId: string) {
    const process = await this.prisma.electionProcess.findUnique({
      where: { id: processId },
    });

    if (!process) return;

    const electionsToCreate: any[] = [];

    // Personero (toda la institución)
    if (process.enablePersonero) {
      electionsToCreate.push({
        electionProcessId: processId,
        type: 'PERSONERO',
      });
    }

    // Contralor (toda la institución)
    if (process.enableContralor) {
      electionsToCreate.push({
        electionProcessId: processId,
        type: 'CONTRALOR',
      });
    }

    // Representantes de grado
    if (process.enableRepresentanteGrado) {
      const grades = await this.prisma.grade.findMany();
      for (const grade of grades) {
        electionsToCreate.push({
          electionProcessId: processId,
          type: 'REPRESENTANTE_GRADO',
          gradeId: grade.id,
        });
      }
    }

    // Representantes de curso
    if (process.enableRepresentanteCurso) {
      const groups = await this.prisma.group.findMany({
        where: {
          campus: { institutionId },
        },
      });
      for (const group of groups) {
        electionsToCreate.push({
          electionProcessId: processId,
          type: 'REPRESENTANTE_CURSO',
          groupId: group.id,
        });
      }
    }

    // Crear todas las elecciones
    await this.prisma.election.createMany({
      data: electionsToCreate,
    });
  }

  async getProcessById(id: string) {
    return this.prisma.electionProcess.findUnique({
      where: { id },
      include: {
        institution: true,
        academicYear: true,
        createdBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        elections: {
          include: {
            grade: true,
            group: { include: { grade: true } },
            candidates: {
              include: {
                student: true,
              },
            },
            _count: {
              select: { votes: true },
            },
          },
        },
      },
    });
  }

  async getProcessByInstitution(institutionId: string) {
    return this.prisma.electionProcess.findMany({
      where: { institutionId },
      include: {
        academicYear: true,
        _count: {
          select: { elections: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getCurrentProcess(institutionId: string) {
    return this.prisma.electionProcess.findFirst({
      where: {
        institutionId,
        status: { in: ['DRAFT', 'REGISTRATION', 'CAMPAIGN', 'VOTING'] },
      },
      include: {
        academicYear: true,
        elections: {
          include: {
            grade: true,
            group: { include: { grade: true } },
            candidates: {
              where: { status: 'APPROVED' },
              include: { student: true },
            },
          },
        },
      },
    });
  }

  /**
   * Eliminar un proceso electoral que NO esté en VOTING o CLOSED
   * Solo se pueden eliminar procesos en DRAFT, REGISTRATION, CAMPAIGN o CANCELLED
   */
  async deleteProcess(processId: string, institutionId: string) {
    const process = await this.prisma.electionProcess.findUnique({
      where: { id: processId },
    });

    if (!process) {
      throw new NotFoundException('Proceso electoral no encontrado');
    }

    if (process.institutionId !== institutionId) {
      throw new BadRequestException('No tiene permisos para eliminar este proceso electoral');
    }

    // No permitir eliminar procesos en VOTING o CLOSED
    const nonDeletableStatuses = ['VOTING', 'CLOSED'];
    if (nonDeletableStatuses.includes(process.status)) {
      throw new BadRequestException(
        `No se puede eliminar un proceso en estado ${process.status}. Solo se pueden eliminar procesos en DRAFT, REGISTRATION, CAMPAIGN o CANCELLED.`,
      );
    }

    // Eliminar en cascada (elections, candidates, votes, audit logs)
    return this.prisma.electionProcess.delete({
      where: { id: processId },
    });
  }

  async updateProcessStatus(processId: string, status: string, institutionId: string) {
    const validStatuses = ['DRAFT', 'REGISTRATION', 'CAMPAIGN', 'VOTING', 'CLOSED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      throw new BadRequestException(`Estado inválido: ${status}`);
    }

    if (status === 'CLOSED') {
      throw new BadRequestException(
        'No se puede cambiar a CLOSED directamente. Use el endpoint de cierre de proceso que calcula resultados.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const process = await tx.electionProcess.findUnique({
        where: { id: processId },
        include: {
          elections: {
            include: {
              candidates: { where: { status: 'APPROVED' } },
            },
          },
        },
      });

      if (!process) {
        throw new NotFoundException('Proceso electoral no encontrado');
      }

      // Validar que el proceso pertenece a la institución del usuario
      if (process.institutionId !== institutionId) {
        throw new BadRequestException('No tiene permisos para modificar este proceso electoral');
      }

      // Validar soft-lock: si el proceso está bloqueado, no permitir cambios
      if (process.isLocked) {
        throw new BadRequestException(
          'El proceso electoral está bloqueado y no puede ser modificado. Contacte al administrador.',
        );
      }

      const allowedTransitions: Record<string, string> = {
        DRAFT: 'REGISTRATION',
        REGISTRATION: 'CAMPAIGN',
        CAMPAIGN: 'VOTING',
      };

      const expectedNext = allowedTransitions[process.status];

      if (!expectedNext) {
        throw new BadRequestException(
          `No se puede cambiar el estado desde ${process.status}. El proceso ya está cerrado o cancelado.`,
        );
      }

      if (status !== expectedNext) {
        throw new BadRequestException(
          `Transición inválida: ${process.status} → ${status}. La siguiente fase permitida es ${expectedNext}.`,
        );
      }

      // Validaciones de datos mínimos según transición
      if (process.status === 'DRAFT' && status === 'REGISTRATION') {
        if (process.elections.length === 0) {
          throw new BadRequestException(
            'No se puede iniciar inscripción: el proceso no tiene elecciones creadas.',
          );
        }
      }

      if (process.status === 'REGISTRATION' && status === 'CAMPAIGN') {
        const electionsWithoutCandidates = process.elections.filter(
          (e) => e.candidates.length === 0,
        );
        if (electionsWithoutCandidates.length > 0) {
          throw new BadRequestException(
            `No se puede iniciar campaña: ${electionsWithoutCandidates.length} elección(es) no tienen candidatos aprobados.`,
          );
        }
      }

      if (process.status === 'CAMPAIGN' && status === 'VOTING') {
        const minCandidates = process.allowBlankVote ? 1 : 2;
        const electionsInsufficient = process.elections.filter(
          (e) => e.candidates.length < minCandidates,
        );
        if (electionsInsufficient.length > 0) {
          throw new BadRequestException(
            `No se puede iniciar votación: ${electionsInsufficient.length} elección(es) tienen menos de ${minCandidates} candidato(s) aprobado(s)${process.allowBlankVote ? ' (mínimo 1 con voto en blanco habilitado)' : ''}.`,
          );
        }

        // Validar fecha de votación (si está configurada)
        const now = new Date();
        if (process.votingStart && now < process.votingStart) {
          throw new BadRequestException(
            `No se puede iniciar votación antes de la fecha configurada: ${process.votingStart.toLocaleDateString()}.`,
          );
        }
      }

      // Audit: cambio de estado
      await this.auditService.logStatusChange(
        processId,
        process.status,
        status,
        'SYSTEM', // userId se pasa desde el controller si está disponible
        undefined,
        tx,
      );

      return tx.electionProcess.update({
        where: { id: processId },
        data: { status: status as any },
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CANDIDATOS
  // ═══════════════════════════════════════════════════════════════════════════

  async registerCandidate(data: {
    electionId: string;
    studentId: string;
    slogan?: string;
    proposals?: string;
    photo?: string;
    color?: string;
    ballotNumber?: number;
  }) {
    // Verificar que la elección existe y está en período de inscripción
    const election = await this.prisma.election.findUnique({
      where: { id: data.electionId },
      include: { electionProcess: true },
    });

    if (!election) {
      throw new NotFoundException('Elección no encontrada');
    }

    if (election.electionProcess.status !== 'REGISTRATION') {
      throw new BadRequestException('El período de inscripción no está activo');
    }

    // Verificar que el estudiante no esté ya inscrito
    const existing = await this.prisma.candidate.findUnique({
      where: {
        electionId_studentId: {
          electionId: data.electionId,
          studentId: data.studentId,
        },
      },
    });

    if (existing) {
      throw new BadRequestException('El estudiante ya está inscrito en esta elección');
    }

    return this.prisma.candidate.create({
      data: {
        electionId: data.electionId,
        studentId: data.studentId,
        slogan: data.slogan,
        proposals: data.proposals,
        photo: data.photo,
        color: data.color,
        ballotNumber: data.ballotNumber,
      },
      include: {
        student: true,
        election: {
          include: { grade: true, group: true },
        },
      },
    });
  }

  async approveCandidate(candidateId: string, approvedById: string) {
    // Validar fase del proceso
    const candidate = await this.prisma.candidate.findUnique({
      where: { id: candidateId },
      include: { election: { include: { electionProcess: true } } },
    });

    if (!candidate) {
      throw new NotFoundException('Candidato no encontrado');
    }

    const allowedStatuses = ['REGISTRATION', 'CAMPAIGN'];
    if (!allowedStatuses.includes(candidate.election.electionProcess.status)) {
      throw new BadRequestException(
        `No se pueden aprobar candidatos en la fase ${candidate.election.electionProcess.status}. Solo permitido en REGISTRATION o CAMPAIGN.`,
      );
    }

    // Validar soft-lock
    if (candidate.election.electionProcess.isLocked) {
      throw new BadRequestException('El proceso electoral está bloqueado y no permite modificaciones.');
    }

    const updated = await this.prisma.candidate.update({
      where: { id: candidateId },
      data: {
        status: 'APPROVED',
        approvedById,
        approvedAt: new Date(),
      },
    });

    // Audit: candidato aprobado
    await this.auditService.logCandidateApproved(
      candidate.election.electionProcess.id,
      candidate.electionId,
      candidateId,
      approvedById,
    );

    return updated;
  }

  async rejectCandidate(candidateId: string, approvedById: string, reason: string) {
    // Validar fase del proceso
    const candidate = await this.prisma.candidate.findUnique({
      where: { id: candidateId },
      include: { election: { include: { electionProcess: true } } },
    });

    if (!candidate) {
      throw new NotFoundException('Candidato no encontrado');
    }

    const allowedStatuses = ['REGISTRATION', 'CAMPAIGN'];
    if (!allowedStatuses.includes(candidate.election.electionProcess.status)) {
      throw new BadRequestException(
        `No se pueden rechazar candidatos en la fase ${candidate.election.electionProcess.status}. Solo permitido en REGISTRATION o CAMPAIGN.`,
      );
    }

    // Validar soft-lock
    if (candidate.election.electionProcess.isLocked) {
      throw new BadRequestException('El proceso electoral está bloqueado y no permite modificaciones.');
    }

    const updated = await this.prisma.candidate.update({
      where: { id: candidateId },
      data: {
        status: 'REJECTED',
        approvedById,
        approvedAt: new Date(),
        rejectionReason: reason,
      },
    });

    // Audit: candidato rechazado
    await this.auditService.logCandidateRejected(
      candidate.election.electionProcess.id,
      candidate.electionId,
      candidateId,
      approvedById,
      reason,
    );

    return updated;
  }

  async getCandidatesByElection(electionId: string) {
    return this.prisma.candidate.findMany({
      where: { electionId },
      include: {
        student: true,
        approvedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: [{ ballotNumber: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async updateCandidate(candidateId: string, data: {
    slogan?: string;
    proposals?: string;
    photo?: string;
    color?: string;
    ballotNumber?: number;
  }) {
    // Validar fase del proceso
    const candidate = await this.prisma.candidate.findUnique({
      where: { id: candidateId },
      include: { election: { include: { electionProcess: true } } },
    });

    if (!candidate) {
      throw new NotFoundException('Candidato no encontrado');
    }

    const allowedStatuses = ['REGISTRATION', 'CAMPAIGN'];
    if (!allowedStatuses.includes(candidate.election.electionProcess.status)) {
      throw new BadRequestException(
        `No se pueden modificar candidatos en la fase ${candidate.election.electionProcess.status}. Solo permitido en REGISTRATION o CAMPAIGN.`,
      );
    }

    // Validar soft-lock
    if (candidate.election.electionProcess.isLocked) {
      throw new BadRequestException('El proceso electoral está bloqueado y no permite modificaciones.');
    }

    return this.prisma.candidate.update({
      where: { id: candidateId },
      data,
      include: {
        student: true,
        election: {
          include: { grade: true, group: true },
        },
      },
    });
  }

  async deleteCandidate(candidateId: string) {
    const candidate = await this.prisma.candidate.findUnique({
      where: { id: candidateId },
      include: { election: { include: { electionProcess: true } } },
    });

    if (!candidate) {
      throw new NotFoundException('Candidato no encontrado');
    }

    if (candidate.election.electionProcess.status !== 'REGISTRATION' && 
        candidate.election.electionProcess.status !== 'DRAFT') {
      throw new BadRequestException('Solo se pueden eliminar candidatos durante el período de inscripción');
    }

    return this.prisma.candidate.delete({
      where: { id: candidateId },
    });
  }

  async getEligibleStudentsForElection(electionId: string) {
    const election = await this.prisma.election.findUnique({
      where: { id: electionId },
      include: {
        electionProcess: true,
        grade: true,
        group: { include: { grade: true } },
        candidates: { select: { studentId: true } },
      },
    });

    if (!election) {
      throw new NotFoundException('Elección no encontrada');
    }

    // Obtener IDs de estudiantes ya inscritos
    const enrolledStudentIds = election.candidates.map(c => c.studentId);

    // Filtrar estudiantes según el tipo de elección
    let whereClause: any = {
      enrollments: {
        some: {
          status: 'ACTIVE',
          academicYearId: election.electionProcess.academicYearId,
        },
      },
    };

    // Para representante de curso, solo estudiantes del grupo
    if (election.type === 'REPRESENTANTE_CURSO' && election.groupId) {
      whereClause.enrollments.some.groupId = election.groupId;
    }

    // Para representante de grado, solo estudiantes del grado
    if (election.type === 'REPRESENTANTE_GRADO' && election.gradeId) {
      whereClause.enrollments.some.group = { gradeId: election.gradeId };
    }

    // Excluir estudiantes ya inscritos
    if (enrolledStudentIds.length > 0) {
      whereClause.id = { notIn: enrolledStudentIds };
    }

    return this.prisma.student.findMany({
      where: whereClause,
      include: {
        enrollments: {
          where: { status: 'ACTIVE' },
          include: {
            group: { include: { grade: true } },
          },
          take: 1,
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VOTACIÓN
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Obtiene las elecciones pendientes de votar para un estudiante
   * Retorna las elecciones donde puede votar y aún no ha votado
   */
  async getPendingElectionsForStudent(studentId: string, institutionId: string) {
    // Obtener el estudiante con su grupo actual
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        enrollments: {
          where: { status: 'ACTIVE' },
          include: {
            group: { include: { grade: true } },
          },
          take: 1,
        },
      },
    });

    if (!student || student.enrollments.length === 0) {
      return [];
    }

    const enrollment = student.enrollments[0];
    const groupId = enrollment.groupId;
    const gradeId = enrollment.group.gradeId;

    // Obtener proceso electoral activo en votación
    const process = await this.prisma.electionProcess.findFirst({
      where: {
        institutionId,
        status: 'VOTING',
      },
    });

    if (!process) {
      return [];
    }

    // Obtener elecciones donde puede votar
    const elections = await this.prisma.election.findMany({
      where: {
        electionProcessId: process.id,
        status: 'ACTIVE',
        OR: [
          { type: 'PERSONERO' },
          { type: 'CONTRALOR' },
          { type: 'REPRESENTANTE_GRADO', gradeId },
          { type: 'REPRESENTANTE_CURSO', groupId },
        ],
      },
      include: {
        grade: true,
        group: { include: { grade: true } },
        candidates: {
          where: { status: 'APPROVED' },
          include: { student: true },
        },
      },
    });

    // Filtrar las que ya votó
    const votedElectionIds = await this.prisma.vote.findMany({
      where: {
        voterId: studentId,
        electionId: { in: elections.map(e => e.id) },
      },
      select: { electionId: true },
    });

    const votedIds = new Set(votedElectionIds.map(v => v.electionId));

    return elections.filter(e => !votedIds.has(e.id));
  }

  /**
   * Emitir voto
   */
  async vote(data: {
    electionId: string;
    voterId: string;
    candidateId?: string; // null = voto en blanco
  }) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // 1. Verificar que la elección existe
        const election = await tx.election.findUnique({
          where: { id: data.electionId },
          include: {
            electionProcess: true,
            grade: true,
            group: true,
          },
        });

        if (!election) {
          throw new NotFoundException('Elección no encontrada');
        }

        // 2. Verificar que el proceso existe (implícito por relación)
        const process = election.electionProcess;

        // 3. Verificar que el proceso está en VOTING
        if (process.status !== 'VOTING') {
          throw new BadRequestException('La votación no está activa');
        }

        // 4. Obtener datos del votante con enrollment activo
        const voter = await tx.student.findUnique({
          where: { id: data.voterId },
          include: {
            enrollments: {
              where: { status: 'ACTIVE' },
              include: {
                group: {
                  include: {
                    grade: true,
                    campus: true,
                  },
                },
              },
              take: 1,
            },
          },
        });

        if (!voter) {
          throw new BadRequestException('Votante no encontrado');
        }

        // 5. Verificar que el votante tiene enrollment activo
        if (voter.enrollments.length === 0) {
          throw new BadRequestException('El votante no tiene matrícula activa');
        }

        const enrollment = voter.enrollments[0];

        // 6. Verificar que el votante pertenece a la misma institución
        if (enrollment.group.campus.institutionId !== process.institutionId) {
          throw new BadRequestException('El votante no pertenece a esta institución');
        }

        // 7. Verificar elegibilidad por tipo de elección
        if (election.type === 'REPRESENTANTE_GRADO' && election.gradeId) {
          if (enrollment.group.gradeId !== election.gradeId) {
            throw new BadRequestException('El votante no pertenece al grado de esta elección');
          }
        }

        if (election.type === 'REPRESENTANTE_CURSO' && election.groupId) {
          if (enrollment.groupId !== election.groupId) {
            throw new BadRequestException('El votante no pertenece al curso de esta elección');
          }
        }

        // 8. Verificar que no haya votado ya
        const existingVote = await tx.vote.findUnique({
          where: {
            electionId_voterId: {
              electionId: data.electionId,
              voterId: data.voterId,
            },
          },
        });

        if (existingVote) {
          // Audit: intento de voto duplicado
          await this.auditService.logDuplicateVoteAttempt(
            process.id,
            data.electionId,
            data.voterId,
            undefined,
            tx,
          );
          throw new BadRequestException('El estudiante ya votó en esta elección');
        }

        // 9. Verificar candidato si no es voto en blanco
        if (data.candidateId) {
          const candidate = await tx.candidate.findFirst({
            where: {
              id: data.candidateId,
              electionId: data.electionId,
              status: 'APPROVED',
            },
          });

          if (!candidate) {
            // Audit: intento de voto inválido
            await this.auditService.logInvalidVoteAttempt(
              process.id,
              data.electionId,
              data.voterId,
              'Candidato no válido',
              undefined,
              tx,
            );
            throw new BadRequestException('Candidato no válido para esta elección');
          }
        } else if (!process.allowBlankVote) {
          // 10. Verificar allowBlankVote
          await this.auditService.logInvalidVoteAttempt(
            process.id,
            data.electionId,
            data.voterId,
            'Voto en blanco no permitido',
            undefined,
            tx,
          );
          throw new BadRequestException('El voto en blanco no está permitido');
        }

        // 11. Registrar voto
        const vote = await tx.vote.create({
          data: {
            electionId: data.electionId,
            voterId: data.voterId,
            candidateId: data.candidateId,
          },
        });

        // 12. Audit: voto registrado exitosamente
        await this.auditService.logVote(
          process.id,
          data.electionId,
          data.voterId,
          undefined,
          tx,
        );

        return vote;
      });
    } catch (error: any) {
      // Capturar error de unique constraint y convertir a BadRequestException
      if (error.code === 'P2002' && error.meta?.target?.includes('voterId')) {
        throw new BadRequestException('El estudiante ya votó en esta elección');
      }
      throw error;
    }
  }

  /**
   * Verificar si el estudiante ha completado todas sus votaciones
   */
  async hasCompletedVoting(studentId: string, institutionId: string): Promise<boolean> {
    const pending = await this.getPendingElectionsForStudent(studentId, institutionId);
    return pending.length === 0;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RESULTADOS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Calcular y guardar resultados de una elección
   * Puede recibir contexto de transacción para operaciones atómicas
   */
  async calculateResults(electionId: string, tx?: any) {
    const prismaClient = tx || this.prisma;

    const election = await prismaClient.election.findUnique({
      where: { id: electionId },
      include: {
        candidates: true,
        votes: true,
      },
    });

    if (!election) {
      throw new NotFoundException('Elección no encontrada');
    }

    const totalVotes = election.votes.length;
    const blankVotes = election.votes.filter((v: any) => !v.candidateId).length;

    // Contar votos por candidato
    const votesByCandidate = new Map<string, number>();
    for (const vote of election.votes) {
      if ((vote as any).candidateId) {
        votesByCandidate.set(
          (vote as any).candidateId,
          (votesByCandidate.get((vote as any).candidateId) || 0) + 1
        );
      }
    }

    // Crear resultados ordenados
    const results: Array<{
      candidateId: string | null;
      votes: number;
      percentage: number;
    }> = [];

    // Agregar votos en blanco
    if (blankVotes > 0) {
      results.push({
        candidateId: null,
        votes: blankVotes,
        percentage: totalVotes > 0 ? (blankVotes / totalVotes) * 100 : 0,
      });
    }

    // Agregar votos por candidato
    for (const candidate of election.candidates) {
      const votes = votesByCandidate.get((candidate as any).id) || 0;
      results.push({
        candidateId: (candidate as any).id,
        votes,
        percentage: totalVotes > 0 ? (votes / totalVotes) * 100 : 0,
      });
    }

    // Ordenar por votos (descendente)
    results.sort((a, b) => b.votes - a.votes);

    // Eliminar resultados anteriores y crear nuevos (atómico si hay tx)
    await prismaClient.electionResult.deleteMany({
      where: { electionId },
    });

    // Guardar nuevos resultados
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      await prismaClient.electionResult.create({
        data: {
          electionId,
          candidateId: result.candidateId,
          votes: result.votes,
          percentage: result.percentage,
          position: i + 1,
          isWinner: i === 0 && result.candidateId !== null,
        },
      });
    }

    // Si no hay transacción externa, retornar resultados
    if (!tx) {
      return this.getResultsByElection(electionId);
    }
  }

  async getResultsByElection(electionId: string) {
    // Validar que la elección existe y está en fase permitida
    const election = await this.prisma.election.findUnique({
      where: { id: electionId },
      include: { electionProcess: true },
    });

    if (!election) {
      throw new NotFoundException('Elección no encontrada');
    }

    const allowedStatuses = ['VOTING', 'CLOSED'];
    if (!allowedStatuses.includes(election.electionProcess.status)) {
      throw new BadRequestException(
        `Los resultados no están disponibles en la fase ${election.electionProcess.status}. Solo disponibles en VOTING o CLOSED.`,
      );
    }

    return this.prisma.electionResult.findMany({
      where: { electionId },
      include: {
        candidate: {
          include: { student: true },
        },
      },
      orderBy: { position: 'asc' },
    });
  }

  async getResultsByProcess(processId: string) {
    // Validar que el proceso existe y está en fase permitida
    const process = await this.prisma.electionProcess.findUnique({
      where: { id: processId },
    });

    if (!process) {
      throw new NotFoundException('Proceso electoral no encontrado');
    }

    const allowedStatuses = ['VOTING', 'CLOSED'];
    if (!allowedStatuses.includes(process.status)) {
      throw new BadRequestException(
        `Los resultados no están disponibles en la fase ${process.status}. Solo disponibles en VOTING o CLOSED.`,
      );
    }

    const elections = await this.prisma.election.findMany({
      where: { electionProcessId: processId },
      include: {
        grade: true,
        group: { include: { grade: true } },
        results: {
          include: {
            candidate: { include: { student: true } },
          },
          orderBy: { position: 'asc' },
        },
        _count: {
          select: { votes: true },
        },
      },
    });

    return elections;
  }

  /**
   * Cerrar proceso y calcular todos los resultados
   * Operación atómica con validaciones de seguridad
   * Incluye: soft-lock, timestamp firmado, snapshot hash, audit log
   */
  async closeProcess(processId: string, institutionId?: string, closedById?: string) {
    return this.prisma.$transaction(async (tx) => {
      const process = await tx.electionProcess.findUnique({
        where: { id: processId },
        include: {
          elections: {
            include: {
              candidates: { include: { student: true } },
              votes: true,
            },
          },
        },
      });

      if (!process) {
        throw new NotFoundException('Proceso electoral no encontrado');
      }

      // Validar multi-tenant si se proporciona institutionId
      if (institutionId && process.institutionId !== institutionId) {
        throw new BadRequestException('No tiene permisos para cerrar este proceso electoral');
      }

      // Validar que el proceso esté en VOTING
      if (process.status !== 'VOTING') {
        throw new BadRequestException(
          `No se puede cerrar el proceso: el estado actual es ${process.status}. Solo se puede cerrar desde VOTING.`,
        );
      }

      // Calcular resultados de todas las elecciones dentro de la transacción
      const allResults: Record<string, any> = {};
      for (const election of process.elections) {
        await this.calculateResults(election.id, tx);
        
        // Obtener resultados calculados para el snapshot
        const results = await tx.electionResult.findMany({
          where: { electionId: election.id },
          include: { candidate: { include: { student: true } } },
          orderBy: { position: 'asc' },
        });
        
        allResults[election.id] = {
          type: election.type,
          gradeId: election.gradeId,
          groupId: election.groupId,
          totalVotes: election.votes.length,
          results: results.map(r => ({
            candidateId: r.candidateId,
            candidateName: r.candidate
              ? `${r.candidate.student.firstName} ${r.candidate.student.lastName}`
              : 'Voto en blanco',
            votes: r.votes,
            percentage: r.percentage,
            position: r.position,
            isWinner: r.isWinner,
          })),
        };

        // Audit: resultados calculados
        await this.auditService.logResultsCalculated(
          processId,
          election.id,
          { totalVotes: election.votes.length, resultsCount: results.length },
          tx,
        );
      }

      // Crear snapshot final con timestamp
      const closedAt = new Date();
      const finalSnapshot = {
        processId,
        processName: process.name,
        institutionId: process.institutionId,
        closedAt: closedAt.toISOString(),
        closedById,
        elections: allResults,
        totalElections: process.elections.length,
        totalVotesCast: process.elections.reduce((sum, e) => sum + e.votes.length, 0),
      };

      // Generar hash de integridad del snapshot
      const finalHash = this.generateHash(finalSnapshot);

      // Generar firma de cierre (hash del snapshot + timestamp + userId)
      const closureSignature = this.generateHash({
        snapshot: finalSnapshot,
        closedAt: closedAt.toISOString(),
        closedById,
        finalHash,
      });

      // Audit: snapshot creado
      await this.auditService.logSnapshotCreated(processId, finalHash, tx);

      // Audit: proceso cerrado
      await this.auditService.logProcessClosed(processId, closedById || 'SYSTEM', finalHash, undefined, tx);

      // Actualizar estado del proceso con datos de cierre enterprise
      return tx.electionProcess.update({
        where: { id: processId },
        data: {
          status: 'CLOSED',
          isLocked: true,
          lockedAt: closedAt,
          lockedById: closedById,
          closedAt,
          closedById,
          closureSignature,
          finalSnapshot,
          finalHash,
        },
      });
    });
  }

  /**
   * Bloquear proceso durante VOTING (soft-lock)
   * Impide modificaciones laterales mientras la votación está activa
   */
  async lockProcess(processId: string, userId: string, institutionId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const process = await tx.electionProcess.findUnique({
        where: { id: processId },
      });

      if (!process) {
        throw new NotFoundException('Proceso electoral no encontrado');
      }

      if (institutionId && process.institutionId !== institutionId) {
        throw new BadRequestException('No tiene permisos para bloquear este proceso electoral');
      }

      if (process.status !== 'VOTING') {
        throw new BadRequestException('Solo se puede bloquear un proceso en fase VOTING');
      }

      if (process.isLocked) {
        throw new BadRequestException('El proceso ya está bloqueado');
      }

      // Audit: proceso bloqueado
      await this.auditService.logProcessLocked(processId, userId, undefined, tx);

      return tx.electionProcess.update({
        where: { id: processId },
        data: {
          isLocked: true,
          lockedAt: new Date(),
          lockedById: userId,
        },
      });
    });
  }

  /**
   * Verificar integridad del proceso cerrado
   */
  async verifyProcessIntegrity(processId: string): Promise<{
    isValid: boolean;
    snapshotValid: boolean;
    auditChainValid: boolean;
    details: Record<string, any>;
  }> {
    const process = await this.prisma.electionProcess.findUnique({
      where: { id: processId },
    });

    if (!process) {
      throw new NotFoundException('Proceso electoral no encontrado');
    }

    if (process.status !== 'CLOSED') {
      throw new BadRequestException('Solo se puede verificar integridad de procesos cerrados');
    }

    // Verificar hash del snapshot
    const recalculatedHash = this.generateHash(process.finalSnapshot);
    const snapshotValid = recalculatedHash === process.finalHash;

    // Verificar cadena de audit logs
    const auditVerification = await this.auditService.verifyChainIntegrity(processId);

    return {
      isValid: snapshotValid && auditVerification.isValid,
      snapshotValid,
      auditChainValid: auditVerification.isValid,
      details: {
        finalHash: process.finalHash,
        recalculatedHash,
        closedAt: process.closedAt,
        closureSignature: process.closureSignature,
        auditLogsCount: auditVerification.totalLogs,
        invalidAuditLogs: auditVerification.invalidLogs,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ESTADÍSTICAS
  // ═══════════════════════════════════════════════════════════════════════════

  async getVotingStats(processId: string) {
    const process = await this.prisma.electionProcess.findUnique({
      where: { id: processId },
      include: {
        elections: {
          include: {
            _count: { select: { votes: true, candidates: true } },
          },
        },
      },
    });

    if (!process) {
      throw new NotFoundException('Proceso electoral no encontrado');
    }

    // Validar fase permitida
    const allowedStatuses = ['VOTING', 'CLOSED'];
    if (!allowedStatuses.includes(process.status)) {
      throw new BadRequestException(
        `Las estadísticas no están disponibles en la fase ${process.status}. Solo disponibles en VOTING o CLOSED.`,
      );
    }

    // Contar estudiantes habilitados para votar
    const totalStudents = await this.prisma.studentEnrollment.count({
      where: {
        status: 'ACTIVE',
        group: {
          campus: { institutionId: process.institutionId },
        },
      },
    });

    // Contar votos únicos (estudiantes que han votado al menos una vez)
    const uniqueVoters = await this.prisma.vote.groupBy({
      by: ['voterId'],
      where: {
        election: { electionProcessId: processId },
      },
    });

    return {
      totalStudents,
      totalVoters: uniqueVoters.length,
      participationRate: totalStudents > 0 ? (uniqueVoters.length / totalStudents) * 100 : 0,
      elections: process.elections.map(e => ({
        id: e.id,
        type: e.type,
        totalVotes: e._count.votes,
        totalCandidates: e._count.candidates,
      })),
    };
  }
}
