import * as bcrypt from 'bcryptjs';
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: { roles: { include: { role: true } } },
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { roles: { include: { role: true } } },
    });
  }

  async createUser(params: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    roles: string[];
  }) {
    const passwordHash = await bcrypt.hash(params.password, 10);

    return this.prisma.user.create({
      data: {
        email: params.email,
        passwordHash,
        firstName: params.firstName,
        lastName: params.lastName,
        roles: {
          create: params.roles.map((roleName) => ({
            role: {
              connectOrCreate: {
                where: { name: roleName },
                create: { name: roleName },
              },
            },
          })),
        },
      },
      include: { roles: { include: { role: true } } },
    });
  }
}
