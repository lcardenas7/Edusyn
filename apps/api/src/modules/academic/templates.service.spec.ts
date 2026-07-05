import { TemplatesService } from './templates.service';

/**
 * Asistente "Plan de Estudios" — el orquestador quickSetup crea catálogo +
 * plantilla + asignación al grado en UNA transacción, es idempotente y reutiliza
 * materias existentes (dedup por nombre).
 */
describe('TemplatesService.quickSetup', () => {
  function makeService(grade: any) {
    const created: any = { templates: [], areas: [], subjects: [], templateAreas: [], templateSubjects: [], gradeTemplates: [] };
    const tx: any = {
      gradeTemplate: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }: any) => { created.gradeTemplates.push(data); return Promise.resolve(data); }),
        update: jest.fn().mockResolvedValue({}),
      },
      academicTemplate: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }: any) => { created.templates.push(data); return Promise.resolve({ id: 'tmpl1' }); }),
      },
      area: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }: any) => { created.areas.push(data); return Promise.resolve({ id: 'area-' + data.name }); }),
      },
      templateArea: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }: any) => { created.templateAreas.push(data); return Promise.resolve({ id: 'ta-' + data.areaId }); }),
      },
      subject: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }: any) => { created.subjects.push(data); return Promise.resolve({ id: 'subj-' + data.name }); }),
      },
      templateSubject: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }: any) => { created.templateSubjects.push(data); return Promise.resolve(data); }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma: any = {
      grade: { findUnique: jest.fn().mockResolvedValue(grade) },
      $transaction: jest.fn().mockImplementation(async (cb: any) => cb(tx)),
    };
    return { svc: new TemplatesService(prisma), tx, created };
  }

  const dto = {
    institutionId: 'inst1', academicYearId: 'yr1', gradeId: 'g1',
    areas: [{ newAreaName: 'Matemáticas', subjects: [{ newSubjectName: 'Álgebra', weeklyHours: 4 }, { newSubjectName: 'Geometría', weeklyHours: 3 }] }],
  };

  it('rechaza preescolar (usa dimensiones)', async () => {
    const { svc } = makeService({ id: 'g1', name: 'Jardín', stage: 'PREESCOLAR', institutionId: 'inst1' });
    await expect(svc.quickSetup(dto)).rejects.toThrow(/dimensiones/i);
  });

  it('rechaza si no hay áreas', async () => {
    const { svc } = makeService({ id: 'g1', name: '5A', stage: 'BASICA_PRIMARIA', institutionId: 'inst1' });
    await expect(svc.quickSetup({ ...dto, areas: [] })).rejects.toThrow(/al menos un área/i);
  });

  it('crea catálogo + plantilla + asignación en la transacción', async () => {
    const { svc, tx, created } = makeService({ id: 'g1', name: '5A', stage: 'BASICA_PRIMARIA', institutionId: 'inst1' });
    const res: any = await svc.quickSetup(dto);
    expect(res.success).toBe(true);
    expect(created.templates.length).toBe(1);
    expect(created.areas.map((a: any) => a.name)).toContain('Matemáticas');
    expect(created.subjects.map((s: any) => s.name).sort()).toEqual(['Geometría', 'Álgebra'].sort());
    expect(created.templateSubjects.length).toBe(2);
    expect(tx.gradeTemplate.create).toHaveBeenCalled();
  });

  it('reutiliza una materia existente en vez de duplicarla', async () => {
    const { svc, tx } = makeService({ id: 'g1', name: '5A', stage: 'BASICA_PRIMARIA', institutionId: 'inst1' });
    tx.subject.findUnique.mockResolvedValueOnce({ id: 'existente-algebra' }); // Álgebra ya existe
    await svc.quickSetup(dto);
    expect(tx.subject.create).toHaveBeenCalledTimes(1); // solo Geometría
  });
});
