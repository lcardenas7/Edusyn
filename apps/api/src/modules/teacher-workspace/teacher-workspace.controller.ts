import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TeacherWorkspaceService } from './teacher-workspace.service';
import { CreateBoardDto, UpdateBoardDto, CreateColumnDto, UpdateColumnDto, CreateItemDto, UpdateItemDto, MoveItemDto } from './dto/workspace.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveInstitutionId } from '../../common/utils/institution-resolver';
import { WorkspaceBoardType } from '@prisma/client';

@Controller('teacher-workspace')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('DOCENTE')
export class TeacherWorkspaceController {
  constructor(
    private readonly service: TeacherWorkspaceService,
    private readonly prisma: PrismaService,
  ) {}

  private async resolveCtx(req: any) {
    const teacherId = req.user.id;
    const institutionId = await resolveInstitutionId(this.prisma as any, req);
    if (!institutionId) throw new Error('No se pudo resolver la institución');
    return { teacherId, institutionId };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BOARDS
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('today')
  async getToday(@Request() req: any) {
    const { teacherId, institutionId } = await this.resolveCtx(req);
    return this.service.getToday(teacherId, institutionId);
  }

  // ── Calendario ──────────────────────────────────────────────────────────────
  @Get('events')
  async listEvents(@Request() req: any, @Query('from') from?: string, @Query('to') to?: string) {
    const { teacherId, institutionId } = await this.resolveCtx(req);
    return this.service.listEvents(teacherId, institutionId, from, to);
  }

  @Post('events')
  async createEvent(@Request() req: any, @Body() dto: any) {
    const { teacherId, institutionId } = await this.resolveCtx(req);
    return this.service.createEvent(teacherId, institutionId, dto);
  }

  @Patch('events/:id')
  async updateEvent(@Request() req: any, @Param('id') id: string, @Body() dto: any) {
    const { teacherId } = await this.resolveCtx(req);
    return this.service.updateEvent(id, teacherId, dto);
  }

  @Delete('events/:id')
  async deleteEvent(@Request() req: any, @Param('id') id: string) {
    const { teacherId } = await this.resolveCtx(req);
    return this.service.deleteEvent(id, teacherId);
  }

  // ── Seguimientos ──────────────────────────────────────────────────────────
  @Get('follow-ups')
  async listFollowUps(@Request() req: any, @Query('status') status?: string, @Query('boardId') boardId?: string, @Query('includeResolved') includeResolved?: string) {
    const { teacherId } = await this.resolveCtx(req);
    return this.service.listFollowUps(teacherId, { status, boardId, includeResolved: includeResolved === 'true' });
  }

  @Post('follow-ups')
  async createFollowUp(@Request() req: any, @Body() dto: any) {
    const { teacherId, institutionId } = await this.resolveCtx(req);
    return this.service.createFollowUp(teacherId, institutionId, dto);
  }

  @Patch('follow-ups/:id')
  async updateFollowUp(@Request() req: any, @Param('id') id: string, @Body() dto: any) {
    const { teacherId } = await this.resolveCtx(req);
    return this.service.updateFollowUp(id, teacherId, dto);
  }

  @Delete('follow-ups/:id')
  async deleteFollowUp(@Request() req: any, @Param('id') id: string) {
    const { teacherId } = await this.resolveCtx(req);
    return this.service.deleteFollowUp(id, teacherId);
  }

  // ── Recaudo ────────────────────────────────────────────────────────────────
  @Get('collections')
  async listCollections(@Request() req: any, @Query('boardId') boardId: string) {
    const { teacherId, institutionId } = await this.resolveCtx(req);
    return this.service.listCollections(boardId, teacherId, institutionId);
  }

  @Post('collections')
  async createCollection(@Request() req: any, @Body() dto: any) {
    const { teacherId, institutionId } = await this.resolveCtx(req);
    return this.service.createCollection(teacherId, institutionId, dto);
  }

  @Get('collections/:id')
  async getCollection(@Request() req: any, @Param('id') id: string) {
    const { teacherId, institutionId } = await this.resolveCtx(req);
    return this.service.getCollection(id, teacherId, institutionId);
  }

  @Put('collections/:id')
  async updateCollection(@Request() req: any, @Param('id') id: string, @Body() dto: any) {
    const { teacherId, institutionId } = await this.resolveCtx(req);
    return this.service.updateCollection(id, teacherId, institutionId, dto);
  }

  @Delete('collections/:id')
  async deleteCollection(@Request() req: any, @Param('id') id: string) {
    const { teacherId, institutionId } = await this.resolveCtx(req);
    return this.service.deleteCollection(id, teacherId, institutionId);
  }

  @Post('collections/:id/students')
  async addStudentsToCollection(@Request() req: any, @Param('id') id: string, @Body() body: { studentIds: string[] }) {
    const { teacherId, institutionId } = await this.resolveCtx(req);
    return this.service.addStudentsToCollection(id, teacherId, institutionId, body.studentIds || []);
  }

  @Post('charges/:id/payments')
  async addPayment(@Request() req: any, @Param('id') id: string, @Body() dto: any) {
    const { teacherId, institutionId } = await this.resolveCtx(req);
    return this.service.addPayment(id, teacherId, institutionId, dto);
  }

  @Delete('payments/:id')
  async deletePayment(@Request() req: any, @Param('id') id: string) {
    const { teacherId, institutionId } = await this.resolveCtx(req);
    return this.service.deletePayment(id, teacherId, institutionId);
  }

  // ── Roster + Roles ──────────────────────────────────────────────────────────
  @Get('boards/:id/roster')
  async getRoster(@Request() req: any, @Param('id') id: string) {
    const { teacherId, institutionId } = await this.resolveCtx(req);
    return this.service.getBoardRoster(id, teacherId, institutionId);
  }

  @Get('roles')
  async listRoles(@Request() req: any, @Query('boardId') boardId: string) {
    const { teacherId, institutionId } = await this.resolveCtx(req);
    return this.service.listRoles(boardId, teacherId, institutionId);
  }

  @Post('roles')
  async createRole(@Request() req: any, @Body() dto: any) {
    const { teacherId, institutionId } = await this.resolveCtx(req);
    return this.service.createRole(teacherId, institutionId, dto);
  }

  @Delete('roles/:id')
  async deleteRole(@Request() req: any, @Param('id') id: string) {
    const { teacherId, institutionId } = await this.resolveCtx(req);
    return this.service.deleteRole(id, teacherId, institutionId);
  }

  @Post('roles/:id/assign')
  async assignRole(@Request() req: any, @Param('id') id: string, @Body() dto: any) {
    const { teacherId, institutionId } = await this.resolveCtx(req);
    return this.service.assignRole(id, teacherId, institutionId, dto);
  }

  @Delete('assignments/:id')
  async unassignRole(@Request() req: any, @Param('id') id: string) {
    const { teacherId, institutionId } = await this.resolveCtx(req);
    return this.service.unassignRole(id, teacherId, institutionId);
  }

  @Get('boards')
  async listBoards(
    @Request() req: any,
    @Query('type') type?: WorkspaceBoardType,
    @Query('groupId') groupId?: string,
    @Query('isArchived') isArchived?: string,
  ) {
    const { teacherId, institutionId } = await this.resolveCtx(req);
    return this.service.listBoards(teacherId, institutionId, {
      type,
      groupId,
      isArchived: isArchived === 'true',
    });
  }

  @Get('boards/:id')
  async getBoard(@Request() req: any, @Param('id') id: string) {
    const { teacherId, institutionId } = await this.resolveCtx(req);
    return this.service.getBoard(id, teacherId, institutionId);
  }

  @Post('boards')
  async createBoard(@Request() req: any, @Body() dto: CreateBoardDto) {
    const { teacherId, institutionId } = await this.resolveCtx(req);
    return this.service.createBoard(teacherId, institutionId, dto);
  }

  @Put('boards/:id')
  async updateBoard(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateBoardDto) {
    const { teacherId, institutionId } = await this.resolveCtx(req);
    return this.service.updateBoard(id, teacherId, institutionId, dto);
  }

  @Delete('boards/:id')
  async deleteBoard(@Request() req: any, @Param('id') id: string) {
    const { teacherId, institutionId } = await this.resolveCtx(req);
    return this.service.deleteBoard(id, teacherId, institutionId);
  }

  @Get('scope-options')
  async getScopeOptions(@Request() req: any) {
    const { teacherId, institutionId } = await this.resolveCtx(req);
    return this.service.getScopeOptions(teacherId, institutionId);
  }

  @Post('boards/:id/populate')
  async populateBoard(@Request() req: any, @Param('id') id: string) {
    const { teacherId, institutionId } = await this.resolveCtx(req);
    return this.service.populateBoard(id, teacherId, institutionId);
  }

  @Get('boards/:id/summary')
  async getBoardSummary(@Request() req: any, @Param('id') id: string) {
    const { teacherId, institutionId } = await this.resolveCtx(req);
    return this.service.getBoardSummary(id, teacherId, institutionId);
  }

  @Get('boards/:id/search-students')
  async searchStudents(@Request() req: any, @Param('id') id: string, @Query('q') q: string) {
    const { teacherId, institutionId } = await this.resolveCtx(req);
    return this.service.searchStudentsForBoard(id, teacherId, institutionId, q || '');
  }

  @Post('boards/:id/add-student')
  async addStudent(@Request() req: any, @Param('id') id: string, @Body() body: { studentRecordId: string }) {
    const { teacherId, institutionId } = await this.resolveCtx(req);
    return this.service.addStudentToBoard(id, teacherId, institutionId, body.studentRecordId);
  }

  @Get('calendar')
  async getCalendar(
    @Request() req: any,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const { teacherId, institutionId } = await this.resolveCtx(req);
    return this.service.getCalendarEvents(
      teacherId, institutionId,
      new Date(from), new Date(to),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COLUMNS
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('columns')
  async createColumn(@Request() req: any, @Body() dto: CreateColumnDto) {
    const { teacherId, institutionId } = await this.resolveCtx(req);
    return this.service.createColumn(teacherId, institutionId, dto);
  }

  @Put('columns/:id')
  async updateColumn(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateColumnDto) {
    const { teacherId, institutionId } = await this.resolveCtx(req);
    return this.service.updateColumn(id, teacherId, institutionId, dto);
  }

  @Delete('columns/:id')
  async deleteColumn(@Request() req: any, @Param('id') id: string) {
    const { teacherId, institutionId } = await this.resolveCtx(req);
    return this.service.deleteColumn(id, teacherId, institutionId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ITEMS
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('items')
  async createItem(@Request() req: any, @Body() dto: CreateItemDto) {
    const { teacherId, institutionId } = await this.resolveCtx(req);
    return this.service.createItem(teacherId, institutionId, dto);
  }

  @Put('items/:id')
  async updateItem(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateItemDto) {
    const { teacherId, institutionId } = await this.resolveCtx(req);
    return this.service.updateItem(id, teacherId, institutionId, dto);
  }

  @Patch('items/:id/move')
  async moveItem(@Request() req: any, @Param('id') id: string, @Body() dto: MoveItemDto) {
    const { teacherId, institutionId } = await this.resolveCtx(req);
    return this.service.moveItem(id, teacherId, institutionId, dto);
  }

  @Delete('items/:id')
  async deleteItem(@Request() req: any, @Param('id') id: string) {
    const { teacherId, institutionId } = await this.resolveCtx(req);
    return this.service.deleteItem(id, teacherId, institutionId);
  }
}
