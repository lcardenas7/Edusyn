import { Injectable, NotFoundException } from '@nestjs/common';

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
        subjects: true,
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
        subjects: true,
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
        },
        grade: true,
      },
      orderBy: { order: 'asc' },
    });
  }

  // Obtener áreas aplicables a un grado específico
  // Incluye: áreas globales (sin nivel ni grado) + áreas del nivel + áreas del grado específico
  async getAreasForGrade(institutionId: string, gradeId: string) {
    const grade = await this.prisma.grade.findUnique({
      where: { id: gradeId },
    });

    if (!grade) {
      throw new NotFoundException('Grado no encontrado');
    }

    // Mapear stage a academicLevel
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
          // Áreas globales (sin nivel ni grado específico)
          { academicLevel: null, gradeId: null },
          // Áreas del nivel académico (sin grado específico)
          { academicLevel, gradeId: null },
          // Áreas específicas de este grado
          { gradeId },
        ],
      },
      include: {
        subjects: {
          orderBy: { order: 'asc' },
        },
        grade: true,
      },
      orderBy: { order: 'asc' },
    });
  }

  async addSubjectToArea(areaId: string, subjectData: { 
    name: string; 
    weeklyHours?: number; 
    weight?: number; 
    isDominant?: boolean; 
    order?: number;
    academicLevel?: string;
    gradeId?: string;
  }) {
    await this.findById(areaId);
    
    // Si se marca como dominante, quitar dominante de las demás asignaturas del área
    // (solo dentro del mismo nivel/grado si está especificado)
    if (subjectData.isDominant) {
      await this.prisma.subject.updateMany({
        where: { 
          areaId,
          academicLevel: subjectData.academicLevel || null,
          gradeId: subjectData.gradeId || null,
        },
        data: { isDominant: false },
      });
    }
    
    return this.prisma.subject.create({
      data: {
        areaId,
        name: subjectData.name,
        weeklyHours: subjectData.weeklyHours ?? 0,
        weight: subjectData.weight ?? 1.0,
        isDominant: subjectData.isDominant ?? false,
        order: subjectData.order ?? 0,
        academicLevel: subjectData.academicLevel,
        gradeId: subjectData.gradeId,
      },
      include: {
        grade: true,
      },
    });
  }

  async updateSubject(subjectId: string, data: { 
    name?: string; 
    weeklyHours?: number; 
    weight?: number; 
    isDominant?: boolean; 
    order?: number;
    academicLevel?: string;
    gradeId?: string;
  }) {
    // Si se marca como dominante, quitar dominante de las demás asignaturas del área
    if (data.isDominant) {
      const subject = await this.prisma.subject.findUnique({ where: { id: subjectId } });
      if (subject) {
        await this.prisma.subject.updateMany({
          where: { 
            areaId: subject.areaId, 
            id: { not: subjectId },
            academicLevel: subject.academicLevel,
            gradeId: subject.gradeId,
          },
          data: { isDominant: false },
        });
      }
    }
    
    return this.prisma.subject.update({
      where: { id: subjectId },
      data,
      include: {
        grade: true,
      },
    });
  }

  async removeSubject(subjectId: string) {
    return this.prisma.subject.delete({ where: { id: subjectId } });
  }
}
