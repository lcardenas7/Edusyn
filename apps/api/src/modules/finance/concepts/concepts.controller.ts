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
import { ConceptsService } from './concepts.service';

@Controller('finance/concepts')
@UseGuards(JwtAuthGuard)
export class ConceptsController {
  constructor(private readonly conceptsService: ConceptsService) {}

  @Get()
  async findAll(
    @Request() req,
    @Query('categoryId') categoryId?: string,
    @Query('isActive') isActive?: string,
    @Query('isMassive') isMassive?: string,
  ) {
    return this.conceptsService.findAll(req.user.institutionId, {
      categoryId,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      isMassive: isMassive === 'true' ? true : isMassive === 'false' ? false : undefined,
    });
  }

  @Get(':id')
  async findOne(@Request() req, @Param('id') id: string) {
    return this.conceptsService.findOne(id, req.user.institutionId);
  }

  @Post()
  async create(@Request() req, @Body() data: any) {
    return this.conceptsService.create(req.user.institutionId, data);
  }

  @Put(':id')
  async update(@Request() req, @Param('id') id: string, @Body() data: any) {
    return this.conceptsService.update(id, req.user.institutionId, data);
  }

  @Delete(':id')
  async delete(@Request() req, @Param('id') id: string) {
    return this.conceptsService.delete(id, req.user.institutionId);
  }
}
