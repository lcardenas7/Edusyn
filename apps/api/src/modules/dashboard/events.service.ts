import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    institutionId: string;
    title: string;
    description?: string;
    eventDate: Date;
    endDate?: Date;
    location?: string;
    eventType?: string;
    authorId: string;
    visibleToRoles?: string[];
  }) {
    return this.prisma.event.create({
      data: {
        ...data,
        visibleToRoles: data.visibleToRoles || [],
      },
      include: { author: true },
    });
  }

  async list(institutionId?: string, onlyActive = true, upcoming = false) {
    const now = new Date();
    return this.prisma.event.findMany({
      where: {
        institutionId,
        ...(onlyActive && { isActive: true }),
        ...(upcoming && { eventDate: { gte: now } }),
      },
      include: { author: true },
      orderBy: { eventDate: 'asc' },
    });
  }

  async listForUser(institutionId: string, userRoles: string[], upcoming = true) {
    const now = new Date();
    const events = await this.prisma.event.findMany({
      where: {
        institutionId,
        isActive: true,
        ...(upcoming && { eventDate: { gte: now } }),
      },
      include: { author: true },
      orderBy: { eventDate: 'asc' },
    });

    return events.filter(e => {
      if (!e.visibleToRoles || e.visibleToRoles.length === 0) return true;
      return e.visibleToRoles.some(role => userRoles.includes(role));
    });
  }

  async update(id: string, data: Partial<{
    title: string;
    description: string;
    eventDate: Date;
    endDate: Date;
    location: string;
    eventType: string;
    isActive: boolean;
    visibleToRoles: string[];
  }>) {
    return this.prisma.event.update({
      where: { id },
      data,
      include: { author: true },
    });
  }

  async delete(id: string) {
    return this.prisma.event.delete({ where: { id } });
  }

  async getBirthdays(institutionId?: string) {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();
    
    // Obtener estudiantes con cumpleaños este mes
    const students = await this.prisma.student.findMany({
      where: {
        institutionId,
        birthDate: { not: null },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        birthDate: true,
        enrollments: {
          where: { status: 'ACTIVE' },
          include: { group: { include: { grade: true } } },
          take: 1,
        },
      },
    });

    // Obtener docentes con cumpleaños este mes (usuarios con rol DOCENTE)
    const teachers = await this.prisma.user.findMany({
      where: {
        birthDate: { not: null },
        roles: {
          some: {
            role: {
              name: 'DOCENTE',
            },
          },
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        birthDate: true,
      },
    });

    // Filtrar estudiantes por mes actual
    const studentBirthdays = students
      .filter(s => {
        if (!s.birthDate) return false;
        const bd = new Date(s.birthDate);
        return bd.getMonth() + 1 === currentMonth;
      })
      .map(s => ({
        id: s.id,
        name: `${s.firstName} ${s.lastName}`,
        birthDate: s.birthDate,
        type: 'ESTUDIANTE' as const,
        detail: s.enrollments[0] 
          ? `${s.enrollments[0].group?.grade?.name || ''} ${s.enrollments[0].group?.name || ''}`.trim()
          : '',
        isToday: s.birthDate ? new Date(s.birthDate).getDate() === currentDay : false,
      }));

    // Filtrar docentes por mes actual
    const teacherBirthdays = teachers
      .filter(t => {
        if (!t.birthDate) return false;
        const bd = new Date(t.birthDate);
        return bd.getMonth() + 1 === currentMonth;
      })
      .map(t => ({
        id: t.id,
        name: `${t.firstName} ${t.lastName}`,
        birthDate: t.birthDate,
        type: 'DOCENTE' as const,
        detail: 'Docente',
        isToday: t.birthDate ? new Date(t.birthDate).getDate() === currentDay : false,
      }));
    
    // Combinar y ordenar por día del mes
    const allBirthdays = [...studentBirthdays, ...teacherBirthdays]
      .sort((a, b) => {
        const dayA = a.birthDate ? new Date(a.birthDate).getDate() : 0;
        const dayB = b.birthDate ? new Date(b.birthDate).getDate() : 0;
        return dayA - dayB;
      });

    return allBirthdays;
  }
}
