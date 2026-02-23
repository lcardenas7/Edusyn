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
      include: { author: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
  }

  async list(institutionId?: string, onlyActive = true, upcoming = false, limit?: number) {
    const now = new Date();
    return this.prisma.event.findMany({
      where: {
        institutionId,
        ...(onlyActive && { isActive: true }),
        ...(upcoming && { eventDate: { gte: now } }),
      },
      include: { author: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { eventDate: 'asc' },
      ...(limit && { take: limit }),
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
      include: { author: { select: { id: true, firstName: true, lastName: true, email: true } } },
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
    institutionId: string;
  }>) {
    // Remove institutionId from update data - it should not be changed
    const { institutionId, ...updateData } = data as any;
    
    return this.prisma.event.update({
      where: { id },
      data: updateData,
      include: { author: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
  }

  async delete(id: string) {
    return this.prisma.event.delete({ where: { id } });
  }

  async getBirthdays(institutionId?: string) {
    // Usar hora de Colombia (UTC-5) para determinar "hoy"
    // El servidor puede correr en UTC, pero los cumpleaños deben compararse con el día local
    const nowUTC = new Date();
    const colombiaOffset = -5 * 60; // UTC-5 en minutos
    const colombiaNow = new Date(nowUTC.getTime() + colombiaOffset * 60 * 1000);
    const currentMonth = colombiaNow.getUTCMonth() + 1;
    const currentDay = colombiaNow.getUTCDate();
    
    // Calcular los próximos 7 días (hoy + 7 días siguientes) en hora Colombia
    const daysToCheck: { month: number; day: number; daysFromToday: number }[] = [];
    for (let i = 0; i <= 7; i++) {
      const checkDate = new Date(colombiaNow);
      checkDate.setUTCDate(colombiaNow.getUTCDate() + i);
      daysToCheck.push({
        month: checkDate.getUTCMonth() + 1,
        day: checkDate.getUTCDate(),
        daysFromToday: i,
      });
    }
    
    // Obtener estudiantes con cumpleaños
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

    // Obtener docentes con cumpleaños (usuarios con rol DOCENTE de esta institución)
    const teacherWhere: any = {
      birthDate: { not: null },
      roles: {
        some: {
          role: { name: 'DOCENTE' },
        },
      },
    };
    if (institutionId) {
      teacherWhere.institutionUsers = { some: { institutionId } };
    }
    const teachers = await this.prisma.user.findMany({
      where: teacherWhere,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        birthDate: true,
      },
    });

    // Filtrar estudiantes por hoy + próximos 7 días
    const studentBirthdays = students
      .filter(s => {
        if (!s.birthDate) return false;
        const bd = new Date(s.birthDate);
        const bdMonth = bd.getUTCMonth() + 1;
        const bdDay = bd.getUTCDate();
        return daysToCheck.some(d => d.month === bdMonth && d.day === bdDay);
      })
      .map(s => {
        const bd = new Date(s.birthDate!);
        const bdMonth = bd.getUTCMonth() + 1;
        const bdDay = bd.getUTCDate();
        const dayInfo = daysToCheck.find(d => d.month === bdMonth && d.day === bdDay);
        return {
          id: s.id,
          name: `${s.lastName} ${s.firstName}`,
          birthDate: s.birthDate,
          type: 'ESTUDIANTE' as const,
          detail: s.enrollments[0] 
            ? `${s.enrollments[0].group?.grade?.name || ''} ${s.enrollments[0].group?.name || ''}`.trim()
            : '',
          isToday: dayInfo?.daysFromToday === 0,
          daysFromToday: dayInfo?.daysFromToday ?? 99,
        };
      });

    // Filtrar docentes por hoy + próximos 7 días
    const teacherBirthdays = teachers
      .filter(t => {
        if (!t.birthDate) return false;
        const bd = new Date(t.birthDate);
        const bdMonth = bd.getUTCMonth() + 1;
        const bdDay = bd.getUTCDate();
        return daysToCheck.some(d => d.month === bdMonth && d.day === bdDay);
      })
      .map(t => {
        const bd = new Date(t.birthDate!);
        const bdMonth = bd.getUTCMonth() + 1;
        const bdDay = bd.getUTCDate();
        const dayInfo = daysToCheck.find(d => d.month === bdMonth && d.day === bdDay);
        return {
          id: t.id,
          name: `${t.lastName} ${t.firstName}`,
          birthDate: t.birthDate,
          type: 'DOCENTE' as const,
          detail: 'Docente',
          isToday: dayInfo?.daysFromToday === 0,
          daysFromToday: dayInfo?.daysFromToday ?? 99,
        };
      });
    
    // Combinar y ordenar por días desde hoy (primero los de hoy, luego mañana, etc.)
    const allBirthdays = [...studentBirthdays, ...teacherBirthdays]
      .sort((a, b) => a.daysFromToday - b.daysFromToday);

    return allBirthdays;
  }
}
