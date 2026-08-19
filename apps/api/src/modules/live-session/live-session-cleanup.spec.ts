import { Subject } from 'rxjs';
import { LiveSessionService } from './live-session.service';

/**
 * Regresión de `cleanupOrphanedStreams` (docs/security/RLS-AUDIT-FASE0.3.md §7).
 *
 * Este cron corre cada 5 minutos FUERA de toda petición HTTP, así que no tiene
 * contexto de tenant. Si algún día se activa RLS, su consulta devolverá 0 filas.
 * La versión anterior interpretaba "0 filas" como "todas las sesiones terminaron" y
 * cerraba los streams SSE: todos los quizzes en vivo caídos, en clase, sin errores.
 *
 * La prueba clave es «0 filas NO cierra nada». Si vuelve a fallar, el cron ha
 * recuperado el comportamiento destructivo.
 */
describe('LiveSessionService · cleanupOrphanedStreams', () => {
  const TWO_HOURS = 2 * 60 * 60 * 1000;

  function build(queryResult: any) {
    const $queryRaw = typeof queryResult === 'function'
      ? jest.fn(queryResult)
      : jest.fn().mockResolvedValue(queryResult);
    const prisma = { $queryRaw } as any;
    const service = new LiveSessionService(prisma);
    jest.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);
    jest.spyOn((service as any).logger, 'log').mockImplementation(() => undefined);
    return { service, $queryRaw };
  }

  /** Registra un stream vivo sin arrancar el heartbeat real (evita timers colgando). */
  function seedStream(service: LiveSessionService, sessionId: string, ageMs = 0) {
    (service as any).streams.set(sessionId, new Subject());
    (service as any).streamCreatedAt.set(sessionId, Date.now() - ageMs);
  }

  const openStreams = (service: LiveSessionService) => [...(service as any).streams.keys()];

  it('cierra el stream de una sesión FINISHED confirmada', async () => {
    const { service } = build([{ id: 's1', status: 'FINISHED' }]);
    seedStream(service, 's1');

    await service.cleanupOrphanedStreams();

    expect(openStreams(service)).toEqual([]);
  });

  it('mantiene abierta una sesión ACTIVE', async () => {
    const { service } = build([{ id: 's1', status: 'ACTIVE' }]);
    seedStream(service, 's1');

    await service.cleanupOrphanedStreams();

    expect(openStreams(service)).toEqual(['s1']);
  });

  it('mantiene abierta una sesión WAITING', async () => {
    const { service } = build([{ id: 's1', status: 'WAITING' }]);
    seedStream(service, 's1');

    await service.cleanupOrphanedStreams();

    expect(openStreams(service)).toEqual(['s1']);
  });

  // ── LA PRUEBA CRÍTICA ──────────────────────────────────────────────────────
  it('con 0 filas (RLS sin contexto de tenant) NO cierra ningún stream', async () => {
    const { service } = build([]);
    seedStream(service, 's1');
    seedStream(service, 's2');
    seedStream(service, 's3');

    await service.cleanupOrphanedStreams();

    expect(openStreams(service).sort()).toEqual(['s1', 's2', 's3']);
    expect((service as any).logger.error).toHaveBeenCalledWith(
      expect.stringContaining('ANOMALÍA'),
    );
  });

  it('si la consulta falla NO cierra ningún stream por estado', async () => {
    const { service } = build(() => Promise.reject(new Error('connection refused')));
    seedStream(service, 's1');

    await service.cleanupOrphanedStreams();

    expect(openStreams(service)).toEqual(['s1']);
    expect((service as any).logger.error).toHaveBeenCalled();
  });

  it('una sesión ausente de la respuesta es ambigua: no se cierra', async () => {
    // La consulta sí funcionó (devuelve s1), pero s2 no aparece: puede estar borrada
    // o simplemente no ser visible. No es un hecho confirmado → no se cierra.
    const { service } = build([{ id: 's1', status: 'ACTIVE' }]);
    seedStream(service, 's1');
    seedStream(service, 's2');

    await service.cleanupOrphanedStreams();

    expect(openStreams(service).sort()).toEqual(['s1', 's2']);
  });

  it('la red de seguridad de 2 h sigue cerrando streams antiguos aunque la BD falle', async () => {
    const { service } = build(() => Promise.reject(new Error('sin conexión')));
    seedStream(service, 'viejo', TWO_HOURS + 60_000);
    seedStream(service, 'nuevo', 60_000);

    await service.cleanupOrphanedStreams();

    expect(openStreams(service)).toEqual(['nuevo']);
  });

  it('no consulta la base de datos si no hay streams abiertos', async () => {
    const { service, $queryRaw } = build([]);

    await service.cleanupOrphanedStreams();

    expect($queryRaw).not.toHaveBeenCalled();
  });
});
