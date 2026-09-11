import { BadRequestException, NotFoundException } from '@nestjs/common';
import { A, B, fixture, noAi, noWrites } from '../../../test/fixtures/learning-route.fixture';

/**
 * Aislamiento de Rutas de aprendizaje — pruebas A/B de servicio.
 *
 * Antes, catorce de las dieciséis rutas consultaban por id sin institución. Lo que se fija aquí no
 * es «devuelve 404»: es que ante un identificador ajeno **no ocurrió nada** — ni lectura de
 * colecciones sensibles, ni escritura, ni llamada a Valeria. Y que el caso legítimo sigue vivo.
 *
 * Las dos direcciones (A contra B y B contra A) se prueban con el mismo cuerpo: un fallo en una
 * sola dirección suele ser un filtro escrito al revés.
 */
describe('Rutas de aprendizaje · aislamiento de servicio', () => {
  let data: ReturnType<typeof fixture>;
  beforeEach(() => { data = fixture(); });

  const otro = (institucion: string) => (institucion === A ? 'B' : 'A');

  describe.each([[A, B], [B, A]])('actor de %s contra recursos de %s', (actor, ajena) => {
    const x = otro(actor);
    const rutaAjena = () => `route-${x}`;
    const pasoAjeno = () => `step-${x}`;
    const aulaAjena = () => `classroom-${x}`;
    const actividadAjena = () => `activity-${x}`;

    it('no lee una ruta ajena', async () => {
      await expect(data.service.getRoute(actor, rutaAjena())).rejects.toBeInstanceOf(NotFoundException);
      noWrites(data.prisma);
    });

    it('no lista las rutas de un aula ajena, y ni siquiera las consulta', async () => {
      await expect(data.service.listByClassroom(actor, aulaAjena())).rejects.toBeInstanceOf(NotFoundException);
      expect(data.prisma.learningRoute.findMany).not.toHaveBeenCalled();
      noWrites(data.prisma);
    });

    it('no crea una ruta en un aula ajena', async () => {
      await expect(data.service.createRoute(actor, { classroomId: aulaAjena(), title: 'Intento' }))
        .rejects.toBeInstanceOf(NotFoundException);
      noWrites(data.prisma);
    });

    it('no edita una ruta ajena', async () => {
      await expect(data.service.updateRoute(actor, rutaAjena(), { title: 'Pisada' }))
        .rejects.toBeInstanceOf(NotFoundException);
      noWrites(data.prisma);
      expect(data.rows.learningRoute.find((r) => r.id === rutaAjena()).title).toBe(`Ruta ${x}`);
    });

    it('no borra una ruta ajena', async () => {
      await expect(data.service.deleteRoute(actor, rutaAjena())).rejects.toBeInstanceOf(NotFoundException);
      expect(data.rows.learningRoute.some((r) => r.id === rutaAjena())).toBe(true);
    });

    it('no añade un paso a una ruta ajena', async () => {
      await expect(data.service.addStep(actor, rutaAjena(), { title: 'Paso intruso' }))
        .rejects.toBeInstanceOf(NotFoundException);
      noWrites(data.prisma);
    });

    it('no crea actividad ni paso en el aula de una ruta ajena', async () => {
      await expect(data.service.addStepWithNewActivity(actor, rutaAjena(), { title: 'Actividad intrusa' }))
        .rejects.toBeInstanceOf(NotFoundException);
      noWrites(data.prisma);
      expect(data.rows.classroomActivity.filter((a) => a.classroomId === aulaAjena())).toHaveLength(1);
    });

    it('no edita un paso ajeno', async () => {
      await expect(data.service.updateStep(actor, pasoAjeno(), { title: 'Pisado' }))
        .rejects.toBeInstanceOf(NotFoundException);
      noWrites(data.prisma);
      expect(data.rows.learningRouteStep.find((s) => s.id === pasoAjeno()).title).toBe(`Paso ${x}`);
    });

    it('no borra un paso ajeno', async () => {
      await expect(data.service.deleteStep(actor, pasoAjeno())).rejects.toBeInstanceOf(NotFoundException);
      expect(data.rows.learningRouteStep.some((s) => s.id === pasoAjeno())).toBe(true);
    });

    it('no crea una actividad colgada de un paso ajeno', async () => {
      await expect(data.service.createStepActivity(actor, pasoAjeno(), {}))
        .rejects.toBeInstanceOf(NotFoundException);
      noWrites(data.prisma);
    });

    it('no gasta IA generando la lección de un paso ajeno', async () => {
      await expect(data.service.generateStepLesson(actor, pasoAjeno()))
        .rejects.toBeInstanceOf(NotFoundException);
      noAi(data.apdAi);
      noWrites(data.prisma);
    });

    it('no reordena los pasos de una ruta ajena', async () => {
      await expect(data.service.reorderSteps(actor, rutaAjena(), [pasoAjeno()]))
        .rejects.toBeInstanceOf(NotFoundException);
      noWrites(data.prisma);
    });

    it('no cuela un paso ajeno en el orden de una ruta propia', async () => {
      await expect(data.service.reorderSteps(actor, `route-${actor === A ? 'A' : 'B'}`, [`step-${actor === A ? 'A' : 'B'}`, pasoAjeno()]))
        .rejects.toBeInstanceOf(NotFoundException);
      expect(data.prisma.learningRouteStep.updateMany).not.toHaveBeenCalled();
    });

    it('no enlaza una actividad ajena a un paso propio', async () => {
      const propio = `step-${actor === A ? 'A' : 'B'}`;
      await expect(data.service.updateStep(actor, propio, { activityId: actividadAjena() }))
        .rejects.toBeInstanceOf(NotFoundException);
      expect(data.prisma.learningRouteStep.updateMany).not.toHaveBeenCalled();
    });

    it('no crea una ruta desde un plan en un aula ajena, y no llama a Valeria', async () => {
      await expect(data.service.createFromPlan(actor, aulaAjena(), { title: 'Plan', steps: [] } as any))
        .rejects.toBeInstanceOf(NotFoundException);
      noWrites(data.prisma);
      noAi(data.apdAi);
    });

    it('el progreso de una ruta ajena no se calcula', async () => {
      await expect(data.evidence.getRouteProgress(actor, rutaAjena(), `student-${x}`))
        .rejects.toBeInstanceOf(NotFoundException);
      expect(data.prisma.competencyEvidence.count).not.toHaveBeenCalled();
    });

    it('el dominio no suma evidencia de otra institución', async () => {
      const dominio = await data.evidence.getMastery(actor, `student-${x}`, 'comp-reading');
      expect(dominio).toBe(0);
      expect(data.prisma.competencyEvidence.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ institutionId: actor }) }),
      );
    });

    it('no registra evidencia en un paso de otra institución', async () => {
      await data.evidence.recordFromActivity({
        institutionId: actor, studentId: `student-${actor === A ? 'A' : 'B'}`,
        activityId: actividadAjena(), scorePercent: 90, source: 'ACTIVITY', sourceRef: 'sub-1',
      });
      expect(data.prisma.competencyEvidence.upsert).not.toHaveBeenCalled();
    });
  });

  // ─── El trabajo legítimo sigue funcionando ────────────────────────────────
  describe('lo legítimo se conserva', () => {
    it('lee su ruta, con sus pasos, y sin exponer el material base', async () => {
      const ruta: any = await data.service.getRoute(A, 'route-A');
      expect(ruta.id).toBe('route-A');
      expect(ruta.steps).toHaveLength(1);
      expect(ruta.hasSourceMaterial).toBe(true);
      expect(ruta.sourceMaterial).toBeUndefined();
      expect(ruta.instructions).toBeUndefined();
    });

    it('crea ruta y paso en su propia aula', async () => {
      const ruta: any = await data.service.createRoute(A, { classroomId: 'classroom-A', title: ' Nueva ' });
      expect(ruta.institutionId).toBe(A);
      expect(ruta.title).toBe('Nueva');
      const paso: any = await data.service.addStep(A, ruta.id, { title: 'Paso propio', competencyId: 'comp-writing' });
      expect(paso.institutionId).toBe(A);
      expect(paso.sortOrder).toBe(0);
    });

    it('enlaza una actividad de su propia aula', async () => {
      const paso: any = await data.service.updateStep(A, 'step-A', { activityId: 'activity-A' });
      expect(paso.activityId).toBe('activity-A');
    });

    it('genera la lección de su paso y guarda las slides', async () => {
      const r = await data.service.generateStepLesson(A, 'step-A', 'Extra');
      expect(data.apdAi.generateEnglishLessonSlides).toHaveBeenCalledTimes(1);
      expect(r.slides).toBe(1);
      // Las indicaciones de la ruta viajan a Valeria junto con las del paso.
      expect((data.apdAi.generateEnglishLessonSlides as jest.Mock).mock.calls[0][0]).toMatchObject({
        skill: 'READING', level: 'A2', instructions: expect.stringContaining('Extra'),
      });
    });

    it('reordena los pasos propios', async () => {
      const segundo: any = await data.service.addStep(A, 'route-A', { title: 'Segundo' });
      await data.service.reorderSteps(A, 'route-A', [segundo.id, 'step-A']);
      expect(data.rows.learningRouteStep.find((s) => s.id === segundo.id).sortOrder).toBe(0);
      expect(data.rows.learningRouteStep.find((s) => s.id === 'step-A').sortOrder).toBe(1);
    });

    it('el catálogo de competencias es global: lo ven los dos colegios igual', async () => {
      const desdeA = await data.service.listCompetencies({});
      const desdeB = await data.service.listCompetencies({});
      expect(desdeA.map((c: any) => c.id)).toEqual(['comp-reading', 'comp-writing']);
      expect(desdeB).toEqual(desdeA);
    });

    it('el progreso propio se calcula con su evidencia', async () => {
      const progreso = await data.evidence.getRouteProgress(A, 'route-A', 'student-A');
      expect(progreso.totalSteps).toBe(1);
      expect(progreso.completedSteps).toBe(1);
      expect(progreso.targetMastery).toBe(80);
      expect(progreso.demonstrated).toBe(true);
    });
  });

  // ─── Cuerpos manipulados: no se reubica ni se sustituye una FK ─────────────
  describe('campos editables explícitos', () => {
    it('no muda la ruta a otra institución ni a otra aula, aunque el cuerpo lo pida', async () => {
      await data.service.updateRoute(A, 'route-A', {
        title: 'Título nuevo', institutionId: B, classroomId: 'classroom-B', sortOrder: 99,
      } as any);
      const ruta = data.rows.learningRoute.find((r) => r.id === 'route-A');
      expect(ruta.title).toBe('Título nuevo');
      expect(ruta.institutionId).toBe(A);
      expect(ruta.classroomId).toBe('classroom-A');
      expect(ruta.sortOrder).toBe(0);
      expect(data.prisma.learningRoute.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.not.objectContaining({ institutionId: expect.anything() }) }),
      );
    });

    it('no muda un paso a otra ruta desde el cuerpo', async () => {
      await data.service.updateStep(A, 'step-A', { title: 'Otro título', routeId: 'route-B', institutionId: B } as any);
      const paso = data.rows.learningRouteStep.find((s) => s.id === 'step-A');
      expect(paso.title).toBe('Otro título');
      expect(paso.routeId).toBe('route-A');
      expect(paso.institutionId).toBe(A);
    });

    it('rechaza una competencia inexistente antes de persistirla', async () => {
      await expect(data.service.updateRoute(A, 'route-A', { targetCompetencyId: 'comp-inventada' }))
        .rejects.toBeInstanceOf(NotFoundException);
      expect(data.prisma.learningRoute.updateMany).not.toHaveBeenCalled();
    });

    it('un título vacío no pasa', async () => {
      await expect(data.service.updateRoute(A, 'route-A', { title: '   ' }))
        .rejects.toBeInstanceOf(BadRequestException);
      expect(data.prisma.learningRoute.updateMany).not.toHaveBeenCalled();
    });

    it('reordenar sin pasos es una petición inválida, no un borrado silencioso', async () => {
      await expect(data.service.reorderSteps(A, 'route-A', []))
        .rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
