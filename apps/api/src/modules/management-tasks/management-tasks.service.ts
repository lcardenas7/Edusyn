import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SupabaseStorageService } from '../storage/supabase-storage.service';
import { ManagementArea, TaskPriority, TaskCategory, TaskAssignmentStatus } from '@prisma/client';

// DTOs
export interface CreateLeaderDto {
  institutionId: string;
  userId: string;
  area: ManagementArea;
}

export interface CreateTaskDto {
  institutionId: string;
  title: string;
  description?: string;
  category: TaskCategory;
  priority?: TaskPriority;
  dueDate?: Date;
  assigneeIds: string[];
}

export interface UpdateTaskDto {
  title?: string;
  description?: string;
  category?: TaskCategory;
  priority?: TaskPriority;
  dueDate?: Date;
  isActive?: boolean;
}

export interface SubmitEvidenceDto {
  responseNote?: string;
}

export interface VerifyTaskDto {
  status: 'APPROVED' | 'REJECTED';
  verificationNote?: string;
}

@Injectable()
export class ManagementTasksService {
  private readonly MAX_EVIDENCE_SIZE = 5 * 1024 * 1024; // 5MB
  
  private readonly ALLOWED_EVIDENCE_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  constructor(
    private prisma: PrismaService,
    private storageService: SupabaseStorageService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // LÍDERES DE GESTIÓN
  // ═══════════════════════════════════════════════════════════════════════════

  async createLeader(dto: CreateLeaderDto, assignedById: string) {
    // Verificar que el usuario exista y sea docente
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      include: { roles: { include: { role: true } } },
    });
    
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    
    return this.prisma.managementLeader.create({
      data: {
        institutionId: dto.institutionId,
        userId: dto.userId,
        area: dto.area,
        assignedById,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        assignedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async getLeaders(institutionId: string) {
    return this.prisma.managementLeader.findMany({
      where: { institutionId, isActive: true },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        assignedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { area: 'asc' },
    });
  }

  async removeLeader(id: string) {
    await this.prisma.managementLeader.update({
      where: { id },
      data: { isActive: false },
    });
    return { success: true };
  }

  async isUserLeader(userId: string, institutionId: string): Promise<boolean> {
    const leader = await this.prisma.managementLeader.findFirst({
      where: { userId, institutionId, isActive: true },
    });
    return !!leader;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TAREAS
  // ═══════════════════════════════════════════════════════════════════════════

  async createTask(dto: CreateTaskDto, createdById: string) {
    // Verificar si el creador es líder
    const leader = await this.prisma.managementLeader.findFirst({
      where: { userId: createdById, institutionId: dto.institutionId, isActive: true },
    });
    
    // Crear la tarea
    const task = await this.prisma.managementTask.create({
      data: {
        institutionId: dto.institutionId,
        title: dto.title,
        description: dto.description,
        category: dto.category,
        priority: dto.priority || 'NORMAL',
        dueDate: dto.dueDate,
        createdById,
        leaderId: leader?.id,
      },
    });
    
    // Crear asignaciones
    if (dto.assigneeIds && dto.assigneeIds.length > 0) {
      await this.prisma.taskAssignment.createMany({
        data: dto.assigneeIds.map(assigneeId => ({
          taskId: task.id,
          assigneeId,
        })),
      });
    }
    
    return this.getTaskById(task.id);
  }

  async getTaskById(id: string) {
    const task = await this.prisma.managementTask.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        assignments: {
          include: {
            assignee: { select: { id: true, firstName: true, lastName: true, email: true } },
            verifiedBy: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });
    
    if (!task) {
      throw new NotFoundException('Tarea no encontrada');
    }
    
    return task;
  }

  async getTasks(institutionId: string, filters?: {
    status?: TaskAssignmentStatus;
    priority?: TaskPriority;
    category?: TaskCategory;
    createdById?: string;
  }) {
    return this.prisma.managementTask.findMany({
      where: {
        institutionId,
        isActive: true,
        ...(filters?.priority && { priority: filters.priority }),
        ...(filters?.category && { category: filters.category }),
        ...(filters?.createdById && { createdById: filters.createdById }),
        ...(filters?.status && {
          assignments: { some: { status: filters.status } },
        }),
      },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        assignments: {
          include: {
            assignee: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        _count: { select: { assignments: true } },
      },
      orderBy: [
        { priority: 'desc' },
        { dueDate: 'asc' },
        { createdAt: 'desc' },
      ],
    });
  }

  async getMyTasks(userId: string, status?: TaskAssignmentStatus) {
    return this.prisma.taskAssignment.findMany({
      where: {
        assigneeId: userId,
        ...(status && { status }),
        task: { isActive: true },
      },
      include: {
        task: {
          include: {
            createdBy: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        verifiedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [
        { status: 'asc' },
        { task: { priority: 'desc' } },
        { task: { dueDate: 'asc' } },
      ],
    });
  }

  async getMyPendingCount(userId: string): Promise<number> {
    return this.prisma.taskAssignment.count({
      where: {
        assigneeId: userId,
        status: { in: ['PENDING', 'IN_PROGRESS', 'REJECTED'] },
        task: { isActive: true },
      },
    });
  }

  async updateTask(id: string, dto: UpdateTaskDto, userId: string) {
    const task = await this.getTaskById(id);
    
    // Verificar que el usuario sea el creador o admin
    if (task.createdById !== userId) {
      throw new ForbiddenException('No tienes permiso para editar esta tarea');
    }
    
    return this.prisma.managementTask.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        category: dto.category,
        priority: dto.priority,
        dueDate: dto.dueDate,
        isActive: dto.isActive,
      },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        assignments: {
          include: {
            assignee: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });
  }

  async deleteTask(id: string, userId: string) {
    const task = await this.getTaskById(id);
    
    if (task.createdById !== userId) {
      throw new ForbiddenException('No tienes permiso para eliminar esta tarea');
    }
    
    await this.prisma.managementTask.update({
      where: { id },
      data: { isActive: false },
    });
    
    return { success: true };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ASIGNACIONES (Respuestas del docente)
  // ═══════════════════════════════════════════════════════════════════════════

  async startTask(assignmentId: string, userId: string) {
    const assignment = await this.getAssignment(assignmentId, userId);
    
    if (assignment.status !== 'PENDING') {
      throw new BadRequestException('La tarea ya fue iniciada');
    }
    
    return this.prisma.taskAssignment.update({
      where: { id: assignmentId },
      data: {
        status: 'IN_PROGRESS',
        startedAt: new Date(),
      },
    });
  }

  async submitEvidence(
    assignmentId: string,
    userId: string,
    dto: SubmitEvidenceDto,
    file?: Express.Multer.File,
  ) {
    const assignment = await this.getAssignment(assignmentId, userId);
    
    if (!['PENDING', 'IN_PROGRESS', 'REJECTED'].includes(assignment.status)) {
      throw new BadRequestException('No se puede enviar evidencia en este estado');
    }
    
    let evidenceData = {};
    
    if (file) {
      this.validateEvidenceFile(file);
      
      // Verificar límite de almacenamiento
      const task = await this.prisma.managementTask.findUnique({
        where: { id: assignment.taskId },
      });
      
      if (task) {
        await this.checkStorageLimit(task.institutionId, file.size);
      }
      
      // Subir archivo
      const uploadResult = await this.uploadEvidence(
        task!.institutionId,
        assignment.taskId,
        userId,
        file,
      );
      
      evidenceData = {
        evidenceUrl: uploadResult.url,
        evidenceFileName: file.originalname,
        evidenceFileSize: file.size,
        evidenceMimeType: file.mimetype,
      };
      
      // Actualizar uso de almacenamiento
      await this.updateStorageUsage(task!.institutionId, file.size);
    }
    
    return this.prisma.taskAssignment.update({
      where: { id: assignmentId },
      data: {
        status: 'SUBMITTED',
        completedAt: new Date(),
        responseNote: dto.responseNote,
        ...evidenceData,
      },
      include: {
        task: true,
        assignee: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async markAsCompleted(assignmentId: string, userId: string, responseNote?: string) {
    const assignment = await this.getAssignment(assignmentId, userId);
    
    if (!['PENDING', 'IN_PROGRESS', 'REJECTED'].includes(assignment.status)) {
      throw new BadRequestException('No se puede completar en este estado');
    }
    
    return this.prisma.taskAssignment.update({
      where: { id: assignmentId },
      data: {
        status: 'SUBMITTED',
        completedAt: new Date(),
        responseNote,
      },
      include: {
        task: true,
        assignee: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async verifyTask(assignmentId: string, verifierId: string, dto: VerifyTaskDto) {
    const assignment = await this.prisma.taskAssignment.findUnique({
      where: { id: assignmentId },
      include: { task: true },
    });
    
    if (!assignment) {
      throw new NotFoundException('Asignación no encontrada');
    }
    
    if (assignment.status !== 'SUBMITTED') {
      throw new BadRequestException('La tarea no está pendiente de verificación');
    }
    
    return this.prisma.taskAssignment.update({
      where: { id: assignmentId },
      data: {
        status: dto.status,
        verifiedById: verifierId,
        verifiedAt: new Date(),
        verificationNote: dto.verificationNote,
      },
      include: {
        task: true,
        assignee: { select: { id: true, firstName: true, lastName: true } },
        verifiedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async getPendingVerifications(institutionId: string, verifierId: string) {
    // Obtener tareas creadas por este usuario que están pendientes de verificación
    return this.prisma.taskAssignment.findMany({
      where: {
        status: 'SUBMITTED',
        task: {
          institutionId,
          isActive: true,
          createdById: verifierId,
        },
      },
      include: {
        task: true,
        assignee: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { completedAt: 'asc' },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private async getAssignment(assignmentId: string, userId: string) {
    const assignment = await this.prisma.taskAssignment.findUnique({
      where: { id: assignmentId },
    });
    
    if (!assignment) {
      throw new NotFoundException('Asignación no encontrada');
    }
    
    if (assignment.assigneeId !== userId) {
      throw new ForbiddenException('No tienes permiso para esta acción');
    }
    
    return assignment;
  }

  private validateEvidenceFile(file: Express.Multer.File) {
    if (file.size > this.MAX_EVIDENCE_SIZE) {
      throw new BadRequestException(`El archivo excede el límite de ${this.MAX_EVIDENCE_SIZE / 1024 / 1024}MB`);
    }
    
    if (!this.ALLOWED_EVIDENCE_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Tipo de archivo no permitido');
    }
  }

  private async uploadEvidence(
    institutionId: string,
    taskId: string,
    userId: string,
    file: Express.Multer.File,
  ) {
    const ext = file.originalname.split('.').pop() || 'pdf';
    const fileName = `evidence_${Date.now()}.${ext}`;
    const path = `institucion/${institutionId}/tareas/${taskId}/${userId}/${fileName}`;
    
    const { data, error } = await (this.storageService as any).supabase.storage
      .from('documentos')
      .upload(path, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });
    
    if (error) {
      console.error('[ManagementTasks] Upload error:', error);
      throw new BadRequestException(`Error al subir archivo: ${error.message}`);
    }
    
    const { data: urlData } = (this.storageService as any).supabase.storage
      .from('documentos')
      .getPublicUrl(path);
    
    return {
      url: urlData.publicUrl,
      path,
    };
  }

  private async checkStorageLimit(institutionId: string, fileSize: number) {
    const usage = await this.prisma.institutionStorageUsage.findUnique({
      where: { institutionId },
    });
    
    if (!usage) return;
    
    const currentUsage = Number(usage.evidencesUsage);
    const limit = Number(usage.evidencesLimit);
    
    if (limit > 0 && currentUsage + fileSize > limit) {
      throw new ForbiddenException(
        `Límite de almacenamiento de evidencias alcanzado`
      );
    }
  }

  private async updateStorageUsage(institutionId: string, sizeChange: number) {
    await this.prisma.institutionStorageUsage.upsert({
      where: { institutionId },
      create: {
        institutionId,
        evidencesUsage: BigInt(Math.max(0, sizeChange)),
      },
      update: {
        evidencesUsage: {
          increment: BigInt(sizeChange),
        },
        lastCalculatedAt: new Date(),
      },
    });
  }

  async getEnums() {
    return {
      areas: Object.values(ManagementArea).map(v => ({ value: v, label: this.getAreaLabel(v) })),
      priorities: Object.values(TaskPriority).map(v => ({ value: v, label: this.getPriorityLabel(v) })),
      categories: Object.values(TaskCategory).map(v => ({ value: v, label: this.getCategoryLabel(v) })),
      statuses: Object.values(TaskAssignmentStatus).map(v => ({ value: v, label: this.getStatusLabel(v) })),
    };
  }

  private getAreaLabel(area: ManagementArea): string {
    const labels: Record<ManagementArea, string> = {
      ACADEMICA: 'Gestión Académica',
      DIRECTIVA: 'Gestión Directiva',
      COMUNITARIA: 'Gestión Comunitaria',
      ADMINISTRATIVA: 'Gestión Administrativa',
    };
    return labels[area];
  }

  private getPriorityLabel(priority: TaskPriority): string {
    const labels: Record<TaskPriority, string> = {
      BAJA: 'Baja',
      NORMAL: 'Normal',
      ALTA: 'Alta',
      URGENTE: 'Urgente',
    };
    return labels[priority];
  }

  private getCategoryLabel(category: TaskCategory): string {
    const labels: Record<TaskCategory, string> = {
      PLANEACION: 'Planeación',
      SEGUIMIENTO: 'Seguimiento',
      EVIDENCIA: 'Evidencia',
      REUNION: 'Reunión',
      CAPACITACION: 'Capacitación',
      PROYECTO: 'Proyecto',
      OTRO: 'Otro',
    };
    return labels[category];
  }

  private getStatusLabel(status: TaskAssignmentStatus): string {
    const labels: Record<TaskAssignmentStatus, string> = {
      PENDING: 'Pendiente',
      IN_PROGRESS: 'En Progreso',
      SUBMITTED: 'Entregada',
      APPROVED: 'Aprobada',
      REJECTED: 'Rechazada',
      CANCELLED: 'Cancelada',
    };
    return labels[status];
  }
}
