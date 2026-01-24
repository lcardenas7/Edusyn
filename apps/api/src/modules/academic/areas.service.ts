import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { CreateAreaDto, UpdateAreaDto } from './dto/create-area.dto';

@Injectable()
export class AreasService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAreaDto) {
    return this.prisma.area.create({
      data: {
        institutionId: dto.institutionId,
        name: dto.name,
        isMandatory: dto.isMandatory ?? false,
        calculationType: dto.calculationType ?? 'AVERAGE',
        customFormula: dto.customFormula,
        order: dto.order ?? 0,
        academicLevel: dto.academicLevel,
        gradeId: dto.gradeId,
      },
      include: { 
        subjects: {
          include: { levelConfigs: { include: { grade: true } } },
        },
        grade: true,
      },
    });
  }

  async findById(id: string) {
    const area = await this.prisma.area.findUnique({
      where: { id },
      include: { 
        subjects: {
          orderBy: { order: 'asc' },
          include: { levelConfigs: { include: { grade: true } } },
        },
        grade: true,
      },
    });
    if (!area) throw new NotFoundException('Área no encontrada');
    return area;
  }

  async update(id: string, dto: UpdateAreaDto) {
    await this.findById(id);
    return this.prisma.area.update({
      where: { id },
      data: {
        name: dto.name,
        isMandatory: dto.isMandatory,
        calculationType: dto.calculationType,
        customFormula: dto.customFormula,
        order: dto.order,
        academicLevel: dto.academicLevel,
        gradeId: dto.gradeId,
      },
      include: { 
        subjects: {
          include: { levelConfigs: { include: { grade: true } } },
        },
        grade: true,
      },
    });
  }

  async delete(id: string) {
    await this.findById(id);
    return this.prisma.area.delete({ where: { id } });
  }

  async list(params: { institutionId?: string; academicLevel?: string; gradeId?: string }) {
    return this.prisma.area.findMany({
      where: {
        institutionId: params.institutionId,
        ...(params.academicLevel && { academicLevel: params.academicLevel }),
        ...(params.gradeId && { gradeId: params.gradeId }),
      },
      include: {
        subjects: {
          orderBy: { order: 'asc' },
          include: { levelConfigs: { include: { grade: true } } },
        },
        grade: true,
      },
      orderBy: { order: 'asc' },
    });
  }

  // Obtener áreas aplicables a un grado específico
  async getAreasForGrade(institutionId: string, gradeId: string) {
    const grade = await this.prisma.grade.findUnique({
      where: { id: gradeId },
    });

    if (!grade) {
      throw new NotFoundException('Grado no encontrado');
    }

    const stageToLevel: Record<string, string> = {
      PRESCHOOL: 'PREESCOLAR',
      PRIMARY: 'PRIMARIA',
      SECONDARY: 'SECUNDARIA',
      HIGH_SCHOOL: 'MEDIA',
    };
    const academicLevel = stageToLevel[grade.stage] || grade.stage;

    return this.prisma.area.findMany({
      where: {
        institutionId,
        OR: [
          { academicLevel: null, gradeId: null },
          { academicLevel, gradeId: null },
          { gradeId },
        ],
      },
      include: {
        subjects: {
          orderBy: { order: 'asc' },
          include: { levelConfigs: { include: { grade: true } } },
        },
        grade: true,
      },
      orderBy: { order: 'asc' },
    });
  }

  // ========== ASIGNATURAS (Catálogo único) ==========

  // Crear asignatura (solo nombre, sin configuración de nivel)
  async addSubjectToArea(areaId: string, subjectData: { name: string; order?: number }) {
    await this.findById(areaId);
    
    // Verificar si ya existe una asignatura con ese nombre en el área
    const existing = await this.prisma.subject.findUnique({
      where: { areaId_name: { areaId, name: subjectData.name } },
    });
    
    if (existing) {
      throw new BadRequestException(`Ya existe una asignatura "${subjectData.name}" en esta área`);
    }
    
    return this.prisma.subject.create({
      data: {
        areaId,
        name: subjectData.name,
        order: subjectData.order ?? 0,
      },
      include: { levelConfigs: { include: { grade: true } } },
    });
  }

  // Actualizar asignatura (solo nombre y orden)
  async updateSubject(subjectId: string, data: { name?: string; order?: number }) {
    return this.prisma.subject.update({
      where: { id: subjectId },
      data,
      include: { levelConfigs: { include: { grade: true } } },
    });
  }

  // Eliminar asignatura (solo si no tiene configuraciones activas)
  async removeSubject(subjectId: string) {
    const subject = await this.prisma.subject.findUnique({
      where: { id: subjectId },
      include: { levelConfigs: true },
    });
    
    if (!subject) {
      throw new NotFoundException('Asignatura no encontrada');
    }
    
    // Eliminar todas las configuraciones asociadas primero
    await this.prisma.subjectLevelConfig.deleteMany({
      where: { subjectId },
    });
    
    return this.prisma.subject.delete({ where: { id: subjectId } });
  }

  // Obtener asignaturas de un área (catálogo)
  async getSubjectsOfArea(areaId: string) {
    return this.prisma.subject.findMany({
      where: { areaId },
      orderBy: { order: 'asc' },
      include: { levelConfigs: { include: { grade: true } } },
    });
  }

  // ========== CONFIGURACIONES POR NIVEL ==========

  // Agregar configuración de nivel a una asignatura
  async addSubjectLevelConfig(subjectId: string, configData: {
    weeklyHours?: number;
    weight?: number;
    isDominant?: boolean;
    academicLevel?: string;
    gradeId?: string;
  }) {
    const subject = await this.prisma.subject.findUnique({
      where: { id: subjectId },
    });
    
    if (!subject) {
      throw new NotFoundException('Asignatura no encontrada');
    }

    // Si se marca como dominante, quitar dominante de otras configs del mismo nivel/grado
    if (configData.isDominant) {
      await this.prisma.subjectLevelConfig.updateMany({
        where: {
          subject: { areaId: subject.areaId },
          academicLevel: configData.academicLevel || null,
          gradeId: configData.gradeId || null,
        },
        data: { isDominant: false },
      });
    }

    return this.prisma.subjectLevelConfig.create({
      data: {
        subjectId,
        weeklyHours: configData.weeklyHours ?? 0,
        weight: configData.weight ?? 1.0,
        isDominant: configData.isDominant ?? false,
        academicLevel: configData.academicLevel || null,
        gradeId: configData.gradeId || null,
      },
      include: { grade: true, subject: true },
    });
  }

  // Actualizar configuración de nivel
  async updateSubjectLevelConfig(configId: string, data: {
    weeklyHours?: number;
    weight?: number;
    isDominant?: boolean;
  }) {
    const config = await this.prisma.subjectLevelConfig.findUnique({
      where: { id: configId },
      include: { subject: true },
    });

    if (!config) {
      throw new NotFoundException('Configuración no encontrada');
    }

    // Si se marca como dominante, quitar dominante de otras configs del mismo nivel/grado
    if (data.isDominant) {
      await this.prisma.subjectLevelConfig.updateMany({
        where: {
          subject: { areaId: config.subject.areaId },
          academicLevel: config.academicLevel,
          gradeId: config.gradeId,
          id: { not: configId },
        },
        data: { isDominant: false },
      });
    }

    return this.prisma.subjectLevelConfig.update({
      where: { id: configId },
      data,
      include: { grade: true, subject: true },
    });
  }

  // Eliminar configuración de nivel
  async removeSubjectLevelConfig(configId: string) {
    return this.prisma.subjectLevelConfig.delete({ where: { id: configId } });
  }

  // ========== MÉTODO COMBINADO (para compatibilidad con frontend actual) ==========

  // Agregar asignatura con configuración en un solo paso
  // Si la asignatura ya existe, solo agrega la configuración
  async addSubjectWithConfig(areaId: string, data: {
    name: string;
    weeklyHours?: number;
    weight?: number;
    isDominant?: boolean;
    academicLevel?: string;
    gradeId?: string;
  }) {
    await this.findById(areaId);

    // Buscar si ya existe la asignatura
    let subject = await this.prisma.subject.findUnique({
      where: { areaId_name: { areaId, name: data.name } },
    });

    // Si no existe, crearla
    if (!subject) {
      subject = await this.prisma.subject.create({
        data: {
          areaId,
          name: data.name,
          order: 0,
        },
      });
    }

    // Verificar si ya existe una config para este nivel/grado
    const existingConfig = await this.prisma.subjectLevelConfig.findFirst({
      where: {
        subjectId: subject.id,
        academicLevel: data.academicLevel || null,
        gradeId: data.gradeId || null,
      },
    });

    if (existingConfig) {
      // Actualizar configuración existente
      return this.updateSubjectLevelConfig(existingConfig.id, {
        weeklyHours: data.weeklyHours,
        weight: data.weight,
        isDominant: data.isDominant,
      });
    }

    // Crear nueva configuración
    return this.addSubjectLevelConfig(subject.id, {
      weeklyHours: data.weeklyHours,
      weight: data.weight,
      isDominant: data.isDominant,
      academicLevel: data.academicLevel,
      gradeId: data.gradeId,
    });
  }
}
