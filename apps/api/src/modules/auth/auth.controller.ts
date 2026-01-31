import { Body, Controller, Post, Get, Param, Query, UseGuards, Request, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
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

  // TEMPORAL: Endpoint para resetear contraseña de Sarith - ELIMINAR DESPUÉS
  @Get('reset-sarith-temp-xyz123')
  async resetSarithPassword() {
    const email = 'sarith@gmail.com';
    const newPassword = 'Sarith2026!';
    
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, username: true, firstName: true, lastName: true }
    });
    
    if (!user) {
      return { error: 'Usuario no encontrado' };
    }
    
    const passwordHash = await bcrypt.hash(newPassword, 10);
    
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: false }
    });
    
    return {
      message: 'Contraseña actualizada',
      username: user.username,
      password: newPassword,
      nombre: `${user.firstName} ${user.lastName}`
    };
  }
}
