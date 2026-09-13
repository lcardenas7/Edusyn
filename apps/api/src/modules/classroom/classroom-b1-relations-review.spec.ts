import { NotFoundException } from '@nestjs/common';
import { A, B, actorDe, fixture } from '../../../test/fixtures/classroom-b1.fixture';

describe('Classroom B1 · relaciones devueltas por detalle de actividad', () => {
  it.each([[A, 'A', 'B'], [B, 'B', 'A']])('no incluye rúbrica ajena para actor %s', async (institutionId, own, foreign) => {
    const f = fixture();
    const activity = f.rows.classroomActivity.find((r) => r.id === `act-${own}-pub`);
    activity.rubricId = `rubric-${foreign}`;
    // Como una relación Prisma: solo aparece si la consulta pide include/select.
    Object.defineProperty(activity, 'rubric', { configurable: true, enumerable: false,
      value: { id: `rubric-${foreign}`, institutionId: foreign === 'A' ? A : B,
        name: `RUBRICA-SECRETA-${foreign}`, criteria: [] } });
    const actor = actorDe({ institutionId, userId: `user-${own}1`, roles: ['ESTUDIANTE'] });
    const result = await f.service.getActivity(actor, activity.id).catch((e) => {
      if (e instanceof NotFoundException) return null;
      throw e;
    });
    expect(JSON.stringify(result)).not.toContain(`RUBRICA-SECRETA-${foreign}`);
  });

  it('el detalle de actividad no entrega el título de una sección oculta al estudiante', async () => {
    const f = fixture();
    f.rows.classroomActivity.find((r) => r.id === 'act-A-pub').sectionId = 'section-A2';
    const actor = actorDe({ institutionId: A, userId: 'user-A1', roles: ['ESTUDIANTE'] });
    const result = await f.service.getActivity(actor, 'act-A-pub');
    expect(result.section).toBeNull();
  });
});
