import { Body, Controller, Delete, Get, Param, Post, Put, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PedagogicalDesignService } from './pedagogical-design.service';
import { GenerateDesignDto, UpdateDesignDto } from './dto/pedagogical-design.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveInstitutionId } from '../../common/utils/institution-resolver';

@Controller('pedagogical-design')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('DOCENTE', 'COORDINADOR')
export class PedagogicalDesignController {
  constructor(
    private readonly service: PedagogicalDesignService,
    private readonly prisma: PrismaService,
  ) {}

  private async resolveCtx(req: any) {
    const teacherId = req.user.id;
    const institutionId = await resolveInstitutionId(this.prisma as any, req);
    if (!institutionId) throw new Error('No se pudo resolver la institución');
    return { teacherId, institutionId };
  }

  @Post('generate')
  async generate(@Request() req: any, @Body() dto: GenerateDesignDto) {
    const { teacherId, institutionId } = await this.resolveCtx(req);
    return this.service.generate(teacherId, institutionId, dto);
  }

  @Get()
  async list(@Request() req: any, @Query('boardId') boardId?: string) {
    const { teacherId, institutionId } = await this.resolveCtx(req);
    return this.service.list(teacherId, institutionId, boardId);
  }

  @Get(':id')
  async getOne(@Request() req: any, @Param('id') id: string) {
    const { teacherId, institutionId } = await this.resolveCtx(req);
    return this.service.getOne(id, teacherId, institutionId);
  }

  @Put(':id')
  async update(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateDesignDto) {
    const { teacherId, institutionId } = await this.resolveCtx(req);
    return this.service.update(id, teacherId, institutionId, dto);
  }

  @Delete(':id')
  async remove(@Request() req: any, @Param('id') id: string) {
    const { teacherId, institutionId } = await this.resolveCtx(req);
    return this.service.remove(id, teacherId, institutionId);
  }
}
