import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Get,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GradeChangeService } from './grade-change.service';
import { ChangeGradeDto, ValidateGradeChangeDto } from './dto/grade-change.dto';

@Controller('grade-change')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GradeChangeController {
  constructor(private readonly gradeChangeService: GradeChangeService) {}

  /**
   * Valida si un cambio de grado/grupo es permitido
   */
  @Post('validate')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN', 'COORDINADOR')
  async validateChange(
    @Body() dto: ValidateGradeChangeDto,
    @Request() req: any,
  ) {
    return this.gradeChangeService.validateGradeChange(dto);
  }

  /**
   * Ejecuta el cambio de grado/grupo
   */
  @Post('execute')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN', 'COORDINADOR')
  async executeChange(
    @Body() dto: ChangeGradeDto,
    @Request() req: any,
  ) {
    // Agregar información de quién realiza el cambio
    return this.gradeChangeService.changeGrade(dto);
  }

  /**
   * Obtiene las reglas y restricciones para cambios de grado
   */
  @Get('rules')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN', 'COORDINADOR', 'DOCENTE')
  async getGradeChangeRules() {
    return {
      rules: {
        sameGrade: {
          allowed: true,
          description: 'Cambio de grupo dentro del mismo grado',
          requirements: ['Cupo disponible en el nuevo grupo'],
          restrictions: [],
        },
        promotion: {
          allowed: true,
          description: 'Promoción a grado superior',
          requirements: [
            'Evaluación psicoacadémica',
            'Autorización del consejo académico',
            'Consentimiento de acudientes',
            'Acta académica aprobada',
          ],
          restrictions: [
            'No antes de mitad de año lectivo (excepto casos excepcionales)',
            'Promedio académico mínimo 4.0',
          ],
        },
        demotion: {
          allowed: false,
          description: 'Rebaja a grado inferior',
          requirements: [
            'Acta de consejo académico aprobada',
            'Autorización del rector y coordinador',
            'Consentimiento firmado de acudientes',
            'Evaluación psicológica',
          ],
          restrictions: [
            'Solo en casos excepcionales documentados',
            'Requiere aprobación del Ministerio de Educación',
          ],
        },
      },
      stageTransitions: {
        'PREESCOLAR->BASICA_PRIMARIA': {
          requirements: ['Certificado de desarrollo infantil'],
          restrictions: ['Edad mínima 6 años cumplidos'],
        },
        'BASICA_SECUNDARIA->MEDIA': {
          requirements: ['Evaluación de vocación y aptitudes'],
          restrictions: ['Aprobación de grado 9°'],
        },
      },
      process: {
        steps: [
          '1. Validar disponibilidad y reglas aplicables',
          '2. Obtener autorizaciones requeridas',
          '3. Elaborar acta académica (si aplica)',
          '4. Ejecutar cambio con auditoría',
          '5. Notificar a partes interesadas',
        ],
      },
    };
  }
}
