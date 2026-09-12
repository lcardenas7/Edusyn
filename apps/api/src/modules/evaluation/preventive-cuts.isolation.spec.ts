import { NotFoundException } from '@nestjs/common';
import {
  preventiveCutsFixture,
  SCHOOL_A,
  SCHOOL_B,
} from '../../../test/fixtures/preventive-cuts.fixture';

const cutoffDate = new Date('2026-05-15T12:00:00.000Z');

describe('PreventiveCutsService — aislamiento institucional A/B', () => {
  let f: ReturnType<typeof preventiveCutsFixture>;

  beforeEach(() => {
    f = preventiveCutsFixture();
  });

  function expectNoEffects() {
    expect(f.grades.calculateTermGradeAtDate).not.toHaveBeenCalled();
    expect(f.storage.resolveFileUrl).not.toHaveBeenCalled();
    expect(f.writes()).toEqual([]);
  }

  describe.each([
    ['A → B', SCHOOL_A, 'B'],
    ['B → A', SCHOOL_B, 'A'],
  ] as const)('%s: un identificador ajeno se comporta como inexistente', (_label, actor, foreign) => {
    it('no crea ni cambia la configuración ajena', async () => {
      await expect(f.service.upsertConfig(actor, {
        academicTermId: `term-${foreign}`,
        cutoffDate,
        riskThresholdScore: 3.2,
      })).rejects.toBeInstanceOf(NotFoundException);
      expectNoEffects();
    });

    it('no lee la configuración ajena', async () => {
      await expect(f.service.getConfig(actor, `term-${foreign}`)).rejects.toBeInstanceOf(NotFoundException);
      expectNoEffects();
    });

    it('no lista alertas mediante un filtro ajeno', async () => {
      await expect(f.service.listAlerts(actor, {
        teacherAssignmentId: `assignment-${foreign}`,
      })).rejects.toBeInstanceOf(NotFoundException);
      expectNoEffects();
    });

    it('no modifica una alerta ajena', async () => {
      await expect(f.service.updateAlert(actor, `alert-${foreign}`, {
        status: 'RESOLVED' as any,
        notes: 'intrusión',
      })).rejects.toBeInstanceOf(NotFoundException);
      expectNoEffects();
    });

    it('no ejecuta el corte ni calcula notas de una asignación ajena', async () => {
      await expect(f.service.execute(actor, {
        teacherAssignmentId: `assignment-${foreign}`,
        academicTermId: `term-${foreign}`,
        cutoffDate,
      })).rejects.toBeInstanceOf(NotFoundException);
      expectNoEffects();
    });

    it('no construye la vista consolidada de un grupo ajeno', async () => {
      await expect(f.service.executeGroupView(actor, {
        academicTermId: `term-${foreign}`,
        groupId: `group-${foreign}`,
        cutoffDate,
      })).rejects.toBeInstanceOf(NotFoundException);
      expectNoEffects();
    });

    it('no genera el PDF de un grupo ajeno ni resuelve su logo', async () => {
      await expect(f.service.generateGroupPdf(actor, {
        academicTermId: `term-${foreign}`,
        groupId: `group-${foreign}`,
        cutoffDate,
      })).rejects.toBeInstanceOf(NotFoundException);
      expectNoEffects();
    });

    it('no genera el PDF nominal de una matrícula ajena ni resuelve su logo', async () => {
      await expect(f.service.generateStudentPdf(actor, {
        academicTermId: `term-${foreign}`,
        groupId: `group-${foreign}`,
        studentEnrollmentId: `enrollment-${foreign}`,
        cutoffDate,
      })).rejects.toBeInstanceOf(NotFoundException);
      expectNoEffects();
    });
  });

  describe.each([
    ['colegio A', SCHOOL_A, 'A'],
    ['colegio B', SCHOOL_B, 'B'],
  ] as const)('%s: operaciones legítimas', (_label, actor, own) => {
    it('guarda su configuración', async () => {
      const result = await f.service.upsertConfig(actor, {
        academicTermId: `term-${own}`,
        cutoffDate,
        riskThresholdScore: 3.2,
      });
      expect(Number(result.riskThresholdScore)).toBe(3.2);
      expect(f.rows.preventiveCutConfig.find((row) => row.id === `config-${own}`).cutoffDate).toEqual(cutoffDate);
    });

    it('lee su configuración', async () => {
      const result = await f.service.getConfig(actor, `term-${own}`);
      expect(result).toMatchObject({ id: `config-${own}`, academicTermId: `term-${own}` });
    });

    it('lista únicamente sus alertas cuando no recibe filtros', async () => {
      const result = await f.service.listAlerts(actor, {});
      expect(result.map((alert: any) => alert.id)).toEqual([`alert-${own}`]);
      expect(result[0].studentEnrollment.student.institutionId).toBe(actor);
    });

    it('actualiza su alerta dentro del cliente transaccional', async () => {
      const result = await f.service.updateAlert(actor, `alert-${own}`, {
        status: 'RESOLVED' as any,
        notes: `Cerrada ${own}`,
      });
      expect(result).toMatchObject({ id: `alert-${own}`, status: 'RESOLVED', notes: `Cerrada ${own}` });
      expect(f.calls.some((call) => call.inTransaction && call.model === 'preventiveAlert' && call.method === 'updateMany')).toBe(true);
    });

    it('ejecuta su corte y conserva un flujo IN_RECOVERY', async () => {
      const result = await f.service.execute(actor, {
        teacherAssignmentId: `assignment-${own}`,
        academicTermId: `term-${own}`,
        cutoffDate,
      });
      expect(result).toMatchObject({ totalStudents: 1, atRisk: 1 });
      expect(result.alerts[0]).toMatchObject({
        id: `alert-${own}`,
        institutionId: actor,
        status: 'IN_RECOVERY',
        computedGrade: 2.5,
      });
      expect(f.grades.calculateTermGradeAtDate).toHaveBeenCalledWith(
        `enrollment-${own}`,
        `assignment-${own}`,
        `term-${own}`,
        cutoffDate,
        actor,
      );
    });

    it('construye su vista consolidada sin filas del otro colegio', async () => {
      const result = await f.service.executeGroupView(actor, {
        academicTermId: `term-${own}`,
        groupId: `group-${own}`,
        cutoffDate,
      });
      expect(result.institution.id).toBe(actor);
      expect(result.group.id).toBe(`group-${own}`);
      expect(result.students.map((student) => student.studentEnrollmentId)).toEqual([`enrollment-${own}`]);
      expect(result.subjectNames).toEqual([`Materia ${own}`]);
    });

    it('genera su PDF consolidado', async () => {
      const result = await f.service.generateGroupPdf(actor, {
        academicTermId: `term-${own}`,
        groupId: `group-${own}`,
        cutoffDate,
      });
      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.subarray(0, 4).toString()).toBe('%PDF');
    });

    it('genera el PDF de su estudiante', async () => {
      const result = await f.service.generateStudentPdf(actor, {
        academicTermId: `term-${own}`,
        groupId: `group-${own}`,
        studentEnrollmentId: `enrollment-${own}`,
        cutoffDate,
      });
      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.subarray(0, 4).toString()).toBe('%PDF');
    });
  });

  describe('coordenadas académicas mezcladas', () => {
    it('rechaza período y asignación propios que pertenecen a años diferentes', async () => {
      await expect(f.service.execute(SCHOOL_A, {
        teacherAssignmentId: 'assignment-A',
        academicTermId: 'term-A-alt',
        cutoffDate,
      })).rejects.toBeInstanceOf(NotFoundException);
      expectNoEffects();
    });

    it('rechaza un grupo ajeno aunque el período sea propio', async () => {
      await expect(f.service.executeGroupView(SCHOOL_A, {
        academicTermId: 'term-A',
        groupId: 'group-B',
        cutoffDate,
      })).rejects.toBeInstanceOf(NotFoundException);
      expectNoEffects();
    });

    it('rechaza una matrícula ajena aunque período y grupo sean propios', async () => {
      await expect(f.service.generateStudentPdf(SCHOOL_A, {
        academicTermId: 'term-A',
        groupId: 'group-A',
        studentEnrollmentId: 'enrollment-B',
        cutoffDate,
      })).rejects.toBeInstanceOf(NotFoundException);
      expectNoEffects();
    });

    it('rechaza una combinación de filtros propios y ajenos antes de listar alertas', async () => {
      await expect(f.service.listAlerts(SCHOOL_A, {
        teacherAssignmentId: 'assignment-A',
        academicTermId: 'term-B',
      })).rejects.toBeInstanceOf(NotFoundException);
      expectNoEffects();
    });

    it('excluye del lote una matrícula cuyo institutionId dice A pero cuyo grupo pertenece a B', async () => {
      f.rows.studentEnrollment.push({
        id: 'enrollment-A-corrupt',
        institutionId: SCHOOL_A,
        studentId: 'student-A',
        academicYearId: 'year-A',
        groupId: 'group-B',
        status: 'ACTIVE',
      });
      await f.service.execute(SCHOOL_A, {
        teacherAssignmentId: 'assignment-A',
        academicTermId: 'term-A',
        cutoffDate,
      });
      expect(f.grades.calculateTermGradeAtDate).not.toHaveBeenCalledWith(
        'enrollment-A-corrupt',
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
    });
  });

  it('revierte el lote completo si una escritura intermedia falla', async () => {
    f.addSecondEnrollment('A');
    const before = f.rows.preventiveAlert.map((alert) => ({ ...alert }));
    f.fail('preventiveAlert.create');

    await expect(f.service.execute(SCHOOL_A, {
      teacherAssignmentId: 'assignment-A',
      academicTermId: 'term-A',
      cutoffDate,
    })).rejects.toThrow('Fallo sintético');

    expect(f.rows.preventiveAlert).toEqual(before);
    expect(f.calls.some((call) => call.inTransaction && call.model === 'preventiveAlert' && call.method === 'updateMany')).toBe(true);
    expect(f.calls.some((call) => call.inTransaction && call.model === 'preventiveAlert' && call.method === 'create')).toBe(true);
  });
});
