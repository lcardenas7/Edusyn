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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  PaymentsService,
  CreatePaymentConceptDto,
  CreatePaymentEventDto,
  RegisterPaymentDto,
  ApplyDiscountDto,
} from './payments.service';

@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // CONCEPTOS DE PAGO
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('concepts')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN')
  async createConcept(@Body() dto: CreatePaymentConceptDto) {
    return this.paymentsService.createConcept(dto);
  }

  @Get('concepts')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN', 'COORDINADOR', 'SECRETARIA')
  async getConcepts(@Query('institutionId') institutionId: string) {
    return this.paymentsService.getConcepts(institutionId);
  }

  @Put('concepts/:id')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN')
  async updateConcept(
    @Param('id') id: string,
    @Body() dto: Partial<CreatePaymentConceptDto>,
  ) {
    return this.paymentsService.updateConcept(id, dto);
  }

  @Delete('concepts/:id')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN')
  async deleteConcept(@Param('id') id: string) {
    return this.paymentsService.deleteConcept(id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EVENTOS DE PAGO
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('events')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN', 'COORDINADOR')
  async createEvent(
    @Body() dto: Omit<CreatePaymentEventDto, 'createdById'>,
    @Request() req: any,
  ) {
    return this.paymentsService.createEvent({
      ...dto,
      createdById: req.user.id,
    });
  }

  @Get('events')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN', 'COORDINADOR', 'SECRETARIA')
  async getEvents(
    @Query('institutionId') institutionId: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.paymentsService.getEvents(institutionId, academicYearId);
  }

  @Get('events/:id')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN', 'COORDINADOR', 'SECRETARIA')
  async getEventById(@Param('id') id: string) {
    return this.paymentsService.getEventById(id);
  }

  @Get('events/:id/stats')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN', 'COORDINADOR')
  async getEventStats(@Param('id') id: string) {
    return this.paymentsService.getEventStats(id);
  }

  @Put('events/:id')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN', 'COORDINADOR')
  async updateEvent(
    @Param('id') id: string,
    @Body() dto: Partial<CreatePaymentEventDto>,
  ) {
    return this.paymentsService.updateEvent(id, dto);
  }

  @Delete('events/:id')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN')
  async deleteEvent(@Param('id') id: string) {
    return this.paymentsService.deleteEvent(id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGOS DE ESTUDIANTES
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('student/:studentId')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN', 'COORDINADOR', 'SECRETARIA', 'ACUDIENTE')
  async getStudentPayments(
    @Param('studentId') studentId: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.paymentsService.getStudentPayments(studentId, academicYearId);
  }

  @Get('payment/:id')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN', 'COORDINADOR', 'SECRETARIA')
  async getPaymentById(@Param('id') id: string) {
    return this.paymentsService.getPaymentById(id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REGISTRAR PAGO (ABONO)
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('register')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN', 'COORDINADOR', 'SECRETARIA')
  async registerPayment(
    @Body() dto: Omit<RegisterPaymentDto, 'receivedById'>,
    @Request() req: any,
  ) {
    return this.paymentsService.registerPayment({
      ...dto,
      receivedById: req.user.id,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // APLICAR DESCUENTO
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('discount')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN', 'COORDINADOR')
  async applyDiscount(@Body() dto: ApplyDiscountDto) {
    return this.paymentsService.applyDiscount(dto);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ESTADÍSTICAS
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('stats/institution')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN', 'COORDINADOR')
  async getInstitutionStats(
    @Query('institutionId') institutionId: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.paymentsService.getInstitutionStats(institutionId, academicYearId);
  }
}
