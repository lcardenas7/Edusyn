import { Injectable, ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBoardDto, UpdateBoardDto, CreateColumnDto, UpdateColumnDto, CreateItemDto, UpdateItemDto, MoveItemDto } from './dto/workspace.dto';
import { WorkspaceBoardType, WorkspaceScopeType } from '@prisma/client';

@Injectable()
export class TeacherWorkspaceService {
  constructor(private prisma: PrismaService) {}

  private getSeatingNumber(row: number, col: number, rows: number, columns: number, rowSizes?: number[]) {
    const sizes = Array.isArray(rowSizes) && rowSizes.length === rows
      ? rowSizes
      : Array.from({ length: rows }, () => columns);

    let offset = 0;
    for (let r = row + 1; r < rows; r++) {
      offset += Math.max(1, Number(sizes[r]) || columns);
    }

    return offset + col + 1;
  }

  private isSeatingBoard(board: { type: string; metadata?: any }) {
    return board.type === 'KANBAN' && ((board.metadata || {}) as any)?.template === 'CLASSROOM_SEATING';
  }

  private getSeatingConfig(board: any) {
    const boardMeta = (board.metadata || {}) as any;
    const seating = boardMeta.seating || {};
    const rows = Math.max(1, Number(seating.rows) || 6);
    const columns = Math.max(1, Number(seating.columns) || 6);
    const rowSizes = Array.isArray(seating.rowSizes) && seating.rowSizes.length === rows
      ? seating.rowSizes.map((value: any) => Math.max(1, Number(value) || columns))
      : Array.from({ length: rows }, () => columns);
    const seatMap = new Map<string, any>();

    if (Array.isArray(seating.seats)) {
      for (const seat of seating.seats) {
        if (typeof seat?.row === 'number' && typeof seat?.col === 'number') {
          seatMap.set(`${seat.row}:${seat.col}`, seat);
        }
      }
    }

    const seats: any[] = [];
    for (let row = 0; row < rows; row++) {
      const rowLength = Math.max(1, Number(rowSizes[row]) || columns);
      for (let col = 0; col < rowLength; col++) {
        const existing = seatMap.get(`${row}:${col}`) || {};
        seats.push({
          id: existing.id || `seat-${row}-${col}`,
          row,
          col,
          number: typeof existing.number === 'number' ? existing.number : this.getSeatingNumber(row, col, rows, columns, rowSizes),
          studentRecordId: existing.studentRecordId || null,
          studentName: existing.studentName || null,
          workSide: existing.workSide || 'RIGHT',
          blocked: !!existing.blocked,
        });
      }
    }

    return {
      rows,
      columns,
      rowSizes,
      boardPosition: seating.boardPosition || 'BOTTOM',
      numberingMode: seating.numberingMode || 'COLUMN_MAJOR_LEFT',
      seats,
    };
  }

  private buildSeatingMetadata(board: any, seatingConfig: ReturnType<TeacherWorkspaceService['getSeatingConfig']>) {
    const boardMeta = (board.metadata || {}) as any;
    return {
      ...boardMeta,
      template: 'CLASSROOM_SEATING',
      seating: {
        rows: seatingConfig.rows,
        columns: seatingConfig.columns,
        rowSizes: seatingConfig.rowSizes,
        boardPosition: seatingConfig.boardPosition,
        numberingMode: seatingConfig.numberingMode,
        seats: seatingConfig.seats.map((seat: any) => ({
          id: seat.id,
          row: seat.row,
          col: seat.col,
          studentRecordId: seat.studentRecordId || null,
          studentName: seat.studentName || null,
          workSide: seat.workSide || 'RIGHT',
          blocked: !!seat.blocked,
        })),
      },
    };
  }

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

    const isSeatingBoard = dto.type === 'KANBAN' && ((metadata || {}) as any)?.template === 'CLASSROOM_SEATING';

    // STUDENT_NOTES: auto-create columns per assigned group
    let colDefs: { title: string; color?: string; metadata?: any }[];
    if (isSeatingBoard) {
      colDefs = [{ title: 'Salón' }];
    } else if (dto.type === 'STUDENT_NOTES') {
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
        // WORKSPACE_V2
        ...(dto.emoji !== undefined && { emoji: dto.emoji }),
        ...(dto.bannerColor !== undefined && { bannerColor: dto.bannerColor }),
        ...(dto.coverImage !== undefined && { coverImage: dto.coverImage }),
        ...(dto.isPinned !== undefined && { isPinned: dto.isPinned }),
        ...(dto.enabledModules !== undefined && { enabledModules: dto.enabledModules }),
      },
    });
  }

  async deleteBoard(boardId: string, teacherId: string, institutionId: string) {
    await this.validateBoardOwnership(boardId, teacherId, institutionId);
    await this.prisma.workspaceBoard.delete({ where: { id: boardId } });
    return { success: true };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DASHBOARD — "Centro del día". Una sola tanda de queries indexadas (sin N+1).
  // Responde: ¿qué hago hoy? ¿qué tengo pendiente? ¿qué curso necesita atención?
  // ═══════════════════════════════════════════════════════════════════════════
  async getToday(teacherId: string, institutionId: string) {
    const boards = await this.prisma.workspaceBoard.findMany({
      where: { teacherId, institutionId, isArchived: false },
      include: {
        group: { select: { name: true, grade: { select: { name: true } } } },
        _count: { select: { items: { where: { isArchived: false } } } },
      },
      orderBy: [{ isPinned: 'desc' }, { lastAccessedAt: 'desc' }, { updatedAt: 'desc' }],
    });
    const boardIds = boards.map((b) => b.id);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    const STALE_DAYS = 14;
    const staleCutoff = new Date(Date.now() - STALE_DAYS * 86400000);

    const [pendingItems, events, followUps, collectionItems, recentItems] = await Promise.all([
      boardIds.length
        ? this.prisma.workspaceItem.findMany({
            where: {
              boardId: { in: boardIds }, isArchived: false,
              status: { not: 'DONE' },
              OR: [{ dueDate: { lte: endOfToday } }, { eventDate: { lte: endOfToday } }],
            },
            include: { board: { select: { id: true, title: true, emoji: true } } },
            orderBy: [{ dueDate: 'asc' }],
            take: 25,
          })
        : Promise.resolve([]),
      this.prisma.workspaceEvent.findMany({
        where: { teacherId, done: false, isArchived: false, date: { lte: endOfToday } },
        orderBy: { date: 'asc' }, take: 25,
      }),
      this.prisma.workspaceFollowUp.findMany({
        where: { teacherId, status: { not: 'DONE' }, isArchived: false },
        include: { board: { select: { id: true, title: true } } },
        orderBy: [{ dueDate: 'asc' }], take: 25,
      }),
      boardIds.length
        ? this.prisma.workspaceItem.findMany({
            where: { boardId: { in: boardIds }, isArchived: false, kind: 'COLLECTION' },
            select: { id: true, amount: true, amountCollected: true, metadata: true },
          })
        : Promise.resolve([]),
      // Actividad reciente — últimos elementos tocados (mira hacia atrás)
      boardIds.length
        ? this.prisma.workspaceItem.findMany({
            where: { boardId: { in: boardIds }, isArchived: false },
            include: { board: { select: { id: true, title: true, emoji: true } } },
            orderBy: { updatedAt: 'desc' },
            take: 8,
          })
        : Promise.resolve([]),
    ]);

    // Recaudo: pendiente = recaudado < meta (mira columna y metadata legacy)
    let recaudoPendingCount = 0;
    let recaudoPendingAmount = 0;
    for (const it of collectionItems as any[]) {
      const meta = (it.metadata || {}) as any;
      const target = it.amount != null ? Number(it.amount) : Number(meta.amountTarget ?? 0);
      const paid = it.amountCollected != null ? Number(it.amountCollected) : Number(meta.amountPaid ?? 0);
      if (target > 0 && paid < target) {
        recaudoPendingCount++;
        recaudoPendingAmount += target - paid;
      }
    }

    // Inteligencia funcional (sin IA): espacios sin actividad reciente
    const staleSpaces = boards
      .filter((b) => b.updatedAt && b.updatedAt < staleCutoff && (b as any)._count.items > 0)
      .slice(0, 5)
      .map((b) => ({ id: b.id, title: b.title, emoji: b.emoji, lastActivity: b.updatedAt }));

    return {
      spaces: boards.map((b) => ({
        id: b.id,
        title: b.title,
        emoji: b.emoji,
        color: b.color,
        type: b.type,
        isPinned: b.isPinned,
        isPersonal: b.isPersonal,
        isCourseSpace: b.isCourseSpace,
        enabledModules: b.enabledModules,
        groupName: b.group?.name ?? null,
        gradeName: b.group?.grade?.name ?? null,
        itemsCount: (b as any)._count.items,
        updatedAt: b.updatedAt,
      })),
      pendingItems: (pendingItems as any[]).map((i) => ({
        id: i.id, title: i.title, dueDate: i.dueDate, eventDate: i.eventDate,
        boardId: i.boardId, boardTitle: i.board?.title, boardEmoji: i.board?.emoji,
      })),
      events,
      followUps,
      recentActivity: (recentItems as any[]).map((i) => ({
        id: i.id, title: i.title, kind: i.kind, updatedAt: i.updatedAt,
        boardId: i.boardId, boardTitle: i.board?.title, boardEmoji: i.board?.emoji,
      })),
      recaudo: { pendingCount: recaudoPendingCount, pendingAmount: recaudoPendingAmount },
      insights: {
        staleSpaces,
        tooManyFollowUps: followUps.length >= 8,
      },
      counts: {
        spaces: boards.length,
        pendingItems: (pendingItems as any[]).length,
        events: (events as any[]).length,
        followUps: (followUps as any[]).length,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CALENDARIO — WorkspaceEvent (privado del docente) + fechas oficiales (read-only)
  // ═══════════════════════════════════════════════════════════════════════════

  async listEvents(teacherId: string, institutionId: string, from?: string, to?: string) {
    const fromDate = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
    const toDate = to ? new Date(to) : new Date(new Date().getFullYear(), new Date().getMonth() + 2, 0);

    const events = await this.prisma.workspaceEvent.findMany({
      where: {
        teacherId,
        isArchived: false,
        date: { gte: fromDate, lte: toDate },
      },
      include: { board: { select: { id: true, title: true, emoji: true } } },
      orderBy: { date: 'asc' },
    });

    // Fechas oficiales del período (solo lectura — no editables por el docente)
    const officialTerms = await this.prisma.academicTerm.findMany({
      where: {
        academicYear: { institutionId, status: 'ACTIVE' },
        OR: [
          { startDate: { gte: fromDate, lte: toDate } },
          { endDate: { gte: fromDate, lte: toDate } },
        ],
      },
      select: { id: true, name: true, startDate: true, endDate: true },
    });
    const officialDates = officialTerms.flatMap((t) => {
      const out: Array<{ date: Date; label: string; kind: string }> = [];
      if (t.startDate && t.startDate >= fromDate && t.startDate <= toDate) out.push({ date: t.startDate, label: `Inicia ${t.name}`, kind: 'TERM_START' });
      if (t.endDate && t.endDate >= fromDate && t.endDate <= toDate) out.push({ date: t.endDate, label: `Cierra ${t.name}`, kind: 'TERM_END' });
      return out;
    });

    return { events, officialDates };
  }

  async createEvent(teacherId: string, institutionId: string, dto: {
    title: string; date: string; type?: string; boardId?: string; itemId?: string; allDay?: boolean;
  }) {
    if (!dto.title?.trim()) throw new BadRequestException('El evento necesita un título');
    if (!dto.date) throw new BadRequestException('El evento necesita una fecha');
    if (dto.boardId) await this.validateBoardOwnership(dto.boardId, teacherId, institutionId);
    return this.prisma.workspaceEvent.create({
      data: {
        institutionId,
        teacherId,
        boardId: dto.boardId || null,
        itemId: dto.itemId || null,
        title: dto.title.trim(),
        date: new Date(dto.date),
        allDay: dto.allDay ?? true,
        type: (dto.type as any) || 'REMINDER',
      },
    });
  }

  async updateEvent(eventId: string, teacherId: string, dto: {
    title?: string; date?: string; type?: string; done?: boolean; isArchived?: boolean;
  }) {
    const ev = await this.prisma.workspaceEvent.findUnique({ where: { id: eventId } });
    if (!ev || ev.teacherId !== teacherId) throw new NotFoundException('Evento no encontrado');
    return this.prisma.workspaceEvent.update({
      where: { id: eventId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.date !== undefined && { date: new Date(dto.date) }),
        ...(dto.type !== undefined && { type: dto.type as any }),
        ...(dto.done !== undefined && { done: dto.done }),
        ...(dto.isArchived !== undefined && { isArchived: dto.isArchived }),
      },
    });
  }

  async deleteEvent(eventId: string, teacherId: string) {
    const ev = await this.prisma.workspaceEvent.findUnique({ where: { id: eventId } });
    if (!ev || ev.teacherId !== teacherId) throw new NotFoundException('Evento no encontrado');
    await this.prisma.workspaceEvent.delete({ where: { id: eventId } });
    return { success: true };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SEGUIMIENTOS — WorkspaceFollowUp (transversal, motor del dashboard)
  // Cualquier módulo puede generar uno. No toca el observador oficial.
  // ═══════════════════════════════════════════════════════════════════════════

  async listFollowUps(teacherId: string, params: { status?: string; boardId?: string; includeResolved?: boolean }) {
    return this.prisma.workspaceFollowUp.findMany({
      where: {
        teacherId,
        isArchived: false,
        ...(params.boardId && { boardId: params.boardId }),
        ...(params.status
          ? { status: params.status as any }
          : params.includeResolved
            ? {}
            : { status: { not: 'DONE' } }),
      },
      include: { board: { select: { id: true, title: true, emoji: true } } },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async createFollowUp(teacherId: string, institutionId: string, dto: {
    title: string; notes?: string; dueDate?: string; boardId?: string;
    sourceType?: string; sourceItemId?: string; studentId?: string;
  }) {
    if (!dto.title?.trim()) throw new BadRequestException('El seguimiento necesita un título');
    if (dto.boardId) await this.validateBoardOwnership(dto.boardId, teacherId, institutionId);
    return this.prisma.workspaceFollowUp.create({
      data: {
        institutionId,
        teacherId,
        boardId: dto.boardId || null,
        sourceType: (dto.sourceType as any) || 'MANUAL',
        sourceItemId: dto.sourceItemId || null,
        studentId: dto.studentId || null,
        title: dto.title.trim(),
        notes: dto.notes || null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      },
    });
  }

  async updateFollowUp(id: string, teacherId: string, dto: {
    title?: string; notes?: string; dueDate?: string | null; status?: string; isArchived?: boolean;
  }) {
    const fu = await this.prisma.workspaceFollowUp.findUnique({ where: { id } });
    if (!fu || fu.teacherId !== teacherId) throw new NotFoundException('Seguimiento no encontrado');
    return this.prisma.workspaceFollowUp.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.dueDate !== undefined && { dueDate: dto.dueDate ? new Date(dto.dueDate) : null }),
        ...(dto.status !== undefined && {
          status: dto.status as any,
          resolvedAt: dto.status === 'DONE' ? new Date() : null,
        }),
        ...(dto.isArchived !== undefined && { isArchived: dto.isArchived }),
      },
    });
  }

  async deleteFollowUp(id: string, teacherId: string) {
    const fu = await this.prisma.workspaceFollowUp.findUnique({ where: { id } });
    if (!fu || fu.teacherId !== teacherId) throw new NotFoundException('Seguimiento no encontrado');
    await this.prisma.workspaceFollowUp.delete({ where: { id } });
    return { success: true };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RECAUDO — sub-dominio relacional. Meta = unitValue × nº cargos (automática).
  // ═══════════════════════════════════════════════════════════════════════════

  private chargeStatus(collected: number, unit: number): string {
    if (unit <= 0) return 'PENDING';
    if (collected >= unit) return 'PAID';
    if (collected > 0) return 'PARTIAL';
    return 'PENDING';
  }

  private async fetchStudentNames(studentIds: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (!studentIds.length) return map;
    const students = await this.prisma.student.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, firstName: true, secondName: true, lastName: true, secondLastName: true },
    });
    for (const s of students) {
      const name = [s.lastName, s.secondLastName, s.firstName, s.secondName].filter(Boolean).join(' ');
      map.set(s.id, name.toUpperCase() || 'Estudiante');
    }
    return map;
  }

  private summarizeCollection(c: any) {
    const unit = Number(c.unitValue);
    let totalCollected = 0;
    let paidCount = 0;
    const charges = (c.charges ?? []).map((ch: any) => {
      const collected = (ch.payments ?? []).reduce((acc: number, p: any) => acc + Number(p.amount), 0);
      totalCollected += collected;
      const status = this.chargeStatus(collected, unit);
      if (status === 'PAID') paidCount++;
      return {
        id: ch.id, studentId: ch.studentId, studentName: ch.studentName,
        collected, unitValue: unit, status,
        payments: (ch.payments ?? []).map((p: any) => ({ id: p.id, amount: Number(p.amount), paidAt: p.paidAt, note: p.note })),
      };
    });
    const meta = unit * charges.length;
    return {
      id: c.id, boardId: c.boardId, name: c.name, description: c.description,
      unitValue: unit, dueDate: c.dueDate, isArchived: c.isArchived,
      chargesCount: charges.length, meta, totalCollected, paidCount,
      progress: meta > 0 ? Math.min(100, Math.round((totalCollected / meta) * 100)) : 0,
      charges,
    };
  }

  async listCollections(boardId: string, teacherId: string, institutionId: string) {
    await this.validateBoardOwnership(boardId, teacherId, institutionId);
    const collections = await this.prisma.workspaceCollection.findMany({
      where: { boardId, isArchived: false },
      include: { charges: { include: { payments: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return collections.map((c) => this.summarizeCollection(c));
  }

  async createCollection(teacherId: string, institutionId: string, dto: {
    boardId: string; name: string; description?: string; unitValue: number; dueDate?: string;
    assign?: 'ALL' | string[];
  }) {
    const board = await this.validateBoardOwnership(dto.boardId, teacherId, institutionId);
    if (!dto.name?.trim()) throw new BadRequestException('El recaudo necesita un nombre');
    if (!dto.unitValue || dto.unitValue <= 0) throw new BadRequestException('El valor individual debe ser mayor a 0');

    let studentIds: string[] = [];
    if (dto.assign === 'ALL') {
      studentIds = await this.resolveStudentsByScope(board, institutionId);
    } else if (Array.isArray(dto.assign)) {
      studentIds = dto.assign;
    }
    const names = await this.fetchStudentNames(studentIds);

    const collection = await this.prisma.workspaceCollection.create({
      data: {
        boardId: dto.boardId,
        institutionId,
        name: dto.name.trim(),
        description: dto.description || null,
        unitValue: dto.unitValue,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        charges: {
          create: studentIds.map((sid) => ({ studentId: sid, studentName: names.get(sid) ?? 'Estudiante' })),
        },
      },
      include: { charges: { include: { payments: true } } },
    });
    return this.summarizeCollection(collection);
  }

  private async loadCollectionOwned(collectionId: string, teacherId: string, institutionId: string) {
    const c = await this.prisma.workspaceCollection.findUnique({
      where: { id: collectionId },
      include: { charges: { include: { payments: true } } },
    });
    if (!c) throw new NotFoundException('Recaudo no encontrado');
    await this.validateBoardOwnership(c.boardId, teacherId, institutionId);
    return c;
  }

  async getCollection(id: string, teacherId: string, institutionId: string) {
    const c = await this.loadCollectionOwned(id, teacherId, institutionId);
    return this.summarizeCollection(c);
  }

  async updateCollection(id: string, teacherId: string, institutionId: string, dto: {
    name?: string; description?: string; unitValue?: number; dueDate?: string | null; isArchived?: boolean;
  }) {
    await this.loadCollectionOwned(id, teacherId, institutionId);
    const updated = await this.prisma.workspaceCollection.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.unitValue !== undefined && { unitValue: dto.unitValue }),
        ...(dto.dueDate !== undefined && { dueDate: dto.dueDate ? new Date(dto.dueDate) : null }),
        ...(dto.isArchived !== undefined && { isArchived: dto.isArchived }),
      },
      include: { charges: { include: { payments: true } } },
    });
    return this.summarizeCollection(updated);
  }

  async deleteCollection(id: string, teacherId: string, institutionId: string) {
    await this.loadCollectionOwned(id, teacherId, institutionId);
    await this.prisma.workspaceCollection.delete({ where: { id } });
    return { success: true };
  }

  async addStudentsToCollection(id: string, teacherId: string, institutionId: string, studentIds: string[]) {
    const c = await this.loadCollectionOwned(id, teacherId, institutionId);
    const existing = new Set(c.charges.map((ch) => ch.studentId));
    const toAdd = studentIds.filter((s) => !existing.has(s));
    const names = await this.fetchStudentNames(toAdd);
    await this.prisma.workspaceCollectionCharge.createMany({
      data: toAdd.map((sid) => ({ collectionId: id, studentId: sid, studentName: names.get(sid) ?? 'Estudiante' })),
    });
    return this.getCollection(id, teacherId, institutionId);
  }

  async addPayment(chargeId: string, teacherId: string, institutionId: string, dto: { amount: number; note?: string }) {
    const charge = await this.prisma.workspaceCollectionCharge.findUnique({
      where: { id: chargeId },
      include: { collection: true, payments: true },
    });
    if (!charge) throw new NotFoundException('Cargo no encontrado');
    await this.validateBoardOwnership(charge.collection.boardId, teacherId, institutionId);
    if (!dto.amount || dto.amount <= 0) throw new BadRequestException('El pago debe ser mayor a 0');

    await this.prisma.workspaceCollectionPayment.create({
      data: { chargeId, amount: dto.amount, note: dto.note || null },
    });
    // Recalcular estado
    const collected = charge.payments.reduce((acc, p) => acc + Number(p.amount), 0) + dto.amount;
    const status = this.chargeStatus(collected, Number(charge.collection.unitValue));
    await this.prisma.workspaceCollectionCharge.update({ where: { id: chargeId }, data: { status } });

    return this.getCollection(charge.collectionId, teacherId, institutionId);
  }

  async deletePayment(paymentId: string, teacherId: string, institutionId: string) {
    const payment = await this.prisma.workspaceCollectionPayment.findUnique({
      where: { id: paymentId },
      include: { charge: { include: { collection: true, payments: true } } },
    });
    if (!payment) throw new NotFoundException('Pago no encontrado');
    await this.validateBoardOwnership(payment.charge.collection.boardId, teacherId, institutionId);
    await this.prisma.workspaceCollectionPayment.delete({ where: { id: paymentId } });
    const collected = payment.charge.payments.filter((p) => p.id !== paymentId).reduce((acc, p) => acc + Number(p.amount), 0);
    const status = this.chargeStatus(collected, Number(payment.charge.collection.unitValue));
    await this.prisma.workspaceCollectionCharge.update({ where: { id: payment.chargeId }, data: { status } });
    return this.getCollection(payment.charge.collectionId, teacherId, institutionId);
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

    // Escribir kind en la columna (no solo en metadata) — fuente única de verdad.
    const KIND_VALUES = ['NOTE','TASK','OBSERVATION','LOG','COLLECTION','IDEA','LIST','FILE','EVENT'];
    const metaKind = (dto.metadata?.kind || '').toString().toUpperCase();
    const kind = KIND_VALUES.includes(metaKind) ? (metaKind as any) : undefined;

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
        ...(kind && { kind }),
        ...(dto.entryType !== undefined && { entryType: dto.entryType }),
        ...(dto.isImportant !== undefined && { isImportant: dto.isImportant }),
        ...(dto.tags !== undefined && { tags: dto.tags }),
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
        ...(dto.entryType !== undefined && { entryType: dto.entryType }),
        ...(dto.isImportant !== undefined && { isImportant: dto.isImportant }),
        ...(dto.tags !== undefined && { tags: dto.tags }),
        // Estado "Resuelto" sincroniza completedAt
        ...(dto.status === 'DONE' && { completedAt: new Date() }),
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

    if (!['MICRO_COLLECT', 'CLASSROOM_ROLES'].includes(board.type) && !this.isSeatingBoard(board)) {
      throw new BadRequestException('Solo tableros de tipo Micro-recaudo, Roles del Aula u Organizador de salón se pueden poblar');
    }

    if (this.isSeatingBoard(board)) {
      const studentIds = await this.resolveStudentsByScope(board, institutionId);
      if (!studentIds.length) {
        throw new BadRequestException('No se encontraron estudiantes para el alcance seleccionado');
      }

      const seating = this.getSeatingConfig(board);
      const students = await this.prisma.student.findMany({
        where: { id: { in: studentIds }, isActive: true },
        select: { id: true, firstName: true, secondName: true, lastName: true, secondLastName: true },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      });

      const assignedIds = new Set(seating.seats.map((seat: any) => seat.studentRecordId).filter(Boolean));
      const availableStudents = students.filter((s) => !assignedIds.has(s.id));
      const nextSeats = seating.seats
        .slice()
        .sort((a: any, b: any) => a.number - b.number)
        .map((seat: any) => ({ ...seat }));

      let created = 0;
      for (const seat of nextSeats) {
        if (seat.blocked || seat.studentRecordId) continue;
        const student = availableStudents.shift();
        if (!student) break;
        seat.studentRecordId = student.id;
        seat.studentName = [student.lastName, student.secondLastName, student.firstName, student.secondName].filter(Boolean).join(' ');
        seat.workSide = seat.workSide || 'RIGHT';
        created++;
      }

      const metadata = this.buildSeatingMetadata(board, { ...seating, seats: nextSeats });
      await this.prisma.workspaceBoard.update({
        where: { id: boardId },
        data: { metadata },
      });

      return { created, total: seating.seats.length, message: 'Puestos actualizados correctamente' };
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
    let existingSet = new Set<string>();
    if (this.isSeatingBoard(board)) {
      const seating = this.getSeatingConfig(board);
      existingSet = new Set(seating.seats.map((seat: any) => seat.studentRecordId).filter(Boolean));
    } else {
      const existingItems = await this.prisma.workspaceItem.findMany({
        where: { boardId, isArchived: false },
        select: { metadata: true },
      });
      existingSet = new Set(
        existingItems.map(e => ((e.metadata as any)?.studentRecordId || '')).filter(Boolean),
      );
    }

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

    if (!['MICRO_COLLECT', 'CLASSROOM_ROLES'].includes(board.type) && !this.isSeatingBoard(board)) {
      throw new BadRequestException('Solo tableros estructurados soportan agregar estudiantes');
    }

    let existingItems: { metadata: any; sortOrder: number }[] = [];

    // Check not already added
    let alreadyAdded = false;
    if (this.isSeatingBoard(board)) {
      const seating = this.getSeatingConfig(board);
      alreadyAdded = seating.seats.some((seat: any) => seat.studentRecordId === studentRecordId);
    } else {
      existingItems = await this.prisma.workspaceItem.findMany({
        where: { boardId, isArchived: false },
        select: { metadata: true, sortOrder: true },
      });
      alreadyAdded = existingItems.some(e => (e.metadata as any)?.studentRecordId === studentRecordId);
    }
    if (alreadyAdded) throw new BadRequestException('El estudiante ya está en el tablero');

    // Get student info
    const student = await this.prisma.student.findUnique({
      where: { id: studentRecordId },
      select: { id: true, userId: true, firstName: true, secondName: true, lastName: true, secondLastName: true },
    });
    if (!student) throw new NotFoundException('Estudiante no encontrado');

    const fullName = [student.lastName, student.secondLastName, student.firstName, student.secondName].filter(Boolean).join(' ');

    if (this.isSeatingBoard(board)) {
      const seating = this.getSeatingConfig(board);
      const nextSeatIndex = seating.seats
        .slice()
        .sort((a: any, b: any) => a.number - b.number)
        .findIndex((seat: any) => !seat.blocked && !seat.studentRecordId);

      if (nextSeatIndex === -1) {
        throw new BadRequestException('No hay puestos libres en el salón');
      }

      const nextSeats = seating.seats.map((seat: any) => ({ ...seat }));
      const targetSeat = nextSeats.sort((a: any, b: any) => a.number - b.number)[nextSeatIndex];
      targetSeat.studentRecordId = student.id;
      targetSeat.studentName = fullName;
      targetSeat.workSide = targetSeat.workSide || 'RIGHT';

      const metadata = this.buildSeatingMetadata(board, { ...seating, seats: nextSeats });
      await this.prisma.workspaceBoard.update({
        where: { id: boardId },
        data: { metadata },
      });

      return { success: true, seatNumber: targetSeat.number, studentRecordId: student.id, studentName: fullName };
    }

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

    if (this.isSeatingBoard(board)) {
      const seating = this.getSeatingConfig(board);
      const occupiedSeats = seating.seats.filter((seat: any) => seat.studentRecordId && !seat.blocked).length;
      const blockedSeats = seating.seats.filter((seat: any) => seat.blocked).length;
      const leftWorkSideCount = seating.seats.filter((seat: any) => seat.studentRecordId && seat.workSide === 'LEFT').length;
      const rightWorkSideCount = seating.seats.filter((seat: any) => seat.studentRecordId && seat.workSide !== 'LEFT').length;

      return {
        type: 'CLASSROOM_SEATING',
        totalSeats: seating.seats.length,
        occupiedSeats,
        vacantSeats: Math.max(0, seating.rows * seating.columns - occupiedSeats - blockedSeats),
        blockedSeats,
        rows: seating.rows,
        columns: seating.columns,
        occupancyPercentage: seating.seats.length > 0 ? Math.round((occupiedSeats / seating.seats.length) * 100) : 0,
        leftWorkSideCount,
        rightWorkSideCount,
      };
    }

    const items = await this.prisma.workspaceItem.findMany({
      where: { boardId, isArchived: false },
      select: { metadata: true, status: true },
    });

    if (board.type === 'MICRO_COLLECT') {
      const perStudent = Number(boardMeta.goalAmount) || 0; // per-student value
      const totalGoal = perStudent > 0 ? perStudent * items.length : 0;
      let totalCollected = 0;
      let paidCount = 0;
      let pendingCount = 0;
      let partialCount = 0;

      for (const item of items) {
        const meta = (item.metadata || {}) as any;
        const amt = Number(meta.amountPaid) || 0;
        totalCollected += amt;
        // Use actual status from metadata
        if (meta.status === 'PAID') paidCount++;
        else if (meta.status === 'PARTIAL') partialCount++;
        else pendingCount++;
      }

      const percentage = totalGoal > 0
        ? Math.round((totalCollected / totalGoal) * 100)
        : (totalCollected > 0 ? 100 : 0); // if no goal set but money collected, show 100%

      return {
        type: 'MICRO_COLLECT',
        perStudent,
        goalAmount: totalGoal > 0 ? totalGoal : totalCollected, // fallback to actual collected if no goal
        totalCollected,
        percentage,
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
