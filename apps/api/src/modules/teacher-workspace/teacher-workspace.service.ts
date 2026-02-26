import { Injectable, ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBoardDto, UpdateBoardDto, CreateColumnDto, UpdateColumnDto, CreateItemDto, UpdateItemDto, MoveItemDto } from './dto/workspace.dto';
import { WorkspaceBoardType } from '@prisma/client';

@Injectable()
export class TeacherWorkspaceService {
  constructor(private prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // BLINDAJE: Validación de ownership antes de cualquier operación
  // ═══════════════════════════════════════════════════════════════════════════

  private async validateBoardOwnership(boardId: string, teacherId: string, institutionId: string) {
    const board = await this.prisma.workspaceBoard.findUnique({ where: { id: boardId } });
    if (!board || board.teacherId !== teacherId || board.institutionId !== institutionId) {
      throw new ForbiddenException('No tienes acceso a este tablero');
    }
    return board;
  }

  private async validateColumnOwnership(columnId: string, teacherId: string, institutionId: string) {
    const column = await this.prisma.workspaceColumn.findUnique({
      where: { id: columnId },
      include: { board: { select: { teacherId: true, institutionId: true } } },
    });
    if (!column || column.board.teacherId !== teacherId || column.board.institutionId !== institutionId) {
      throw new ForbiddenException('No tienes acceso a esta columna');
    }
    return column;
  }

  private async validateItemOwnership(itemId: string, teacherId: string, institutionId: string) {
    const item = await this.prisma.workspaceItem.findUnique({
      where: { id: itemId },
      include: { board: { select: { teacherId: true, institutionId: true } } },
    });
    if (!item || item.board.teacherId !== teacherId || item.board.institutionId !== institutionId) {
      throw new ForbiddenException('No tienes acceso a este item');
    }
    return item;
  }

  private async validateStudentBelongsToInstitution(studentId: string, institutionId: string) {
    const enrollment = await this.prisma.studentEnrollment.findFirst({
      where: { studentId, group: { campus: { institutionId } } },
    });
    if (!enrollment) {
      throw new BadRequestException('El estudiante no pertenece a esta institución');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BOARDS
  // ═══════════════════════════════════════════════════════════════════════════

  private readonly defaultColumns: Record<string, string[]> = {
    KANBAN: ['Por hacer', 'En proceso', 'Hecho'],
    CLASS_LOG: ['Bitácora'],
    STUDENT_NOTES: ['Seguimiento'],
    CHECKLIST: ['Pendiente', 'Completado'],
    MICRO_COLLECT: ['Pendiente', 'Pagado'],
    CLASSROOM_ROLES: ['Roles activos'],
    PROJECT: ['Ideas', 'En progreso', 'Finalizado'],
  };

  async listBoards(teacherId: string, institutionId: string, filters?: { type?: WorkspaceBoardType; groupId?: string; isArchived?: boolean }) {
    return this.prisma.workspaceBoard.findMany({
      where: {
        teacherId,
        institutionId,
        isArchived: filters?.isArchived ?? false,
        ...(filters?.type && { type: filters.type }),
        ...(filters?.groupId && { groupId: filters.groupId }),
      },
      include: {
        group: { select: { id: true, name: true, grade: { select: { name: true } } } },
        _count: { select: { items: { where: { isArchived: false } } } },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getBoard(boardId: string, teacherId: string, institutionId: string) {
    await this.validateBoardOwnership(boardId, teacherId, institutionId);

    return this.prisma.workspaceBoard.findUnique({
      where: { id: boardId },
      include: {
        group: { select: { id: true, name: true, grade: { select: { name: true } } } },
        columns: {
          orderBy: { sortOrder: 'asc' },
          include: {
            items: {
              where: { isArchived: false },
              orderBy: { sortOrder: 'asc' },
              include: {
                student: { select: { id: true, firstName: true, lastName: true } },
              },
            },
          },
        },
        items: {
          where: { columnId: null, isArchived: false },
          orderBy: { sortOrder: 'asc' },
          include: {
            student: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });
  }

  async createBoard(teacherId: string, institutionId: string, dto: CreateBoardDto) {
    const cols = this.defaultColumns[dto.type] || ['General'];

    return this.prisma.workspaceBoard.create({
      data: {
        teacherId,
        institutionId,
        type: dto.type,
        title: dto.title,
        description: dto.description,
        color: dto.color,
        academicYearId: dto.academicYearId,
        groupId: dto.groupId,
        columns: {
          create: cols.map((title, idx) => ({
            title,
            sortOrder: (idx + 1) * 100,
          })),
        },
      },
      include: {
        columns: true,
        _count: { select: { items: { where: { isArchived: false } } } },
      },
    });
  }

  async updateBoard(boardId: string, teacherId: string, institutionId: string, dto: UpdateBoardDto) {
    await this.validateBoardOwnership(boardId, teacherId, institutionId);

    return this.prisma.workspaceBoard.update({
      where: { id: boardId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.color !== undefined && { color: dto.color }),
        ...(dto.isArchived !== undefined && { isArchived: dto.isArchived }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
    });
  }

  async deleteBoard(boardId: string, teacherId: string, institutionId: string) {
    await this.validateBoardOwnership(boardId, teacherId, institutionId);
    await this.prisma.workspaceBoard.delete({ where: { id: boardId } });
    return { success: true };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COLUMNS
  // ═══════════════════════════════════════════════════════════════════════════

  async createColumn(teacherId: string, institutionId: string, dto: CreateColumnDto) {
    await this.validateBoardOwnership(dto.boardId, teacherId, institutionId);

    const maxSort = await this.prisma.workspaceColumn.aggregate({
      where: { boardId: dto.boardId },
      _max: { sortOrder: true },
    });

    return this.prisma.workspaceColumn.create({
      data: {
        boardId: dto.boardId,
        title: dto.title,
        color: dto.color,
        sortOrder: (maxSort._max.sortOrder ?? 0) + 100,
      },
    });
  }

  async updateColumn(columnId: string, teacherId: string, institutionId: string, dto: UpdateColumnDto) {
    await this.validateColumnOwnership(columnId, teacherId, institutionId);

    return this.prisma.workspaceColumn.update({
      where: { id: columnId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.color !== undefined && { color: dto.color }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
    });
  }

  async deleteColumn(columnId: string, teacherId: string, institutionId: string) {
    await this.validateColumnOwnership(columnId, teacherId, institutionId);
    // SetNull on items via FK cascade
    await this.prisma.workspaceColumn.delete({ where: { id: columnId } });
    return { success: true };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ITEMS
  // ═══════════════════════════════════════════════════════════════════════════

  async createItem(teacherId: string, institutionId: string, dto: CreateItemDto) {
    await this.validateBoardOwnership(dto.boardId, teacherId, institutionId);

    if (dto.studentId) {
      await this.validateStudentBelongsToInstitution(dto.studentId, institutionId);
    }

    const maxSort = await this.prisma.workspaceItem.aggregate({
      where: { boardId: dto.boardId, columnId: dto.columnId ?? null },
      _max: { sortOrder: true },
    });

    return this.prisma.workspaceItem.create({
      data: {
        boardId: dto.boardId,
        columnId: dto.columnId,
        studentId: dto.studentId,
        title: dto.title,
        content: dto.content,
        metadata: dto.metadata,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        sortOrder: (maxSort._max.sortOrder ?? 0) + 100,
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async updateItem(itemId: string, teacherId: string, institutionId: string, dto: UpdateItemDto) {
    await this.validateItemOwnership(itemId, teacherId, institutionId);

    return this.prisma.workspaceItem.update({
      where: { id: itemId },
      data: {
        ...(dto.columnId !== undefined && { columnId: dto.columnId }),
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.content !== undefined && { content: dto.content }),
        ...(dto.metadata !== undefined && { metadata: dto.metadata }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.dueDate !== undefined && { dueDate: dto.dueDate ? new Date(dto.dueDate) : null }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.isArchived !== undefined && { isArchived: dto.isArchived }),
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async moveItem(itemId: string, teacherId: string, institutionId: string, dto: MoveItemDto) {
    await this.validateItemOwnership(itemId, teacherId, institutionId);

    return this.prisma.workspaceItem.update({
      where: { id: itemId },
      data: {
        columnId: dto.columnId,
        sortOrder: dto.sortOrder,
      },
    });
  }

  async deleteItem(itemId: string, teacherId: string, institutionId: string) {
    await this.validateItemOwnership(itemId, teacherId, institutionId);
    await this.prisma.workspaceItem.delete({ where: { id: itemId } });
    return { success: true };
  }
}
