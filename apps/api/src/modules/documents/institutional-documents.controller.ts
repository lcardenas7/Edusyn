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
import { InstitutionalDocumentCategory } from '@prisma/client';

@Controller('institutional-documents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InstitutionalDocumentsController {
  constructor(private readonly documentsService: InstitutionalDocumentsService) {}

  @Post()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  @UseInterceptors(FileInterceptor('file'))
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Body('institutionId') institutionId: string,
    @Body('title') title: string,
    @Body('description') description: string,
    @Body('category') category: InstitutionalDocumentCategory,
    @Body('visibleToRoles') visibleToRolesStr: string,
    @Request() req: any,
  ) {
    const visibleToRoles = visibleToRolesStr ? JSON.parse(visibleToRolesStr) : [];
    
    const dto: CreateDocumentDto = {
      institutionId,
      title,
      description,
      category,
      visibleToRoles,
    };
    
    return this.documentsService.create(dto, file, req.user.id);
  }

  @Get()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE', 'SECRETARIA')
  async findAll(
    @Query('institutionId') institutionId: string,
    @Request() req: any,
  ) {
    console.log('[DocumentsController] findAll - req.user:', JSON.stringify(req.user, null, 2));
    const userRoles = req.user.roles?.map((r: any) => r.role?.name || r.name) || [];
    console.log('[DocumentsController] Extracted roles:', userRoles);
    return this.documentsService.findAll(institutionId, userRoles);
  }

  @Get('categories')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async getCategories() {
    return this.documentsService.getCategories();
  }

  @Get('storage-usage')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  async getStorageUsage(@Query('institutionId') institutionId: string) {
    return this.documentsService.getStorageUsage(institutionId);
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
}
