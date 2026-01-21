import { Controller, Get, Param, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('iam')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Obtiene todos los usuarios de la institución del usuario actual
   */
  @Get('users')
  async getUsers(@Request() req: any) {
    // Obtener la institución del usuario actual
    const institutionUser = await this.prisma.institutionUser.findFirst({
      where: { userId: req.user.id },
    });

    if (!institutionUser) {
      return [];
    }

    // Obtener usuarios de la misma institución
    const users = await this.prisma.user.findMany({
      where: {
        institutionUsers: {
          some: { institutionId: institutionUser.institutionId }
        },
        isSuperAdmin: false,
      },
      include: {
        roles: { include: { role: true } },
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }]
    });

    // Mapear usuarios con sus datos básicos
    return users.map((user) => ({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      roles: user.roles,
      extraPermissionsCount: 0,
      extraPermissions: []
    }));
  }

  /**
   * Obtiene un usuario específico con sus permisos
   */
  @Get('users/:id')
  async getUser(@Param('id') id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        roles: { include: { role: true } },
      }
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      roles: user.roles,
      extraPermissions: []
    };
  }
}
