import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AchievementBankService } from './achievement-bank.service';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveInstitutionId } from '../../common/utils/institution-resolver';

@Controller('achievement-bank')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AchievementBankController {
  constructor(
    private readonly bankService: AchievementBankService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async search(
    @Request() req,
    @Query('subjectId') subjectId?: string,
    @Query('areaId') areaId?: string,
    @Query('gradeId') gradeId?: string,
    @Query('achievementType') achievementType?: string,
    @Query('performanceLevel') performanceLevel?: string,
    @Query('category') category?: string,
    @Query('query') query?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const institutionId = await resolveInstitutionId(this.prisma as any, req) || req.user.institutionId;
    const userId = req.user.sub || req.user.id;
    return this.bankService.search({
      institutionId: institutionId!,
      userId,
      subjectId,
      areaId,
      gradeId,
      achievementType,
      performanceLevel,
      category,
      query,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
    });
  }

  @Get('categories')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getCategories(@Request() req) {
    const institutionId = await resolveInstitutionId(this.prisma as any, req) || req.user.institutionId;
    return this.bankService.getCategories(institutionId!);
  }

  @Post()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async create(@Request() req, @Body() body: any) {
    const institutionId = await resolveInstitutionId(this.prisma as any, req) || req.user.institutionId;
    const userId = req.user.sub || req.user.id;
    return this.bankService.create({
      ...body,
      institutionId,
      createdById: userId,
    });
  }

  @Post('bulk')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async bulkCreate(@Request() req, @Body() body: { entries: any[] }) {
    const institutionId = await resolveInstitutionId(this.prisma as any, req) || req.user.institutionId;
    const userId = req.user.sub || req.user.id;
    const entries = (body.entries || []).map(e => ({
      ...e,
      institutionId,
      createdById: userId,
    }));
    return this.bankService.bulkCreate(entries);
  }

  @Put(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async update(@Request() req, @Param('id') id: string, @Body() body: any) {
    const userId = req.user.sub || req.user.id;
    return this.bankService.update(id, userId, body);
  }

  @Delete(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async remove(@Request() req, @Param('id') id: string) {
    const userId = req.user.sub || req.user.id;
    const userRoles = req.user.roles?.map((r: any) => r.role?.name || r.name || r) || [];
    const isAdmin = userRoles.some((r: string) =>
      r.includes('ADMIN') || r.includes('SUPERADMIN') || r.includes('COORDINADOR'),
    );
    return this.bankService.delete(id, userId, isAdmin);
  }

  @Post(':id/use')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async incrementUsage(@Param('id') id: string) {
    return this.bankService.incrementUsage(id);
  }
}
