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
      },
      include: { subjects: true },
    });
  }

  async findById(id: string) {
    const area = await this.prisma.area.findUnique({
      where: { id },
      include: { 
        subjects: {
          orderBy: { order: 'asc' },
        },
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
      },
      include: { subjects: true },
    });
  }

  async delete(id: string) {
    await this.findById(id);
    return this.prisma.area.delete({ where: { id } });
  }

  async list(params: { institutionId?: string }) {
    return this.prisma.area.findMany({
      where: {
        institutionId: params.institutionId,
      },
      include: {
        subjects: {
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { order: 'asc' },
    });
  }

  async addSubjectToArea(areaId: string, subjectData: { name: string; weeklyHours?: number; weight?: number; isDominant?: boolean; order?: number }) {
    await this.findById(areaId);
    
    // Si se marca como dominante, quitar dominante de las demás asignaturas del área
    if (subjectData.isDominant) {
      await this.prisma.subject.updateMany({
        where: { areaId },
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
      },
    });
  }

  async updateSubject(subjectId: string, data: { name?: string; weeklyHours?: number; weight?: number; isDominant?: boolean; order?: number }) {
    // Si se marca como dominante, quitar dominante de las demás asignaturas del área
    if (data.isDominant) {
      const subject = await this.prisma.subject.findUnique({ where: { id: subjectId } });
      if (subject) {
        await this.prisma.subject.updateMany({
          where: { areaId: subject.areaId, id: { not: subjectId } },
          data: { isDominant: false },
        });
      }
    }
    
    return this.prisma.subject.update({
      where: { id: subjectId },
      data,
    });
  }

  async removeSubject(subjectId: string) {
    return this.prisma.subject.delete({ where: { id: subjectId } });
  }
}
