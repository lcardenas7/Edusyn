import { BadRequestException } from '@nestjs/common';
import { GradesService } from './grades.service';

describe('GradesService.update academic structure', () => {
  const makeService = (stage = 'PREESCOLAR') => {
    const prisma: any = {
      grade: {
        findFirst: jest.fn().mockResolvedValue({ id: 'grade-1', name: 'Transición', stage }),
        update: jest.fn().mockResolvedValue({ id: 'grade-1', academicStructure: 'DIMENSIONS' }),
      },
    };
    return { service: new GradesService(prisma), prisma };
  };

  it('activa DIMENSIONS para un grado de preescolar', async () => {
    const { service, prisma } = makeService();

    await service.update('grade-1', 'institution-1', { academicStructure: 'DIMENSIONS' });

    expect(prisma.grade.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ academicStructure: 'DIMENSIONS' }),
    }));
  });

  it('no permite DIMENSIONS fuera de preescolar', async () => {
    const { service } = makeService('BASICA_PRIMARIA');

    await expect(service.update('grade-1', 'institution-1', { academicStructure: 'DIMENSIONS' }))
      .rejects.toBeInstanceOf(BadRequestException);
  });
});
