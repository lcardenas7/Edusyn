import { Body, Controller, Post, Get, Param, Query, UseGuards, Request, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  // Jerarquía de roles: un usuario solo puede asignar roles de nivel inferior al suyo
  private static readonly ROLE_HIERARCHY: Record<string, number> = {
    SUPERADMIN: 100,
    ADMIN_INSTITUTIONAL: 90,
    RECTOR: 80,
    COORDINADOR: 70,
    SECRETARIA: 60,
    ORIENTADOR: 60,
    BIBLIOTECARIO: 60,
    AUXILIAR: 60,
    AUXILIAR_CONTABLE: 60,
    DOCENTE: 50,
    ESTUDIANTE: 10,
    ACUDIENTE: 10,
  };

  @Post('register')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async register(@Request() req, @Body() dto: RegisterDto) {
    // Validar jerarquía de roles: no puede asignar roles >= su propio nivel
    const callerRoles: string[] = req.user.roles || [];
    const callerIsSuperAdmin = req.user.isSuperAdmin === true;
    const callerMaxLevel = callerIsSuperAdmin
      ? 100
      : Math.max(...callerRoles.map(r => AuthController.ROLE_HIERARCHY[r] || 0), 0);

    for (const requestedRole of dto.roles) {
      const requestedLevel = AuthController.ROLE_HIERARCHY[requestedRole] || 50;
      if (requestedLevel >= callerMaxLevel && !callerIsSuperAdmin) {
        throw new ForbiddenException(
          `No puedes asignar el rol "${requestedRole}". Solo puedes asignar roles de nivel inferior al tuyo.`,
        );
      }
    }

    return this.authService.register(dto);
  }

  @Post('login')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Request() req) {
    return this.authService.getProfile(req.user.id);
  }

  /**
   * Busca instituciones por nombre o slug (autocompletado)
   * Endpoint público (no requiere autenticación)
   */
  @Get('institutions/search')
  async searchInstitutions(@Query('q') query: string) {
    if (!query || query.length < 2) {
      return [];
    }

    const institutions = await this.prisma.institution.findMany({
      where: {
        AND: [
          {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { slug: { contains: query, mode: 'insensitive' } },
            ],
          },
          {
            status: { in: ['ACTIVE', 'TRIAL'] },
          },
        ],
      },
      select: {
        id: true,
        name: true,
        slug: true,
        logo: true,
        status: true,
      },
      take: 5,
      orderBy: { name: 'asc' },
    });

    return institutions;
  }

  /**
   * Verifica si una institución existe por su slug
   * Endpoint público (no requiere autenticación)
   */
  /**
   * Cambiar contraseña (requiere autenticación)
   */
  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @Request() req,
    @Body() body: { currentPassword: string; newPassword: string },
  ) {
    return this.authService.changePassword(req.user.id, body.currentPassword, body.newPassword);
  }

  @Post('switch-institution')
  @UseGuards(JwtAuthGuard)
  async switchInstitution(
    @Request() req,
    @Body() body: { institutionId: string },
  ) {
    return this.authService.switchInstitution(req.user.id, body.institutionId);
  }

  @Get('institution/:slug')
  async getInstitutionBySlug(@Param('slug') slug: string) {
    const institution = await this.prisma.institution.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        logo: true,
        status: true,
      },
    });

    if (!institution) {
      throw new NotFoundException('Institución no encontrada');
    }

    if (institution.status === 'INACTIVE' || institution.status === 'SUSPENDED') {
      throw new NotFoundException('Esta institución no está disponible');
    }

    return institution;
  }
}
