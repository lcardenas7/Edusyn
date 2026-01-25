import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { CreateGroupDto } from './dto/create-group.dto';

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateGroupDto) {
    return this.prisma.group.create({
      data: {
        campusId: dto.campusId,
        shiftId: dto.shiftId,
        gradeId: dto.gradeId,
        code: dto.code,
        name: dto.name,
      },
    });
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
}
