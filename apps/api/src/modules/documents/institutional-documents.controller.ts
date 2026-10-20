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
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { InstitutionalDocumentsService } from './institutional-documents.service';
import type {
  CreateDocumentDto,
  UpdateDocumentDto,
} from './institutional-documents.service';
import { PrismaService } from '../../prisma/prisma.service';
import { requireInstitutionId } from '../../common/utils/institution-resolver';
import { ValidateTenantContextGuard } from '../../common/guards/validate-tenant-context.guard';

@Controller('institutional-documents')
@UseGuards(JwtAuthGuard, RolesGuard, ValidateTenantContextGuard)
export class InstitutionalDocumentsController {
  constructor(
    private readonly documentsService: InstitutionalDocumentsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'RECTOR', 'COORDINADOR')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Body('institutionId') institutionId: string,
    @Body('title') title: string,
    @Body('description') description: string,
    @Body('category') category: string,
    @Body('visibleToRoles') visibleToRolesStr: string,
    @Request() req: any,
  ) {
    const instId = await requireInstitutionId(
      this.prisma as any,
      req,
      institutionId,
    );
    let visibleToRoles: string[];
    try {
      visibleToRoles = visibleToRolesStr ? JSON.parse(visibleToRolesStr) : [];
      if (
        !Array.isArray(visibleToRoles) ||
        visibleToRoles.some((role) => typeof role !== 'string')
      )
        throw new Error();
    } catch {
      throw new BadRequestException(
        'visibleToRoles debe ser un arreglo de roles.',
      );
    }

    // Validar y convertir categoría
    const validCategories = [
      'MANUAL',
      'REGLAMENTO',
      'FORMATO',
      'CIRCULAR',
      'PEI',
      'SIEE',
      'OTRO',
    ];
    const normalizedCategory = category?.toUpperCase() || 'OTRO';
    if (!validCategories.includes(normalizedCategory)) {
      throw new BadRequestException(
        `Categoría inválida: ${category}. Válidas: ${validCategories.join(', ')}`,
      );
    }

    const dto: CreateDocumentDto = {
      institutionId: instId,
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
  @Roles(
    'SUPERADMIN',
    'ADMIN_INSTITUTIONAL', 'RECTOR',
    'COORDINADOR',
    'DOCENTE',
    'SECRETARIA',
  )
  async findAll(
    @Query('institutionId') institutionId: string,
    @Request() req: any,
  ) {
    const instId = await requireInstitutionId(
      this.prisma as any,
      req,
      institutionId,
    );
    const userRoles =
      req.user.roles
        ?.map((r: any) => (typeof r === 'string' ? r : r.role?.name || r.name))
        .filter(Boolean) || [];
    return this.documentsService.findAll(
      instId,
      userRoles,
      req.user.isSuperAdmin === true,
    );
  }

  @Get('categories')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'RECTOR', 'COORDINADOR')
  async getCategories() {
    return this.documentsService.getCategories();
  }

  @Get('storage-usage')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'RECTOR')
  async getStorageUsage(
    @Request() req: any,
    @Query('institutionId') institutionId?: string,
  ) {
    const instId = await requireInstitutionId(
      this.prisma as any,
      req,
      institutionId,
    );
    return this.documentsService.getStorageUsage(instId);
  }

  @Get(':id')
  @Roles(
    'SUPERADMIN',
    'ADMIN_INSTITUTIONAL', 'RECTOR',
    'COORDINADOR',
    'DOCENTE',
    'SECRETARIA',
  )
  async findOne(
    @Param('id') id: string,
    @Request() req: any,
    @Query('institutionId') institutionId?: string,
  ) {
    const instId = await requireInstitutionId(
      this.prisma as any,
      req,
      institutionId,
    );
    return this.documentsService.findOne(
      id,
      instId,
      req.user.roles,
      req.user.isSuperAdmin === true,
    );
  }

  @Get(':id/download-url')
  @Roles(
    'SUPERADMIN',
    'ADMIN_INSTITUTIONAL', 'RECTOR',
    'COORDINADOR',
    'DOCENTE',
    'SECRETARIA',
  )
  async getDownloadUrl(
    @Param('id') id: string,
    @Request() req: any,
    @Query('institutionId') institutionId?: string,
  ) {
    const instId = await requireInstitutionId(
      this.prisma as any,
      req,
      institutionId,
    );
    return this.documentsService.getDownloadUrl(
      id,
      instId,
      req.user.roles,
      req.user.isSuperAdmin === true,
    );
  }

  @Put(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'RECTOR', 'COORDINADOR')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateDocumentDto,
    @Request() req: any,
    @Query('institutionId') institutionId?: string,
  ) {
    const instId = await requireInstitutionId(
      this.prisma as any,
      req,
      institutionId,
    );
    return this.documentsService.update(
      id,
      dto,
      instId,
      req.user.roles,
      req.user.isSuperAdmin === true,
    );
  }

  @Delete(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'RECTOR')
  async delete(
    @Param('id') id: string,
    @Request() req: any,
    @Query('institutionId') institutionId?: string,
  ) {
    const instId = await requireInstitutionId(
      this.prisma as any,
      req,
      institutionId,
    );
    return this.documentsService.delete(
      id,
      instId,
      req.user.roles,
      req.user.isSuperAdmin === true,
    );
  }

  @Post('cleanup')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'RECTOR')
  async cleanupOrphanedFiles(
    @Request() req: any,
    @Body('institutionId') institutionId?: string,
  ) {
    const instId = await requireInstitutionId(
      this.prisma as any,
      req,
      institutionId,
    );
    return this.documentsService.cleanupOrphanedFiles(instId);
  }
}
