import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { InstitutionalDocumentsService } from './institutional-documents.service';
import type { CreateDocumentDto, UpdateDocumentDto } from './institutional-documents.service';
import { PrismaService } from '../../prisma/prisma.service';
import { requireInstitutionId } from '../../common/utils/institution-resolver';

@Controller('institutional-documents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InstitutionalDocumentsController {
  constructor(
    private readonly documentsService: InstitutionalDocumentsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  @UseInterceptors(FileInterceptor('file'))
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Body('institutionId') institutionId: string,
    @Body('title') title: string,
    @Body('description') description: string,
    @Body('category') category: string,
    @Body('visibleToRoles') visibleToRolesStr: string,
    @Request() req: any,
  ) {
    const visibleToRoles = visibleToRolesStr ? JSON.parse(visibleToRolesStr) : [];
    
    // Validar y convertir categoría
    const validCategories = ['MANUAL', 'REGLAMENTO', 'FORMATO', 'CIRCULAR', 'PEI', 'SIEE', 'OTRO'];
    const normalizedCategory = category?.toUpperCase() || 'OTRO';
    if (!validCategories.includes(normalizedCategory)) {
      throw new Error(`Categoría inválida: ${category}. Válidas: ${validCategories.join(', ')}`);
    }
    
    const dto: CreateDocumentDto = {
      institutionId,
      title,
      description,
      category: normalizedCategory as any,
      visibleToRoles,
    };
    
    try {
      return this.documentsService.create(dto, file, req.user.id);
    } catch (error) {
      console.error('[DocumentsController] Error creating document:', error);
      throw error;
    }
  }

  @Get()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE', 'SECRETARIA')
  async findAll(
    @Query('institutionId') institutionId: string,
    @Request() req: any,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    const userRoles = req.user.roles?.map((r: any) => 
      typeof r === 'string' ? r : (r.role?.name || r.name)
    ).filter(Boolean) || [];
    return this.documentsService.findAll(instId, userRoles);
  }

  @Get('categories')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async getCategories() {
    return this.documentsService.getCategories();
  }

  @Get('storage-usage')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  async getStorageUsage(@Request() req: any, @Query('institutionId') institutionId?: string) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.documentsService.getStorageUsage(instId);
  }

  @Get(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE', 'SECRETARIA')
  async findOne(@Param('id') id: string) {
    return this.documentsService.findOne(id);
  }

  @Get(':id/download-url')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE', 'SECRETARIA')
  async getDownloadUrl(@Param('id') id: string) {
    return this.documentsService.getDownloadUrl(id);
  }

  @Put(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateDocumentDto,
  ) {
    return this.documentsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  async delete(@Param('id') id: string) {
    return this.documentsService.delete(id);
  }

  @Post('cleanup')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  async cleanupOrphanedFiles(@Request() req: any, @Body('institutionId') institutionId?: string) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.documentsService.cleanupOrphanedFiles(instId);
  }
}
