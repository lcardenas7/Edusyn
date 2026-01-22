import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { GuardiansService } from './guardians.service';
import { 
  CreateGuardianDto, 
  UpdateGuardianDto, 
  LinkGuardianToStudentDto,
  CreateGuardianWithLinkDto 
} from './dto/guardian.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

@Controller('guardians')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GuardiansController {
  constructor(private readonly guardiansService: GuardiansService) {}

  @Post()
  create(@Body() dto: CreateGuardianDto) {
    return this.guardiansService.create(dto);
  }

  @Post('with-link')
  createWithLink(@Body() dto: CreateGuardianWithLinkDto) {
    return this.guardiansService.createWithLink(dto);
  }

  @Get()
  list(
    @Query('institutionId') institutionId?: string,
    @Query('search') search?: string,
  ) {
    return this.guardiansService.list({ institutionId, search });
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.guardiansService.findById(id);
  }

  @Get('student/:studentId')
  findByStudent(@Param('studentId') studentId: string) {
    return this.guardiansService.findByStudent(studentId);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateGuardianDto) {
    return this.guardiansService.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.guardiansService.delete(id);
  }

  @Post('link')
  linkToStudent(@Body() dto: LinkGuardianToStudentDto) {
    return this.guardiansService.linkToStudent(dto);
  }

  @Delete('link/:studentId/:guardianId')
  unlinkFromStudent(
    @Param('studentId') studentId: string,
    @Param('guardianId') guardianId: string,
  ) {
    return this.guardiansService.unlinkFromStudent(studentId, guardianId);
  }

  @Put('link/:studentId/:guardianId')
  updateLink(
    @Param('studentId') studentId: string,
    @Param('guardianId') guardianId: string,
    @Body() data: Partial<LinkGuardianToStudentDto>,
  ) {
    return this.guardiansService.updateLink(studentId, guardianId, data);
  }
}
