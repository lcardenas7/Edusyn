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

  async addSubjectToArea(areaId: string, subjectData: { name: string; weeklyHours?: number; weight?: number; order?: number }) {
    await this.findById(areaId);
    return this.prisma.subject.create({
      data: {
        areaId,
        name: subjectData.name,
        weeklyHours: subjectData.weeklyHours ?? 0,
        weight: subjectData.weight ?? 1.0,
        order: subjectData.order ?? 0,
      },
    });
  }

  async updateSubject(subjectId: string, data: { name?: string; weeklyHours?: number; weight?: number; order?: number }) {
    return this.prisma.subject.update({
      where: { id: subjectId },
      data,
    });
  }

  async removeSubject(subjectId: string) {
    return this.prisma.subject.delete({ where: { id: subjectId } });
  }
}
