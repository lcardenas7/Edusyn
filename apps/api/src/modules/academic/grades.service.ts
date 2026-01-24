import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { CreateGradeDto } from './dto/create-grade.dto';
import { GradeStage, SchoolShift } from '@prisma/client';

interface SyncGradeDto {
  id: string;
  name: string;
  level: string;
  order: number;
  groups: {
    id: string;
    name: string;
    shift: string;
    capacity: number;
  }[];
}

@Injectable()
export class GradesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateGradeDto) {
    return this.prisma.grade.create({
      data: {
        stage: dto.stage,
        number: dto.number,
        name: dto.name,
      },
    });
  }

  async list() {
    return this.prisma.grade.findMany({
      orderBy: [{ stage: 'asc' }, { name: 'asc' }],
    });
  }

  async listByInstitution(institutionId: string) {
    return this.prisma.grade.findMany({
      include: {
        groups: {
          where: {
            campus: { institutionId }
          },
          include: {
            campus: true,
            shift: true,
          }
        }
      },
      orderBy: [{ stage: 'asc' }, { name: 'asc' }],
    });
  }

  // Sincronizar grados y grupos desde el frontend
  async syncGradesAndGroups(institutionId: string, grades: SyncGradeDto[]) {
    console.log(`[GradesService] Sincronizando ${grades.length} grados para institución ${institutionId}`);

    // 1. Asegurar que existe un campus por defecto
    let campus = await this.prisma.campus.findFirst({
      where: { institutionId }
    });

    if (!campus) {
      const institution = await this.prisma.institution.findUnique({
        where: { id: institutionId }
      });
      campus = await this.prisma.campus.create({
        data: {
          institutionId,
          name: 'Sede Principal',
          address: institution?.address || '',
        }
      });
      console.log(`[GradesService] Campus creado: ${campus.name}`);
    }

    // 2. Asegurar que existen los shifts
    const shiftMap: Record<string, string> = {};
    const shiftTypes = [
      { name: 'MAÑANA', type: 'MORNING' as SchoolShift },
      { name: 'TARDE', type: 'AFTERNOON' as SchoolShift },
      { name: 'UNICA', type: 'SINGLE' as SchoolShift },
    ];

    for (const shiftDef of shiftTypes) {
      let shift = await this.prisma.shift.findFirst({
        where: { 
          campusId: campus.id,
          type: shiftDef.type
        }
      });
      if (!shift) {
        shift = await this.prisma.shift.create({
          data: {
            campusId: campus.id,
            name: `Jornada ${shiftDef.name}`,
            type: shiftDef.type,
          }
        });
        console.log(`[GradesService] Shift creado: ${shift.name}`);
      }
      shiftMap[shiftDef.name] = shift.id;
    }

    // 3. Mapear niveles a GradeStage
    const levelToStage: Record<string, GradeStage> = {
      'PREESCOLAR': GradeStage.PREESCOLAR,
      'PRIMARIA': GradeStage.BASICA_PRIMARIA,
      'SECUNDARIA': GradeStage.BASICA_SECUNDARIA,
      'MEDIA': GradeStage.MEDIA,
    };

    // 4. Crear/actualizar grados y grupos
    const results: { grade: string; groupsCount: number }[] = [];
    for (const gradeData of grades) {
      const stage = levelToStage[gradeData.level] || GradeStage.BASICA_PRIMARIA;

      // Buscar o crear el grado
      let grade = await this.prisma.grade.findFirst({
        where: { name: gradeData.name }
      });

      if (!grade) {
        grade = await this.prisma.grade.create({
          data: {
            name: gradeData.name,
            stage,
            number: gradeData.order,
          }
        });
        console.log(`[GradesService] Grado creado: ${grade.name}`);
      }

      // Crear grupos para este grado
      for (const groupData of gradeData.groups) {
        const shiftId = shiftMap[groupData.shift] || shiftMap['MAÑANA'];

        // Verificar si el grupo ya existe
        const existingGroup = await this.prisma.group.findFirst({
          where: {
            gradeId: grade.id,
            campusId: campus.id,
            name: groupData.name,
          }
        });

        if (!existingGroup) {
          const group = await this.prisma.group.create({
            data: {
              gradeId: grade.id,
              campusId: campus.id,
              shiftId,
              name: groupData.name,
              code: `${gradeData.name}-${groupData.name}`,
              maxCapacity: groupData.capacity,
            }
          });
          console.log(`[GradesService] Grupo creado: ${gradeData.name} ${group.name}`);
        }
      }

      results.push({
        grade: grade.name,
        groupsCount: gradeData.groups.length
      });
    }

    return {
      success: true,
      message: `Sincronizados ${grades.length} grados`,
      campusId: campus.id,
      results
    };
  }
}
