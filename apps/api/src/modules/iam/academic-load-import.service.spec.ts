import { AcademicLoadImportService } from './academic-load-import.service';

describe('AcademicLoadImportService course resolver', () => {
  it('resuelve TRANSICION A contra grados y grupos guardados sin tilde', async () => {
    const prisma: any = {
      grade: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'grade-transition', name: 'TRANSICION', number: 0 },
        ]),
      },
      group: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'group-transition-a', name: 'TRANSICION A' },
          { id: 'group-transition-b', name: 'TRANSICION B' },
        ]),
      },
    };
    const service = new AcademicLoadImportService(prisma);

    await expect((service as any).findGroup('institution-1', 'TRANSICION A'))
      .resolves.toBe('group-transition-a');
  });

  it('conserva soporte para grupos guardados solo con su sección', async () => {
    const prisma: any = {
      grade: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'grade-transition', name: 'Transición', number: 0 },
        ]),
      },
      group: {
        findMany: jest.fn().mockResolvedValue([{ id: 'group-a', name: 'A' }]),
      },
    };
    const service = new AcademicLoadImportService(prisma);

    await expect((service as any).findGroup('institution-1', 'TRANSICION A'))
      .resolves.toBe('group-a');
  });
});
