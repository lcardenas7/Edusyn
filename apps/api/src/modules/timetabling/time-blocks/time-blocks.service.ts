import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { TimeBlockType } from '@prisma/client';

@Injectable()
export class TimeBlocksService {
  constructor(private prisma: PrismaService) {}

  async findAll(institutionId: string, shiftId?: string) {
    return this.prisma.timeBlock.findMany({
      where: {
        institutionId,
        ...(shiftId && { shiftId }),
      },
      orderBy: [{ shiftId: 'asc' }, { order: 'asc' }],
      include: {
        shift: { select: { id: true, name: true, type: true } },
      },
    });
  }

  async findOne(id: string, institutionId: string) {
    const block = await this.prisma.timeBlock.findFirst({
      where: { id, institutionId },
      include: {
        shift: { select: { id: true, name: true, type: true } },
      },
    });
    if (!block) throw new NotFoundException('Bloque de tiempo no encontrado');
    return block;
  }

  async create(institutionId: string, data: {
    shiftId: string;
    type?: TimeBlockType;
    startTime: string;
    endTime: string;
    order: number;
    label?: string;
  }) {
    // Validar formato HH:mm
    this.validateTimeFormat(data.startTime);
    this.validateTimeFormat(data.endTime);

    // Validar que startTime < endTime
    if (data.startTime >= data.endTime) {
      throw new BadRequestException('La hora de inicio debe ser anterior a la hora de fin');
    }

    return this.prisma.timeBlock.create({
      data: {
        institutionId,
        ...data,
        type: data.type || 'CLASS',
      },
      include: {
        shift: { select: { id: true, name: true, type: true } },
      },
    });
  }

  async update(id: string, institutionId: string, data: {
    type?: TimeBlockType;
    startTime?: string;
    endTime?: string;
    order?: number;
    label?: string;
  }) {
    await this.findOne(id, institutionId);

    if (data.startTime) this.validateTimeFormat(data.startTime);
    if (data.endTime) this.validateTimeFormat(data.endTime);

    return this.prisma.timeBlock.update({
      where: { id },
      data,
      include: {
        shift: { select: { id: true, name: true, type: true } },
      },
    });
  }

  async delete(id: string, institutionId: string) {
    await this.findOne(id, institutionId);

    // Verificar si tiene entradas de horario asociadas
    const entriesCount = await this.prisma.scheduleEntry.count({
      where: { timeBlockId: id },
    });

    if (entriesCount > 0) {
      throw new BadRequestException(
        `No se puede eliminar: tiene ${entriesCount} entradas de horario asociadas`,
      );
    }

    return this.prisma.timeBlock.delete({ where: { id } });
  }

  async bulkCreate(institutionId: string, shiftId: string, blocks: Array<{
    type?: TimeBlockType;
    startTime: string;
    endTime: string;
    order: number;
    label?: string;
  }>) {
    // Validar todos los bloques
    for (const block of blocks) {
      this.validateTimeFormat(block.startTime);
      this.validateTimeFormat(block.endTime);
      if (block.startTime >= block.endTime) {
        throw new BadRequestException(
          `Bloque orden ${block.order}: la hora de inicio debe ser anterior a la hora de fin`,
        );
      }
    }

    // Eliminar bloques existentes de esa jornada (sin entradas asociadas)
    const existingWithEntries = await this.prisma.timeBlock.findMany({
      where: { institutionId, shiftId },
      include: { _count: { select: { scheduleEntries: true } } },
    });

    const blockIdsWithEntries = existingWithEntries
      .filter((b) => b._count.scheduleEntries > 0)
      .map((b) => b.id);

    if (blockIdsWithEntries.length > 0) {
      throw new BadRequestException(
        'No se pueden reemplazar bloques que ya tienen entradas de horario. Elimine primero las entradas.',
      );
    }

    // Transacción: eliminar existentes y crear nuevos
    return this.prisma.$transaction(async (tx) => {
      await tx.timeBlock.deleteMany({ where: { institutionId, shiftId } });

      const created: any[] = [];
      for (const block of blocks) {
        const newBlock = await tx.timeBlock.create({
          data: {
            institutionId,
            shiftId,
            type: block.type || 'CLASS',
            startTime: block.startTime,
            endTime: block.endTime,
            order: block.order,
            label: block.label,
          },
          include: {
            shift: { select: { id: true, name: true, type: true } },
          },
        });
        created.push(newBlock);
      }

      return created;
    });
  }

  private validateTimeFormat(time: string) {
    const regex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!regex.test(time)) {
      throw new BadRequestException(`Formato de hora inválido: ${time}. Use HH:mm`);
    }
  }
}
