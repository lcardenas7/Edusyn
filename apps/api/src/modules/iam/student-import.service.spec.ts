import { StudentImportService, StudentRow } from './student-import.service';

/**
 * Módulo 3 — analyzeRows: infiere el ecosistema y cuadra estudiantes vs existentes.
 * No escribe nada (solo lee students para el cuadre).
 */
describe('StudentImportService.analyzeRows (Módulo 3)', () => {
  function makeService(existingDocs: string[] = []) {
    const prisma: any = {
      student: {
        findMany: jest.fn().mockResolvedValue(existingDocs.map((documentNumber) => ({ documentNumber }))),
      },
    };
    return { svc: new StudentImportService(prisma), prisma };
  }

  const row = (over: Partial<StudentRow>): StudentRow => ({
    rowNumber: 2,
    curso: '6A',
    documento: '1001',
    nombreCompleto: 'Ana Ruiz',
    ...over,
  });

  it('infiere ecosistema y cuenta estudiantes (todos nuevos)', async () => {
    const { svc } = makeService([]);
    const res = await svc.analyzeRows('inst-1', [
      row({ curso: '6A', documento: '1001' }),
      row({ curso: '6B', documento: '1002' }),
      row({ curso: '7A', documento: '1003' }),
    ]);
    expect(res.ecosystem.grados.map((g) => g.number)).toEqual([6, 7]);
    expect(res.ecosystem.totalGrupos).toBe(3);
    expect(res.students).toEqual({ total: 3, validos: 3, nuevos: 3, existentes: 0 });
  });

  it('marca como existentes los documentos ya en la institución', async () => {
    const { svc } = makeService(['1002']);
    const res = await svc.analyzeRows('inst-1', [
      row({ curso: '6A', documento: '1001' }),
      row({ curso: '6B', documento: '1002' }),
    ]);
    expect(res.students).toMatchObject({ nuevos: 1, existentes: 1 });
  });

  it('reporta filas sin documento válido en issues (no las cuenta como válidas)', async () => {
    const { svc } = makeService([]);
    const res = await svc.analyzeRows('inst-1', [
      row({ curso: '6A', documento: '1001' }),
      row({ curso: '6A', documento: '' }), // sin documento
    ]);
    expect(res.students).toMatchObject({ total: 2, validos: 1 });
    expect(res.issues.some((i) => /sin documento/i.test(i.motivo))).toBe(true);
  });

  it('cuenta acudientes y reporta cursos no reconocidos', async () => {
    const { svc } = makeService([]);
    const res = await svc.analyzeRows('inst-1', [
      row({ curso: '6A', documento: '1001', acudienteNombre: 'María' }),
      row({ curso: 'CICLO 3', documento: '1002' }),
    ]);
    expect(res.guardians).toBe(1);
    expect(res.issues.some((i) => i.curso === 'CICLO 3')).toBe(true);
  });
});
