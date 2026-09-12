import { NotFoundException } from '@nestjs/common';
import {
  A,
  B,
  teacherScheduleFixture,
} from '../../../test/fixtures/teacher-schedule.fixture';

const input = {
  dayOfWeek: 'WEDNESDAY' as const,
  startTime: '10:00',
  endTime: '10:45',
  type: 'REUNION_AREA',
  title: 'Reunión de ciencias',
  location: 'Biblioteca',
};

describe('TeacherScheduleService · aislamiento A/B', () => {
  let data: ReturnType<typeof teacherScheduleFixture>;

  beforeEach(() => {
    data = teacherScheduleFixture();
  });

  describe.each([
    [A, B, 'A', 'B'],
    [B, A, 'B', 'A'],
  ])(
    'actor de %s frente a %s',
    (institutionId, foreignInstitutionId, ownSuffix, foreignSuffix) => {
      const teacherId = 'teacher-shared';

      it('findMine devuelve únicamente los bloques de su institución y su identidad', async () => {
        const result = await data.service.findMine(institutionId, teacherId);

        expect(result.map((row) => row.id)).toEqual([`block-${ownSuffix}`]);
        expect(result).not.toEqual(
          expect.arrayContaining([
            expect.objectContaining({ institutionId: foreignInstitutionId }),
            expect.objectContaining({ teacherId: `colleague-${ownSuffix}` }),
          ]),
        );
        expect(data.prisma.teacherScheduleBlock.findMany).toHaveBeenCalledWith({
          where: { institutionId, teacherId },
          orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        });
        expect(data.writes()).toEqual([]);
      });

      it('create ignora institución y docente falsificados y solo incrementa al actor', async () => {
        const ownBefore = data.count(institutionId, teacherId);
        const foreignBefore = data.count(foreignInstitutionId);

        const result = await data.service.create(institutionId, teacherId, {
          ...input,
          institutionId: foreignInstitutionId,
          teacherId: `colleague-${foreignSuffix}`,
        } as any);

        expect(result).toMatchObject({
          institutionId,
          teacherId,
          title: input.title,
        });
        expect(data.count(institutionId, teacherId)).toBe(ownBefore + 1);
        expect(data.count(foreignInstitutionId)).toBe(foreignBefore);
      });

      it('update trata el bloque del otro colegio como inexistente y no escribe', async () => {
        await expect(
          data.service.update(
            institutionId,
            teacherId,
            `block-${foreignSuffix}`,
            { title: 'Intento cruzado' },
          ),
        ).rejects.toBeInstanceOf(NotFoundException);

        expect(data.tx.teacherScheduleBlock.findFirst).toHaveBeenCalledWith({
          where: {
            id: `block-${foreignSuffix}`,
            institutionId,
            teacherId,
          },
          select: expect.objectContaining({ id: true }),
        });
        expect(data.tx.teacherScheduleBlock.update).not.toHaveBeenCalled();
        expect(data.writes()).toEqual([]);
        expect(
          data.rows.teacherScheduleBlock.find(
            (row) => row.id === `block-${foreignSuffix}`,
          ).title,
        ).toBe(`Matemáticas ${foreignSuffix}`);
      });

      it('remove trata el bloque del otro colegio como inexistente y no borra', async () => {
        const ownBefore = data.count(institutionId);
        const foreignBefore = data.count(foreignInstitutionId);

        await expect(
          data.service.remove(
            institutionId,
            teacherId,
            `block-${foreignSuffix}`,
          ),
        ).rejects.toBeInstanceOf(NotFoundException);

        expect(data.tx.teacherScheduleBlock.deleteMany).not.toHaveBeenCalled();
        expect(data.writes()).toEqual([]);
        expect(data.count(institutionId)).toBe(ownBefore);
        expect(data.count(foreignInstitutionId)).toBe(foreignBefore);
      });
    },
  );

  it.each(['update', 'remove'] as const)(
    '%s tampoco alcanza el bloque de otro docente del mismo colegio',
    async (operation) => {
      const action =
        operation === 'update'
          ? data.service.update(A, 'teacher-shared', 'colleague-block-A', {
              title: 'No es mío',
            })
          : data.service.remove(A, 'teacher-shared', 'colleague-block-A');

      await expect(action).rejects.toBeInstanceOf(NotFoundException);
      expect(data.writes()).toEqual([]);
      expect(
        data.rows.teacherScheduleBlock.find(
          (row) => row.id === 'colleague-block-A',
        ).title,
      ).toBe('Tutoría colega A');
    },
  );

  it('update propio acota la escritura completa y la ejecuta en la misma transacción', async () => {
    const result = await data.service.update(A, 'teacher-shared', 'block-A', {
      title: 'Álgebra 6A',
    });

    expect(result.title).toBe('Álgebra 6A');
    expect(data.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(data.tx.teacherScheduleBlock.update).toHaveBeenCalledWith({
      where: { id: 'block-A', institutionId: A, teacherId: 'teacher-shared' },
      data: expect.objectContaining({ title: 'Álgebra 6A' }),
    });
    expect(data.prisma.teacherScheduleBlock.update).not.toHaveBeenCalled();
    expect(
      data.rows.teacherScheduleBlock.find((row) => row.id === 'block-B').title,
    ).toBe('Matemáticas B');
  });

  it('remove propio guarda y borra de forma acotada dentro de una transacción', async () => {
    await expect(
      data.service.remove(A, 'teacher-shared', 'block-A'),
    ).resolves.toEqual({
      ok: true,
    });

    expect(data.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(data.tx.teacherScheduleBlock.deleteMany).toHaveBeenCalledWith({
      where: { id: 'block-A', institutionId: A, teacherId: 'teacher-shared' },
    });
    expect(data.prisma.teacherScheduleBlock.deleteMany).not.toHaveBeenCalled();
    expect(
      data.rows.teacherScheduleBlock.some((row) => row.id === 'block-A'),
    ).toBe(false);
    expect(
      data.rows.teacherScheduleBlock.some((row) => row.id === 'block-B'),
    ).toBe(true);
  });
});
