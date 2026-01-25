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
    console.log('[EventsService] Creating event with data:', data)
    try {
      const result = await this.prisma.event.create({
        data: {
          ...data,
          visibleToRoles: data.visibleToRoles || [],
        },
        include: { author: true },
      });
      console.log('[EventsService] Event created successfully:', result.id)
      return result
    } catch (error) {
      console.error('[EventsService] Error creating event:', error)
      throw error
    }
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
    institutionId: string;
  }>) {
    console.log('[EventsService] Updating event:', { id, data });
    try {
      // Remove institutionId from update data - it should not be changed
      const { institutionId, ...updateData } = data as any;
      
      const result = await this.prisma.event.update({
        where: { id },
        data: updateData,
        include: { author: true },
      });
      console.log('[EventsService] Event updated successfully:', result.id);
      return result;
    } catch (error) {
      console.error('[EventsService] Error updating event:', error);
      throw error;
    }
  }

  async delete(id: string) {
    return this.prisma.event.delete({ where: { id } });
  }

  async getBirthdays(institutionId?: string) {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();
    
    // Calcular los próximos 3 días (hoy + 3 días siguientes)
    const daysToCheck: { month: number; day: number; daysFromToday: number }[] = [];
    for (let i = 0; i <= 3; i++) {
      const checkDate = new Date(now);
      checkDate.setDate(now.getDate() + i);
      daysToCheck.push({
        month: checkDate.getMonth() + 1,
        day: checkDate.getDate(),
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

    // Obtener docentes con cumpleaños (usuarios con rol DOCENTE)
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

    // Filtrar estudiantes por hoy + próximos 3 días
    const studentBirthdays = students
      .filter(s => {
        if (!s.birthDate) return false;
        const bd = new Date(s.birthDate);
        const bdMonth = bd.getMonth() + 1;
        const bdDay = bd.getDate();
        return daysToCheck.some(d => d.month === bdMonth && d.day === bdDay);
      })
      .map(s => {
        const bd = new Date(s.birthDate!);
        const bdMonth = bd.getMonth() + 1;
        const bdDay = bd.getDate();
        const dayInfo = daysToCheck.find(d => d.month === bdMonth && d.day === bdDay);
        return {
          id: s.id,
          name: `${s.firstName} ${s.lastName}`,
          birthDate: s.birthDate,
          type: 'ESTUDIANTE' as const,
          detail: s.enrollments[0] 
            ? `${s.enrollments[0].group?.grade?.name || ''} ${s.enrollments[0].group?.name || ''}`.trim()
            : '',
          isToday: dayInfo?.daysFromToday === 0,
          daysFromToday: dayInfo?.daysFromToday ?? 99,
        };
      });

    // Filtrar docentes por hoy + próximos 3 días
    const teacherBirthdays = teachers
      .filter(t => {
        if (!t.birthDate) return false;
        const bd = new Date(t.birthDate);
        const bdMonth = bd.getMonth() + 1;
        const bdDay = bd.getDate();
        return daysToCheck.some(d => d.month === bdMonth && d.day === bdDay);
      })
      .map(t => {
        const bd = new Date(t.birthDate!);
        const bdMonth = bd.getMonth() + 1;
        const bdDay = bd.getDate();
        const dayInfo = daysToCheck.find(d => d.month === bdMonth && d.day === bdDay);
        return {
          id: t.id,
          name: `${t.firstName} ${t.lastName}`,
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
