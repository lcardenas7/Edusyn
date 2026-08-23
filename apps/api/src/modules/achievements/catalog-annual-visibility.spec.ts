import { AchievementService } from './achievement.service';

/**
 * D-12 · El catálogo de un período debe incluir los propósitos ANUALES.
 *
 * Por qué existe este archivo
 * ---------------------------
 * Validando F2 en staging apareció un círculo vicioso que dejaba el retiro lógico
 * INALCANZABLE desde la interfaz:
 *
 *   1. `retireEvidence` exige un período explícito («desde cuándo deja de aplicar»).
 *   2. Al seleccionar período, el editor recargaba el catálogo con `academicTermId`.
 *   3. `getCatalogAchievements` filtraba por igualdad ESTRICTA, así que los propósitos
 *      anuales (`academicTermId = null`) desaparecían de la lista.
 *   4. Los catálogos de Transición son todos anuales.
 *   ⇒ Al elegir el período para retirar, el propósito se esfumaba de la pantalla.
 *
 * El filtro estricto era anterior a F2; lo que lo volvió bloqueante fue el retiro de D-12.
 *
 * La regla que fijan estas pruebas: un propósito ANUAL aplica a TODOS los períodos, así
 * que tiene que verse en cualquiera de ellos. Es exactamente el criterio que el boletín
 * (`buildGroupReportCards`) ya usaba — `OR: [{ academicTermId }, { academicTermId: null }]`.
 * Tener dos filtros distintos sobre el mismo catálogo era la causa raíz.
 */
describe('AchievementService.getCatalogAchievements — visibilidad de los propósitos anuales', () => {
  function makeService() {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma: any = {
      grade: { findFirst: jest.fn().mockResolvedValue({ id: 'gr-1' }) },
      subject: { findFirst: jest.fn().mockResolvedValue({ id: 'dim-1', code: 'PRE01', subjectType: 'PRESCHOOL_DIMENSION' }) },
      academicYear: { findFirst: jest.fn().mockResolvedValue({ id: 'y-1' }) },
      academicTerm: { findFirst: jest.fn().mockResolvedValue({ id: 't-3', order: 3 }) },
      achievement: { findMany },
    };
    const svc = new AchievementService(prisma, undefined as any);
    return { svc, findMany };
  }

  const base = {
    institutionId: 'inst-1',
    gradeId: 'gr-1',
    subjectId: 'dim-1',
    academicYearId: 'y-1',
  };

  it('sin período: devuelve SOLO los anuales (comportamiento de la vista "Anual")', async () => {
    const { svc, findMany } = makeService();
    await svc.getCatalogAchievements({ ...base }, 'inst-1');

    const where = findMany.mock.calls[0][0].where;
    expect(where.academicTermId).toBeNull();
    expect(where.OR).toBeUndefined();
  });

  it('con período: incluye los de ESE período Y los anuales', async () => {
    const { svc, findMany } = makeService();
    await svc.getCatalogAchievements({ ...base, academicTermId: 't-3' }, 'inst-1');

    const where = findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([{ academicTermId: 't-3' }, { academicTermId: null }]);
    // Ya no debe existir el filtro estricto que ocultaba los anuales.
    expect(where.academicTermId).toBeUndefined();
  });

  it('el mismo criterio que el boletín: un propósito anual es visible en cualquier período', async () => {
    for (const termId of ['t-1', 't-2', 't-3', 't-4']) {
      const { svc, findMany } = makeService();
      await svc.getCatalogAchievements({ ...base, academicTermId: termId }, 'inst-1');

      const where = findMany.mock.calls[0][0].where;
      expect(where.OR).toContainEqual({ academicTermId: null });
      expect(where.OR).toContainEqual({ academicTermId: termId });
    }
  });

  it('el resto del acotamiento del catálogo no cambia', async () => {
    const { svc, findMany } = makeService();
    await svc.getCatalogAchievements({ ...base, academicTermId: 't-3' }, 'inst-1');

    const where = findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({
      institutionId: 'inst-1',
      gradeId: 'gr-1',
      subjectId: 'dim-1',
      academicYearId: 'y-1',
      teacherAssignmentId: null, // catálogo compartido del grado, no de una asignación
      isPromotional: false,
    });
  });
});
