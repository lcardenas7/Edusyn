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
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ThirdPartiesService } from './third-parties.service';
import { CreateThirdPartyDto, UpdateThirdPartyDto, SyncThirdPartiesDto } from './dto';
import { ThirdPartyType } from '@prisma/client';

@Controller('finance/third-parties')
@UseGuards(JwtAuthGuard)
export class ThirdPartiesController {
  constructor(private readonly thirdPartiesService: ThirdPartiesService) {}

  @Get()
  async findAll(
    @Request() req,
    @Query('type') type?: ThirdPartyType,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.thirdPartiesService.findAll(req.user.institutionId, {
      type,
      search,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });
  }

  @Get('by-type/:type')
  async getByType(@Request() req, @Param('type') type: ThirdPartyType) {
    return this.thirdPartiesService.getByType(req.user.institutionId, type);
  }

  @Get(':id')
  async findOne(@Request() req, @Param('id') id: string) {
    return this.thirdPartiesService.findOne(id, req.user.institutionId);
  }

  @Get(':id/summary')
  async getFinancialSummary(@Request() req, @Param('id') id: string) {
    return this.thirdPartiesService.getFinancialSummary(id, req.user.institutionId);
  }

  @Post()
  async create(@Request() req, @Body() dto: CreateThirdPartyDto) {
    return this.thirdPartiesService.create(req.user.institutionId, dto);
  }

  @Post('sync')
  async syncFromAcademic(@Request() req, @Body() dto: SyncThirdPartiesDto) {
    return this.thirdPartiesService.syncFromAcademic(req.user.institutionId, dto);
  }

  @Put(':id')
  async update(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateThirdPartyDto,
  ) {
    return this.thirdPartiesService.update(id, req.user.institutionId, dto);
  }

  @Delete(':id')
  async delete(@Request() req, @Param('id') id: string) {
    return this.thirdPartiesService.delete(id, req.user.institutionId);
  }
}
