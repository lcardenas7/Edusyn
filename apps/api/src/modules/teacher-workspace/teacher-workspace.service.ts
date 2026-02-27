import { Injectable, ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBoardDto, UpdateBoardDto, CreateColumnDto, UpdateColumnDto, CreateItemDto, UpdateItemDto, MoveItemDto } from './dto/workspace.dto';
import { WorkspaceBoardType, WorkspaceScopeType } from '@prisma/client';

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
    // For MULTI_GROUP scope, store groupIds in metadata
    let metadata = dto.metadata || undefined;
    if (dto.scopeType === 'MULTI_GROUP' && dto.groupIds?.length) {
      metadata = { ...(metadata || {}), groupIds: dto.groupIds };
    }

    // STUDENT_NOTES: auto-create columns per assigned group
    let colDefs: { title: string; color?: string; metadata?: any }[];
    if (dto.type === 'STUDENT_NOTES') {
      const assignments = await this.prisma.teacherAssignment.findMany({
        where: { teacherId, group: { campus: { institutionId } }, endDate: null },
        select: { group: { select: { id: true, name: true, grade: { select: { name: true } } } } },
      });
      const groupMap = new Map<string, { id: string; name: string; gradeName: string }>();
      for (const a of assignments) {
        if (a.group && !groupMap.has(a.group.id)) {
          groupMap.set(a.group.id, { id: a.group.id, name: a.group.name, gradeName: a.group.grade.name });
        }
      }
      const groups = Array.from(groupMap.values());
      colDefs = groups.length > 0
        ? groups.map(g => ({ title: `${g.gradeName} ${g.name}`, metadata: { groupId: g.id } }))
        : [{ title: 'Seguimiento' }];
    } else {
      const defaultCols = this.defaultColumns[dto.type] || ['General'];
      colDefs = defaultCols.map(title => ({ title }));
    }

    return this.prisma.workspaceBoard.create({
      data: {
        teacherId,
        institutionId,
        type: dto.type,
        scopeType: dto.scopeType,
        title: dto.title,
        description: dto.description,
        color: dto.color,
        metadata,
        academicYearId: dto.academicYearId,
        groupId: dto.groupId,
        gradeId: dto.gradeId,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        columns: {
          create: colDefs.map((col, idx) => ({
            title: col.title,
            color: col.color,
            sortOrder: (idx + 1) * 100,
          })),
        },
      },
      include: {
        columns: true,
        group: { select: { id: true, name: true, grade: { select: { name: true } } } },
        grade: { select: { id: true, name: true } },
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
        ...(dto.metadata !== undefined && { metadata: dto.metadata }),
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
        eventDate: dto.eventDate ? new Date(dto.eventDate) : undefined,
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
        ...(dto.eventDate !== undefined && { eventDate: dto.eventDate ? new Date(dto.eventDate) : null }),
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

  // ═══════════════════════════════════════════════════════════════════════════
  // SCOPE OPTIONS — grades & groups filtered by teacher's assignments
  // ═══════════════════════════════════════════════════════════════════════════

  async getScopeOptions(teacherId: string, institutionId: string) {
    const assignments = await this.prisma.teacherAssignment.findMany({
      where: { teacherId, group: { campus: { institutionId } }, endDate: null },
      select: {
        group: {
          select: {
            id: true, name: true,
            grade: { select: { id: true, name: true, stage: true } },
          },
        },
      },
    });

    const groupMap = new Map<string, { id: string; name: string; gradeId: string; gradeName: string }>();
    const gradeMap = new Map<string, { id: string; name: string; stage: string; groups: string[] }>();

    for (const a of assignments) {
      const g = a.group;
      if (!g) continue;
      if (!groupMap.has(g.id)) {
        groupMap.set(g.id, { id: g.id, name: g.name, gradeId: g.grade.id, gradeName: g.grade.name });
      }
      if (!gradeMap.has(g.grade.id)) {
        gradeMap.set(g.grade.id, { id: g.grade.id, name: g.grade.name, stage: g.grade.stage, groups: [] });
      }
      const grade = gradeMap.get(g.grade.id)!;
      if (!grade.groups.includes(g.id)) grade.groups.push(g.id);
    }

    return {
      groups: Array.from(groupMap.values()),
      grades: Array.from(gradeMap.values()),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // POPULATE — auto-create items from students in scope
  // ═══════════════════════════════════════════════════════════════════════════

  async populateBoard(boardId: string, teacherId: string, institutionId: string) {
    const board = await this.validateBoardOwnership(boardId, teacherId, institutionId);

    if (!['MICRO_COLLECT', 'CLASSROOM_ROLES'].includes(board.type)) {
      throw new BadRequestException('Solo tableros de tipo Micro-recaudo o Roles del Aula se pueden poblar');
    }

    // Resolve Student IDs based on scope (these are Student.id, NOT User.id)
    const studentIds = await this.resolveStudentsByScope(board, institutionId);
    if (!studentIds.length) {
      throw new BadRequestException('No se encontraron estudiantes para el alcance seleccionado');
    }

    // Get existing items to avoid duplicates — check by metadata.studentRecordId
    const existingItems = await this.prisma.workspaceItem.findMany({
      where: { boardId, isArchived: false },
      select: { metadata: true },
    });
    const existingStudentIds = new Set(
      existingItems.map(e => ((e.metadata as any)?.studentRecordId || '')).filter(Boolean),
    );
    const newStudentIds = studentIds.filter(id => !existingStudentIds.has(id));

    if (!newStudentIds.length) {
      return { created: 0, total: studentIds.length, message: 'Todos los estudiantes ya están en el tablero' };
    }

    // Get student names from Student model (NOT User)
    const students = await this.prisma.student.findMany({
      where: { id: { in: newStudentIds }, isActive: true },
      select: { id: true, userId: true, firstName: true, secondName: true, lastName: true, secondLastName: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    // Get first column
    const firstCol = await this.prisma.workspaceColumn.findFirst({
      where: { boardId },
      orderBy: { sortOrder: 'asc' },
    });

    // Build items — store Student.id in metadata, Student.userId in studentId FK (if exists)
    const itemsData = students.map((s, idx) => {
      const fullName = [s.lastName, s.secondLastName, s.firstName, s.secondName].filter(Boolean).join(' ');
      let itemMeta: any = { studentRecordId: s.id };
      if (board.type === 'MICRO_COLLECT') {
        itemMeta = { ...itemMeta, amountPaid: 0, status: 'PENDING' };
      } else if (board.type === 'CLASSROOM_ROLES') {
        itemMeta = { ...itemMeta, role: '' };
      }
      return {
        boardId,
        columnId: firstCol?.id || null,
        studentId: s.userId || null, // FK to User (optional)
        title: fullName,
        metadata: itemMeta,
        sortOrder: (existingItems.length + idx + 1) * 100,
      };
    });

    await this.prisma.workspaceItem.createMany({ data: itemsData });

    return { created: itemsData.length, total: studentIds.length };
  }

  private async resolveStudentsByScope(board: any, institutionId: string): Promise<string[]> {
    const scope = board.scopeType as WorkspaceScopeType | null;
    let groupIds: string[] = [];

    if (scope === 'GROUP' && board.groupId) {
      groupIds = [board.groupId];
    } else if (scope === 'GRADE' && board.gradeId) {
      const groups = await this.prisma.group.findMany({
        where: { gradeId: board.gradeId, campus: { institutionId } },
        select: { id: true },
      });
      groupIds = groups.map(g => g.id);
    } else if (scope === 'MULTI_GROUP') {
      const meta = (board.metadata || {}) as any;
      groupIds = meta.groupIds || [];
    } else if (board.groupId) {
      groupIds = [board.groupId];
    }

    if (!groupIds.length) return [];

    // Query active enrollments only (Student IDs, not User IDs)
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: {
        groupId: { in: groupIds },
        status: 'ACTIVE',
        institutionId,
      },
      select: { studentId: true },
    });

    return [...new Set(enrollments.map(e => e.studentId))];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SEARCH STUDENTS — for manual add in structured boards
  // ═══════════════════════════════════════════════════════════════════════════

  async searchStudentsForBoard(boardId: string, teacherId: string, institutionId: string, query: string) {
    const board = await this.validateBoardOwnership(boardId, teacherId, institutionId);

    // Get all student IDs in scope
    const scopeStudentIds = await this.resolveStudentsByScope(board, institutionId);
    if (!scopeStudentIds.length) return [];

    // Get already added student record IDs
    const existingItems = await this.prisma.workspaceItem.findMany({
      where: { boardId, isArchived: false },
      select: { metadata: true },
    });
    const existingSet = new Set(
      existingItems.map(e => ((e.metadata as any)?.studentRecordId || '')).filter(Boolean),
    );

    // Filter to only students not already in board
    const availableIds = scopeStudentIds.filter(id => !existingSet.has(id));
    if (!availableIds.length) return [];

    // Search by name
    const searchFilter = query.trim()
      ? {
          OR: [
            { firstName: { contains: query.trim(), mode: 'insensitive' as const } },
            { lastName: { contains: query.trim(), mode: 'insensitive' as const } },
            { secondLastName: { contains: query.trim(), mode: 'insensitive' as const } },
          ],
        }
      : {};

    const students = await this.prisma.student.findMany({
      where: { id: { in: availableIds }, isActive: true, ...searchFilter },
      select: { id: true, userId: true, firstName: true, secondName: true, lastName: true, secondLastName: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: 20,
    });

    return students.map(s => ({
      studentRecordId: s.id,
      userId: s.userId,
      fullName: [s.lastName, s.secondLastName, s.firstName, s.secondName].filter(Boolean).join(' '),
    }));
  }

  async addStudentToBoard(boardId: string, teacherId: string, institutionId: string, studentRecordId: string) {
    const board = await this.validateBoardOwnership(boardId, teacherId, institutionId);

    if (!['MICRO_COLLECT', 'CLASSROOM_ROLES'].includes(board.type)) {
      throw new BadRequestException('Solo tableros estructurados soportan agregar estudiantes');
    }

    // Check not already added
    const existingItems = await this.prisma.workspaceItem.findMany({
      where: { boardId, isArchived: false },
      select: { metadata: true, sortOrder: true },
    });
    const alreadyAdded = existingItems.some(e => (e.metadata as any)?.studentRecordId === studentRecordId);
    if (alreadyAdded) throw new BadRequestException('El estudiante ya está en el tablero');

    // Get student info
    const student = await this.prisma.student.findUnique({
      where: { id: studentRecordId },
      select: { id: true, userId: true, firstName: true, secondName: true, lastName: true, secondLastName: true },
    });
    if (!student) throw new NotFoundException('Estudiante no encontrado');

    const fullName = [student.lastName, student.secondLastName, student.firstName, student.secondName].filter(Boolean).join(' ');

    // Get first column
    const firstCol = await this.prisma.workspaceColumn.findFirst({
      where: { boardId },
      orderBy: { sortOrder: 'asc' },
    });

    let itemMeta: any = { studentRecordId: student.id };
    if (board.type === 'MICRO_COLLECT') {
      itemMeta = { ...itemMeta, amountPaid: 0, status: 'PENDING' };
    } else if (board.type === 'CLASSROOM_ROLES') {
      itemMeta = { ...itemMeta, role: '' };
    }

    const maxSort = existingItems.reduce((max, e) => Math.max(max, e.sortOrder), 0);

    return this.prisma.workspaceItem.create({
      data: {
        boardId,
        columnId: firstCol?.id || null,
        studentId: student.userId || null,
        title: fullName,
        metadata: itemMeta,
        sortOrder: maxSort + 100,
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUMMARY — aggregated stats for structured boards
  // ═══════════════════════════════════════════════════════════════════════════

  async getBoardSummary(boardId: string, teacherId: string, institutionId: string) {
    const board = await this.validateBoardOwnership(boardId, teacherId, institutionId);
    const boardMeta = (board.metadata || {}) as any;

    const items = await this.prisma.workspaceItem.findMany({
      where: { boardId, isArchived: false },
      select: { metadata: true, status: true },
    });

    if (board.type === 'MICRO_COLLECT') {
      const perStudent = Number(boardMeta.goalAmount) || 0; // per-student value
      const totalGoal = perStudent * items.length; // auto-calculated total
      let totalCollected = 0;
      let paidCount = 0;
      let pendingCount = 0;
      let partialCount = 0;

      for (const item of items) {
        const meta = (item.metadata || {}) as any;
        const amt = Number(meta.amountPaid) || 0;
        totalCollected += amt;
        if (meta.status === 'PAID') paidCount++;
        else if (meta.status === 'PARTIAL') partialCount++;
        else pendingCount++;
      }

      return {
        type: 'MICRO_COLLECT',
        perStudent,
        goalAmount: totalGoal,
        totalCollected,
        percentage: totalGoal > 0 ? Math.round((totalCollected / totalGoal) * 100) : 0,
        totalStudents: items.length,
        paidCount,
        partialCount,
        pendingCount,
      };
    }

    if (board.type === 'CLASSROOM_ROLES') {
      const roles = boardMeta.roles || [];
      const roleCounts: Record<string, number> = {};
      let assignedCount = 0;

      for (const item of items) {
        const meta = (item.metadata || {}) as any;
        const role = meta.role || '';
        if (role) {
          roleCounts[role] = (roleCounts[role] || 0) + 1;
          assignedCount++;
        }
      }

      return {
        type: 'CLASSROOM_ROLES',
        totalStudents: items.length,
        assignedCount,
        unassignedCount: items.length - assignedCount,
        roleCounts,
        availableRoles: roles,
      };
    }

    // Generic summary for other types
    const statusCounts: Record<string, number> = {};
    for (const item of items) {
      statusCounts[item.status] = (statusCounts[item.status] || 0) + 1;
    }
    return { type: board.type, totalItems: items.length, statusCounts };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CALENDAR — aggregated view of events across all boards
  // ═══════════════════════════════════════════════════════════════════════════

  async getCalendarEvents(teacherId: string, institutionId: string, from: Date, to: Date) {
    // Items with dueDate or eventDate in range
    const items = await this.prisma.workspaceItem.findMany({
      where: {
        board: { teacherId, institutionId, isArchived: false },
        isArchived: false,
        OR: [
          { dueDate: { gte: from, lte: to } },
          { eventDate: { gte: from, lte: to } },
        ],
      },
      select: {
        id: true, title: true, dueDate: true, eventDate: true, status: true, metadata: true,
        board: { select: { id: true, title: true, type: true, color: true } },
      },
      orderBy: { dueDate: 'asc' },
    });

    // Boards with startDate/endDate overlapping range
    const boards = await this.prisma.workspaceBoard.findMany({
      where: {
        teacherId, institutionId, isArchived: false,
        OR: [
          { startDate: { gte: from, lte: to } },
          { endDate: { gte: from, lte: to } },
          { AND: [{ startDate: { lte: from } }, { endDate: { gte: to } }] },
        ],
      },
      select: { id: true, title: true, type: true, color: true, startDate: true, endDate: true },
    });

    // Normalize to unified event format
    const events: any[] = [];

    for (const item of items) {
      events.push({
        id: item.id,
        source: 'item',
        title: item.title,
        date: item.eventDate || item.dueDate,
        endDate: null,
        status: item.status,
        boardId: item.board.id,
        boardTitle: item.board.title,
        boardType: item.board.type,
        color: item.board.color,
      });
    }

    for (const b of boards) {
      events.push({
        id: b.id,
        source: 'board',
        title: b.title,
        date: b.startDate,
        endDate: b.endDate,
        status: null,
        boardId: b.id,
        boardTitle: b.title,
        boardType: b.type,
        color: b.color,
      });
    }

    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return events;
  }
}
