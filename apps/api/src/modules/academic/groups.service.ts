import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { CreateGroupDto } from './dto/create-group.dto';

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateGroupDto) {
    console.log('[GroupsService] Creating group with dto:', dto);

    // Validar que el grado pertenece a la misma institución que el campus
    const [campus, grade] = await Promise.all([
      this.prisma.campus.findUnique({ where: { id: dto.campusId }, select: { institutionId: true } }),
      this.prisma.grade.findUnique({ where: { id: dto.gradeId }, select: { institutionId: true } }),
    ]);
    if (!campus) throw new Error('Campus no encontrado.');
    if (!grade) throw new Error('Grado no encontrado.');
    if (campus.institutionId !== grade.institutionId) {
      throw new Error('El grado no pertenece a la misma institución que el campus.');
    }

    try {
      const group = await this.prisma.group.create({
        data: {
          campusId: dto.campusId,
          shiftId: dto.shiftId,
          gradeId: dto.gradeId,
          code: dto.code,
          name: dto.name,
          maxCapacity: dto.maxCapacity ?? 40,
        },
        include: {
          grade: true,
          shift: true,
        },
      });
      console.log('[GroupsService] Group created:', group.id, group.name);
      return group;
    } catch (error: any) {
      console.error('[GroupsService] Error creating group:', error.message);
      throw error;
    }
  }

  async list(params: { campusId?: string; shiftId?: string; gradeId?: string; institutionId?: string }) {
    console.log('[GroupsService] Listando grupos con params:', params);
    
    const groups = await this.prisma.group.findMany({
      where: {
        campusId: params.campusId,
        shiftId: params.shiftId,
        gradeId: params.gradeId,
        // Filtrar por institución a través del campus
        ...(params.institutionId && {
          campus: {
            institutionId: params.institutionId
          }
        }),
      },
      include: {
        grade: true,
        shift: true,
        campus: {
          include: {
            institution: true
          }
        },
        director: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [
        { grade: { number: 'asc' } },
        { name: 'asc' },
      ],
    });
    
    // Log detallado para debugging
    console.log(`[GroupsService] Encontrados ${groups.length} grupos para institutionId: ${params.institutionId}`);
    if (groups.length > 0) {
      console.log('[GroupsService] Muestra de grupos:', groups.slice(0, 3).map(g => ({
        name: g.name,
        grade: g.grade?.name,
        campusInstitutionId: g.campus?.institutionId,
        institutionName: (g.campus as any)?.institution?.name
      })));
    }
    
    return groups;
  }

  async delete(id: string) {
    // Check for related students, assignments, schedule entries
    const studentCount = await this.prisma.studentEnrollment.count({ where: { groupId: id } });
    if (studentCount > 0) {
      throw new Error(`No se puede eliminar el grupo porque tiene ${studentCount} estudiante(s) matriculados.`);
    }
    const assignmentCount = await this.prisma.teacherAssignment.count({ where: { groupId: id } });
    if (assignmentCount > 0) {
      throw new Error(`No se puede eliminar el grupo porque tiene ${assignmentCount} asignación(es) docente. Elimine la carga académica primero.`);
    }
    return this.prisma.group.delete({ where: { id } });
  }

  async update(id: string, data: { directorId?: string | null; maxCapacity?: number; name?: string; shiftId?: string }) {
    return this.prisma.group.update({
      where: { id },
      data,
      include: {
        grade: true,
        shift: true,
        director: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }
}
