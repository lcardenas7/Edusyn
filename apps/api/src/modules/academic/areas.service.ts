import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SubjectType } from '@prisma/client';

// ═══════════════════════════════════════════════════════════════════════════
// SERVICIO DE CATÁLOGO ACADÉMICO
// Gestiona el catálogo de áreas y asignaturas de la institución
// Este catálogo es INDEPENDIENTE de grados y grupos
// ═══════════════════════════════════════════════════════════════════════════

@Injectable()
export class AreasService {
  constructor(private readonly prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // ÁREAS (Catálogo)
  // ═══════════════════════════════════════════════════════════════════════════

  async createArea(data: {
    institutionId: string;
    name: string;
    code?: string;
    description?: string;
    order?: number;
  }) {
    // Verificar que no exista un área con el mismo nombre
    const existing = await this.prisma.area.findUnique({
      where: { institutionId_name: { institutionId: data.institutionId, name: data.name } },
    });
    
    if (existing) {
      throw new BadRequestException(`Ya existe un área "${data.name}" en esta institución`);
    }

    return this.prisma.area.create({
      data: {
        institutionId: data.institutionId,
        name: data.name,
        code: data.code,
        description: data.description,
        order: data.order ?? 0,
      },
      include: { subjects: { orderBy: { order: 'asc' } } },
    });
  }

  async findAreaById(id: string) {
    const area = await this.prisma.area.findUnique({
      where: { id },
      include: { 
        subjects: { 
          where: { isActive: true },
          orderBy: { order: 'asc' },
        },
      },
    });
    if (!area) throw new NotFoundException('Área no encontrada');
    return area;
  }

  async updateArea(id: string, data: {
    name?: string;
    code?: string;
    description?: string;
    order?: number;
    isActive?: boolean;
  }) {
    await this.findAreaById(id);
    return this.prisma.area.update({
      where: { id },
      data,
      include: { subjects: { orderBy: { order: 'asc' } } },
    });
  }

  async deleteArea(id: string) {
    const area = await this.findAreaById(id);
    
    // Verificar si tiene asignaturas con asignaciones docentes
    const hasAssignments = await this.prisma.teacherAssignment.findFirst({
      where: { subject: { areaId: id } },
    });
    
    if (hasAssignments) {
      throw new BadRequestException(
        'No se puede eliminar el área porque tiene asignaturas con asignaciones docentes. Desactívela en su lugar.'
      );
    }
    
    return this.prisma.area.delete({ where: { id } });
  }

  async listAreas(institutionId: string, includeInactive = false) {
    return this.prisma.area.findMany({
      where: {
        institutionId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      include: {
        subjects: {
          where: includeInactive ? {} : { isActive: true },
          orderBy: { order: 'asc' },
        },
        _count: { select: { subjects: true, templateAreas: true } },
      },
      orderBy: { order: 'asc' },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ASIGNATURAS (Catálogo)
  // ═══════════════════════════════════════════════════════════════════════════

  async createSubject(data: {
    areaId: string;
    name: string;
    code?: string;
    description?: string;
    subjectType?: SubjectType;
    order?: number;
  }) {
    // Verificar que el área exista
    await this.findAreaById(data.areaId);
    
    // Verificar que no exista una asignatura con el mismo nombre en el área
    const existing = await this.prisma.subject.findUnique({
      where: { areaId_name: { areaId: data.areaId, name: data.name } },
    });
    
    if (existing) {
      throw new BadRequestException(`Ya existe una asignatura "${data.name}" en esta área`);
    }

    return this.prisma.subject.create({
      data: {
        areaId: data.areaId,
        name: data.name,
        code: data.code,
        description: data.description,
        subjectType: data.subjectType ?? 'MANDATORY',
        order: data.order ?? 0,
      },
      include: { area: true },
    });
  }

  async findSubjectById(id: string) {
    const subject = await this.prisma.subject.findUnique({
      where: { id },
      include: { area: true },
    });
    if (!subject) throw new NotFoundException('Asignatura no encontrada');
    return subject;
  }

  async updateSubject(id: string, data: {
    name?: string;
    code?: string;
    description?: string;
    subjectType?: SubjectType;
    order?: number;
    isActive?: boolean;
  }) {
    await this.findSubjectById(id);
    return this.prisma.subject.update({
      where: { id },
      data,
      include: { area: true },
    });
  }

  async deleteSubject(id: string) {
    // Verificar si tiene asignaciones docentes
    const hasAssignments = await this.prisma.teacherAssignment.findFirst({
      where: { subjectId: id },
    });
    
    if (hasAssignments) {
      throw new BadRequestException(
        'No se puede eliminar la asignatura porque tiene asignaciones docentes. Desactívela en su lugar.'
      );
    }
    
    return this.prisma.subject.delete({ where: { id } });
  }

  async listSubjectsByArea(areaId: string, includeInactive = false) {
    return this.prisma.subject.findMany({
      where: {
        areaId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      include: { area: true },
      orderBy: { order: 'asc' },
    });
  }

  async listAllSubjects(institutionId: string, includeInactive = false) {
    return this.prisma.subject.findMany({
      where: {
        area: { institutionId },
        ...(includeInactive ? {} : { isActive: true }),
      },
      include: { area: true },
      orderBy: [{ area: { order: 'asc' } }, { order: 'asc' }],
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MÉTODOS DE COMPATIBILIDAD (para el frontend actual)
  // ═══════════════════════════════════════════════════════════════════════════

  // Alias para mantener compatibilidad
  async create(dto: any) {
    return this.createArea(dto);
  }

  async findById(id: string) {
    return this.findAreaById(id);
  }

  async update(id: string, dto: any) {
    return this.updateArea(id, dto);
  }

  async delete(id: string) {
    return this.deleteArea(id);
  }

  async list(params: { institutionId?: string }) {
    if (!params.institutionId) return [];
    return this.listAreas(params.institutionId);
  }

  async addSubjectToArea(areaId: string, data: { name: string; order?: number }) {
    return this.createSubject({ areaId, name: data.name, order: data.order });
  }

  async removeSubject(subjectId: string) {
    return this.deleteSubject(subjectId);
  }

  async getSubjectsOfArea(areaId: string) {
    return this.listSubjectsByArea(areaId);
  }
}
