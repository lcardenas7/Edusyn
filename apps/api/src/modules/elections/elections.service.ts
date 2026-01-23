import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ElectionsService {
  constructor(private prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // PROCESOS ELECTORALES
  // ═══════════════════════════════════════════════════════════════════════════

  async createProcess(data: {
    institutionId: string;
    academicYearId: string;
    name: string;
    description?: string;
    registrationStart: Date;
    registrationEnd: Date;
    campaignStart: Date;
    campaignEnd: Date;
    votingStart: Date;
    votingEnd: Date;
    enablePersonero?: boolean;
    enableContralor?: boolean;
    enableRepresentanteGrado?: boolean;
    enableRepresentanteCurso?: boolean;
    allowBlankVote?: boolean;
    createdById: string;
  }) {
    // Verificar que no exista proceso para este año
    const existing = await this.prisma.electionProcess.findUnique({
      where: {
        institutionId_academicYearId: {
          institutionId: data.institutionId,
          academicYearId: data.academicYearId,
        },
      },
    });

    if (existing) {
      throw new BadRequestException('Ya existe un proceso electoral para este año académico');
    }

    // Crear proceso electoral
    const process = await this.prisma.electionProcess.create({
      data: {
        institutionId: data.institutionId,
        academicYearId: data.academicYearId,
        name: data.name,
        description: data.description,
        registrationStart: data.registrationStart,
        registrationEnd: data.registrationEnd,
        campaignStart: data.campaignStart,
        campaignEnd: data.campaignEnd,
        votingStart: data.votingStart,
        votingEnd: data.votingEnd,
        enablePersonero: data.enablePersonero ?? true,
        enableContralor: data.enableContralor ?? true,
        enableRepresentanteGrado: data.enableRepresentanteGrado ?? true,
        enableRepresentanteCurso: data.enableRepresentanteCurso ?? true,
        allowBlankVote: data.allowBlankVote ?? true,
        createdById: data.createdById,
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

  async updateProcessStatus(processId: string, status: string) {
    return this.prisma.electionProcess.update({
      where: { id: processId },
      data: { status: status as any },
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
    return this.prisma.candidate.update({
      where: { id: candidateId },
      data: {
        status: 'APPROVED',
        approvedById,
        approvedAt: new Date(),
      },
    });
  }

  async rejectCandidate(candidateId: string, approvedById: string, reason: string) {
    return this.prisma.candidate.update({
      where: { id: candidateId },
      data: {
        status: 'REJECTED',
        approvedById,
        approvedAt: new Date(),
        rejectionReason: reason,
      },
    });
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
      orderBy: { createdAt: 'asc' },
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
    // Verificar que la elección está en votación
    const election = await this.prisma.election.findUnique({
      where: { id: data.electionId },
      include: { electionProcess: true },
    });

    if (!election) {
      throw new NotFoundException('Elección no encontrada');
    }

    if (election.electionProcess.status !== 'VOTING') {
      throw new BadRequestException('La votación no está activa');
    }

    // Verificar que no haya votado ya
    const existingVote = await this.prisma.vote.findUnique({
      where: {
        electionId_voterId: {
          electionId: data.electionId,
          voterId: data.voterId,
        },
      },
    });

    if (existingVote) {
      throw new BadRequestException('Ya has votado en esta elección');
    }

    // Verificar que el candidato pertenece a esta elección (si no es voto en blanco)
    if (data.candidateId) {
      const candidate = await this.prisma.candidate.findFirst({
        where: {
          id: data.candidateId,
          electionId: data.electionId,
          status: 'APPROVED',
        },
      });

      if (!candidate) {
        throw new BadRequestException('Candidato no válido para esta elección');
      }
    } else if (!election.electionProcess.allowBlankVote) {
      throw new BadRequestException('El voto en blanco no está permitido');
    }

    // Registrar voto
    return this.prisma.vote.create({
      data: {
        electionId: data.electionId,
        voterId: data.voterId,
        candidateId: data.candidateId,
      },
    });
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
   */
  async calculateResults(electionId: string) {
    const election = await this.prisma.election.findUnique({
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
    const blankVotes = election.votes.filter(v => !v.candidateId).length;

    // Contar votos por candidato
    const votesByCandidate = new Map<string, number>();
    for (const vote of election.votes) {
      if (vote.candidateId) {
        votesByCandidate.set(
          vote.candidateId,
          (votesByCandidate.get(vote.candidateId) || 0) + 1
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
      const votes = votesByCandidate.get(candidate.id) || 0;
      results.push({
        candidateId: candidate.id,
        votes,
        percentage: totalVotes > 0 ? (votes / totalVotes) * 100 : 0,
      });
    }

    // Ordenar por votos (descendente)
    results.sort((a, b) => b.votes - a.votes);

    // Eliminar resultados anteriores
    await this.prisma.electionResult.deleteMany({
      where: { electionId },
    });

    // Guardar nuevos resultados
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      await this.prisma.electionResult.create({
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

    return this.getResultsByElection(electionId);
  }

  async getResultsByElection(electionId: string) {
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
   */
  async closeProcess(processId: string) {
    const process = await this.prisma.electionProcess.findUnique({
      where: { id: processId },
      include: { elections: true },
    });

    if (!process) {
      throw new NotFoundException('Proceso electoral no encontrado');
    }

    // Calcular resultados de todas las elecciones
    for (const election of process.elections) {
      await this.calculateResults(election.id);
    }

    // Actualizar estado del proceso
    return this.prisma.electionProcess.update({
      where: { id: processId },
      data: { status: 'CLOSED' },
    });
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
