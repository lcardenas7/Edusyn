import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Request, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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

  @Get('personal-space')
  async getPersonalSpace(@Request() req: any) {
    const { teacherId, institutionId } = await this.resolveCtx(req);
    return this.service.getOrCreatePersonalSpace(teacherId, institutionId);
  }

  @Get('search')
  async globalSearch(@Request() req: any, @Query('q') q: string) {
    const { teacherId, institutionId } = await this.resolveCtx(req);
    return this.service.globalSearch(teacherId, institutionId, q);
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

  // ── Biblioteca ──────────────────────────────────────────────────────────────
  @Get('resources')
  async listResources(@Request() req: any, @Query('boardId') boardId: string, @Query('folderId') folderId?: string) {
    const { teacherId, institutionId } = await this.resolveCtx(req);
    return this.service.listResources(boardId, teacherId, institutionId, folderId);
  }

  @Post('resource-folders')
  async createFolder(@Request() req: any, @Body() dto: any) {
    const { teacherId, institutionId } = await this.resolveCtx(req);
    return this.service.createFolder(teacherId, institutionId, dto);
  }

  @Delete('resource-folders/:id')
  async deleteFolder(@Request() req: any, @Param('id') id: string) {
    const { teacherId, institutionId } = await this.resolveCtx(req);
    return this.service.deleteFolder(id, teacherId, institutionId);
  }

  @Post('resources/link')
  async addLink(@Request() req: any, @Body() dto: any) {
    const { teacherId, institutionId } = await this.resolveCtx(req);
    return this.service.addLinkResource(teacherId, institutionId, dto);
  }

  @Post('resources/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadResource(
    @Request() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Body('boardId') boardId: string,
    @Body('folderId') folderId?: string,
    @Body('name') name?: string,
    @Body('tags') tags?: string,
  ) {
    const { teacherId, institutionId } = await this.resolveCtx(req);
    const parsedTags = tags ? (typeof tags === 'string' ? tags.split(',').map((t) => t.trim()).filter(Boolean) : tags) : [];
    return this.service.uploadResource(teacherId, institutionId, file, { boardId, folderId, name, tags: parsedTags });
  }

  @Get('resources/:id/download')
  async downloadResource(@Request() req: any, @Param('id') id: string) {
    const { teacherId, institutionId } = await this.resolveCtx(req);
    return this.service.getResourceDownloadUrl(id, teacherId, institutionId);
  }

  @Patch('resources/:id')
  async updateResource(@Request() req: any, @Param('id') id: string, @Body() dto: any) {
    const { teacherId, institutionId } = await this.resolveCtx(req);
    return this.service.updateResource(id, teacherId, institutionId, dto);
  }

  @Delete('resources/:id')
  async deleteResource(@Request() req: any, @Param('id') id: string) {
    const { teacherId, institutionId } = await this.resolveCtx(req);
    return this.service.deleteResource(id, teacherId, institutionId);
  }

  // ── Proyecto ────────────────────────────────────────────────────────────────
  @Get('projects')
  async listProjects(@Request() req: any, @Query('boardId') boardId: string) {
    const { teacherId, institutionId } = await this.resolveCtx(req);
    return this.service.listProjects(boardId, teacherId, institutionId);
  }

  @Post('projects')
  async createProject(@Request() req: any, @Body() dto: any) {
    const { teacherId, institutionId } = await this.resolveCtx(req);
    return this.service.createProject(teacherId, institutionId, dto);
  }

  @Get('projects/:id')
  async getProject(@Request() req: any, @Param('id') id: string) {
    const { teacherId, institutionId } = await this.resolveCtx(req);
    return this.service.getProject(id, teacherId, institutionId);
  }

  @Put('projects/:id')
  async updateProject(@Request() req: any, @Param('id') id: string, @Body() dto: any) {
    const { teacherId, institutionId } = await this.resolveCtx(req);
    return this.service.updateProject(id, teacherId, institutionId, dto);
  }

  @Delete('projects/:id')
  async deleteProject(@Request() req: any, @Param('id') id: string) {
    const { teacherId, institutionId } = await this.resolveCtx(req);
    return this.service.deleteProject(id, teacherId, institutionId);
  }

  @Post('projects/:id/tasks')
  async addProjectTask(@Request() req: any, @Param('id') id: string, @Body() dto: any) {
    const { teacherId, institutionId } = await this.resolveCtx(req);
    return this.service.addProjectTask(id, teacherId, institutionId, dto);
  }

  @Patch('project-tasks/:id/toggle')
  async toggleProjectTask(@Request() req: any, @Param('id') id: string) {
    const { teacherId, institutionId } = await this.resolveCtx(req);
    return this.service.toggleProjectTask(id, teacherId, institutionId);
  }

  @Delete('project-tasks/:id')
  async deleteProjectTask(@Request() req: any, @Param('id') id: string) {
    const { teacherId, institutionId } = await this.resolveCtx(req);
    return this.service.deleteProjectTask(id, teacherId, institutionId);
  }

  @Post('projects/:id/members')
  async addProjectMember(@Request() req: any, @Param('id') id: string, @Body() dto: any) {
    const { teacherId, institutionId } = await this.resolveCtx(req);
    return this.service.addProjectMember(id, teacherId, institutionId, dto);
  }

  @Delete('project-members/:id')
  async removeProjectMember(@Request() req: any, @Param('id') id: string) {
    const { teacherId, institutionId } = await this.resolveCtx(req);
    return this.service.removeProjectMember(id, teacherId, institutionId);
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
  async deleteBoard(@Request() req: any, @Param('id') id: string, @Query('force') force?: string) {
    const { teacherId, institutionId } = await this.resolveCtx(req);
    return this.service.deleteBoard(id, teacherId, institutionId, force === 'true');
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
