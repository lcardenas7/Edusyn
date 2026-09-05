import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

import { PeriodFinalGradesService } from './period-final-grades.service';
import { PeriodFinalGradeWriter } from './period-final-grade.writer';
import {
  CAUSALES_NOTA_FINAL,
  decidirEscrituraNotaFinal,
  esCausalValida,
  HechosNotaFinal,
} from './period-final-grade-policy';

/**
 * F-1 · Contrato de quién puede fijar la nota final de período.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Antes de este cambio la única validación era que el período no estuviera
 * finalizado. Un docente podía fijar la nota final de una asignatura que no
 * imparte, en un grupo que no es suyo, y el alcance institucional se deducía de
 * la matrícula recibida en la petición en vez de la sesión.
 *
 * La política NO cierra la capacidad legítima del docente: cierra el permiso
 * indiscriminado. Estas pruebas fijan las dos mitades.
 */
describe('F-1 · política de la nota final de período', () => {
  const BASE: HechosNotaFinal = {
    roles: ['DOCENTE'],
    institucionSesion: 'inst-1',
    institucionMatricula: 'inst-1',
    institucionPeriodo: 'inst-1',
    institucionAsignatura: 'inst-1',
    periodoFinalizado: false,
    habilitacionInstitucional: true,
    esTitular: true,
    causal: 'RECUPERACION_NIVELACION',
  };
  const con = (cambios: Partial<HechosNotaFinal>) => decidirEscrituraNotaFinal({ ...BASE, ...cambios });

  // ═══════════════════════════════════════════════════════════════════════
  // 1. Alcance institucional: la sesión manda, la petición solo se contrasta
  // ═══════════════════════════════════════════════════════════════════════

  describe('el alcance institucional se deriva de la sesión', () => {
    it.each([
      ['la matrícula', 'institucionMatricula'],
      ['el período', 'institucionPeriodo'],
      ['la asignatura', 'institucionAsignatura'],
    ])('rechaza cuando %s es de otra institución', (_que, campo) => {
      const d = con({ [campo]: 'inst-2' } as Partial<HechosNotaFinal>);
      expect(d).toEqual({ permitido: false, motivo: 'FUERA_DE_INSTITUCION' });
    });

    it.each([
      ['la matrícula', 'institucionMatricula'],
      ['el período', 'institucionPeriodo'],
      ['la asignatura', 'institucionAsignatura'],
    ])('rechaza cuando %s no existe', (_que, campo) => {
      expect(con({ [campo]: null } as Partial<HechosNotaFinal>).permitido).toBe(false);
    });

    it('el alcance se comprueba ANTES que el rol: ni un supervisor entra en otra institución', () => {
      const d = con({ roles: ['ADMIN_INSTITUTIONAL'], institucionMatricula: 'inst-2' });
      expect(d.motivo).toBe('FUERA_DE_INSTITUCION');
    });

    it('el alcance se comprueba ANTES que el período: no revela el estado de lo ajeno', () => {
      const d = con({ institucionPeriodo: 'inst-2', periodoFinalizado: true });
      expect(d.motivo).toBe('FUERA_DE_INSTITUCION');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 2. Período
  // ═══════════════════════════════════════════════════════════════════════

  it('un período finalizado se rechaza incluso para un supervisor', () => {
    expect(con({ roles: ['RECTOR'], periodoFinalizado: true }).motivo).toBe('PERIODO_FINALIZADO');
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 3. Supervisores: operan sin titularidad ni causal
  // ═══════════════════════════════════════════════════════════════════════

  describe('coordinación, rectoría y administración operan dentro de su institución', () => {
    it.each([['COORDINADOR'], ['RECTOR'], ['ADMIN_INSTITUTIONAL'], ['SUPERADMIN']])(
      '%s puede aunque no sea titular y no declare causal',
      (rol) => {
        const d = con({ roles: [rol], esTitular: false, causal: undefined, habilitacionInstitucional: false });
        expect(d.permitido).toBe(true);
        expect(d.causalRegistrada).toBeUndefined();
      },
    );

    it('la habilitación institucional no condiciona a los supervisores', () => {
      expect(con({ roles: ['COORDINADOR'], habilitacionInstitucional: false }).permitido).toBe(true);
    });

    it('si un supervisor declara causal, se registra', () => {
      const d = con({ roles: ['RECTOR'], causal: 'HOMOLOGACION' });
      expect(d.causalRegistrada).toBe('HOMOLOGACION');
    });

    it('una causal inventada de un supervisor no se registra, pero tampoco bloquea', () => {
      const d = con({ roles: ['RECTOR'], causal: 'PORQUE_SI' });
      expect(d.permitido).toBe(true);
      expect(d.causalRegistrada).toBeUndefined();
    });

    it('el rector supervisor sigue siéndolo aunque también sea docente', () => {
      expect(con({ roles: ['DOCENTE', 'RECTOR'], esTitular: false, causal: undefined }).permitido).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 4. Docente: las cuatro condiciones son acumulativas
  // ═══════════════════════════════════════════════════════════════════════

  describe('el docente conserva su capacidad legítima, pero acotada', () => {
    it('con las cuatro condiciones cumplidas, puede', () => {
      const d = con({});
      expect(d.permitido).toBe(true);
      expect(d.causalRegistrada).toBe('RECUPERACION_NIVELACION');
    });

    it('sin habilitación institucional, no puede', () => {
      expect(con({ habilitacionInstitucional: false }).motivo).toBe('HABILITACION_INSTITUCIONAL_INACTIVA');
    });

    it('sin titularidad sobre la asignatura y el grupo, no puede', () => {
      expect(con({ esTitular: false }).motivo).toBe('SIN_TITULARIDAD');
    });

    it.each([[undefined], [null], [''], ['OTRO'], ['corrección'], [42], [{}]])(
      'sin causal tipificada válida (%p), no puede',
      (causal) => {
        expect(con({ causal }).motivo).toBe('CAUSAL_INVALIDA');
      },
    );

    it.each(CAUSALES_NOTA_FINAL.map((c) => [c]))('acepta la causal %s', (causal) => {
      const d = con({ causal });
      expect(d.permitido).toBe(true);
      expect(d.causalRegistrada).toBe(causal);
    });

    it('las causales son una lista cerrada de seis, sin opción libre', () => {
      expect([...CAUSALES_NOTA_FINAL].sort()).toEqual(
        [
          'CORRECCION_DOCUMENTADA',
          'EVALUACION_CUALITATIVA',
          'HOMOLOGACION',
          'INGRESO_TARDIO',
          'RECUPERACION_NIVELACION',
          'SIN_ACTIVIDADES_CONFIGURADAS',
        ].sort(),
      );
      expect(esCausalValida('OTRO')).toBe(false);
    });

    it('un rol ajeno al contrato no entra por la puerta del docente', () => {
      expect(con({ roles: ['ESTUDIANTE'] }).motivo).toBe('ROL_NO_AUTORIZADO');
      expect(con({ roles: [] }).motivo).toBe('ROL_NO_AUTORIZADO');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 5. El servicio traduce la decisión a la respuesta correcta
  // ═══════════════════════════════════════════════════════════════════════

  describe('el servicio aplica la política y responde con el tipo adecuado', () => {
    const prismaCon = (over: Record<string, any> = {}) => ({
      academicTerm: {
        findUnique: jest.fn().mockResolvedValue({ status: 'OPEN', academicYear: { institutionId: 'inst-1' } }),
      },
      subject: { findUnique: jest.fn().mockResolvedValue({ area: { institutionId: 'inst-1' } }) },
      institution: { findUnique: jest.fn().mockResolvedValue({ allowTeacherFinalGradeOverride: true }) },
      teacherAssignment: { findFirst: jest.fn().mockResolvedValue({ id: 'ta-1' }) },
      studentEnrollment: {
        findUnique: jest.fn().mockResolvedValue({ institutionId: 'inst-1', groupId: 'grp-1' }),
      },
      periodFinalGrade: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({ id: 'pfg-1', institutionId: 'inst-1' }),
        delete: jest.fn().mockResolvedValue({ id: 'pfg-1' }),
      },
      ...over,
    });

    /**
     * Servicio con el adaptador REAL: así las pruebas recorren la puerta única
     * de escritura en vez de un doble que podría divergir de ella.
     */
    const servicio = (prisma: any, audit: any = { record: jest.fn() }) =>
      new PeriodFinalGradesService(prisma, audit, new PeriodFinalGradeWriter(prisma, audit));

    const DOCENTE = { userId: 'u-doc', roles: ['DOCENTE'], institutionId: 'inst-1' };
    const NOTA = {
      studentEnrollmentId: 'enr-1',
      academicTermId: 't1',
      subjectId: 's1',
      finalScore: 4.2,
      enteredById: 'u-doc',
    };

    it('una matrícula de otra institución responde "no encontrado", no "prohibido"', async () => {
      const prisma: any = prismaCon({
        studentEnrollment: {
          findUnique: jest.fn().mockResolvedValue({ institutionId: 'inst-2', groupId: 'grp-9' }),
        },
      });
      const svc = servicio(prisma);

      await expect(svc.upsert({ ...NOTA, reason: 'HOMOLOGACION' }, DOCENTE)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.periodFinalGrade.upsert).not.toHaveBeenCalled();
    });

    it('sin titularidad responde prohibido y no escribe', async () => {
      const prisma: any = prismaCon({ teacherAssignment: { findFirst: jest.fn().mockResolvedValue(null) } });
      const svc = servicio(prisma);

      await expect(svc.upsert({ ...NOTA, reason: 'HOMOLOGACION' }, DOCENTE)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.periodFinalGrade.upsert).not.toHaveBeenCalled();
    });

    it('sin causal responde petición inválida y no escribe', async () => {
      const prisma: any = prismaCon();
      const svc = servicio(prisma);

      await expect(svc.upsert(NOTA, DOCENTE)).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.periodFinalGrade.upsert).not.toHaveBeenCalled();
    });

    it('con la habilitación institucional desactivada, el docente no escribe', async () => {
      const prisma: any = prismaCon({
        institution: { findUnique: jest.fn().mockResolvedValue({ allowTeacherFinalGradeOverride: false }) },
      });
      const svc = servicio(prisma);

      await expect(svc.upsert({ ...NOTA, reason: 'HOMOLOGACION' }, DOCENTE)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('cumpliendo todo, escribe y la causal viaja a la auditoría', async () => {
      const prisma: any = prismaCon();
      const audit = { record: jest.fn() };
      const svc = servicio(prisma, audit);

      await svc.upsert({ ...NOTA, reason: 'INGRESO_TARDIO' }, DOCENTE);

      expect(prisma.periodFinalGrade.upsert).toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalledTimes(1);
      expect(audit.record.mock.calls[0][0]).toMatchObject({
        source: 'PERIOD_FINAL_GRADE',
        reason: 'INGRESO_TARDIO',
        newScore: 4.2,
      });
    });

    it('la institución del registro creado sale de la sesión, nunca de la petición', async () => {
      const prisma: any = prismaCon();
      const svc = servicio(prisma);

      await svc.upsert({ ...NOTA, reason: 'INGRESO_TARDIO' }, DOCENTE);

      expect(prisma.periodFinalGrade.upsert.mock.calls[0][0].create).toMatchObject({
        institutionId: 'inst-1',
      });
    });

    it('borrar un registro de otra institución responde "no encontrado"', async () => {
      const prisma: any = prismaCon({
        periodFinalGrade: {
          findUnique: jest.fn().mockResolvedValue({
            academicTermId: 't1',
            finalScore: 3,
            institutionId: 'inst-2',
            studentEnrollmentId: 'enr-1',
            subjectId: 's1',
          }),
          delete: jest.fn(),
        },
      });
      const svc = servicio(prisma);

      await expect(svc.delete('pfg-1', DOCENTE, 'HOMOLOGACION')).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.periodFinalGrade.delete).not.toHaveBeenCalled();
    });

    it('borrar también exige la política: un docente sin titularidad no borra', async () => {
      const prisma: any = prismaCon({
        teacherAssignment: { findFirst: jest.fn().mockResolvedValue(null) },
        periodFinalGrade: {
          findUnique: jest.fn().mockResolvedValue({
            academicTermId: 't1',
            finalScore: 3,
            institutionId: 'inst-1',
            studentEnrollmentId: 'enr-1',
            subjectId: 's1',
          }),
          delete: jest.fn(),
        },
      });
      const svc = servicio(prisma);

      await expect(svc.delete('pfg-1', DOCENTE, 'HOMOLOGACION')).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.periodFinalGrade.delete).not.toHaveBeenCalled();
    });
  });
});
