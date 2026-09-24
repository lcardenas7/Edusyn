import { A, actorDe, fixture } from '../../../test/fixtures/classroom-b1.fixture';

/**
 * Casos adversariales de revisión de B1. Esta rama conserva las pruebas rojas para
 * que Kimi las reproduzca antes de corregir; no se integra mientras fallen.
 */
describe('Classroom B1 · revisión adversarial de proyecciones', () => {
  const estudiante = () => actorDe({ institutionId: A, userId: 'user-A1', roles: ['ESTUDIANTE'] });

  it('el listado de aulas no cuenta borradores para estudiantes', async () => {
    const data = fixture();
    const aulas = await data.service.listForStudent(estudiante());
    const aula = aulas.find((item: any) => item.id === 'class-A');
    expect(aula?._count.activities).toBe(3);
  });

  it('una actividad de B enlazada a una sección de A no aparece en el aula de A', async () => {
    const data = fixture();
    const ajena = data.rows.classroomActivity.find((item: any) => item.id === 'act-B-pub');
    ajena.sectionId = 'section-A1';
    ajena.title = 'SECRETO-DE-B';
    const aula = await data.service.getById(estudiante(), 'class-A');
    expect(JSON.stringify(aula)).not.toContain('SECRETO-DE-B');
  });

  it('una actividad restringida no aparece en la sección de un estudiante sin asignación', async () => {
    const data = fixture();
    const restringida = data.rows.classroomActivity.find((item: any) => item.id === 'act-A-restr');
    restringida.sectionId = 'section-A1';
    const noAsignado = actorDe({ institutionId: A, userId: 'user-A2', roles: ['ESTUDIANTE'] });
    const aula = await data.service.getById(noAsignado, 'class-A');
    expect(aula.sections[0].activities.map((item: any) => item.id)).not.toContain('act-A-restr');
  });

  it('una sección de A con periodo de B no entrega el nombre del periodo ajeno', async () => {
    const data = fixture();
    const seccion = data.rows.classroomSection.find((item: any) => item.id === 'section-A1');
    seccion.academicTermId = 'term-B';
    seccion.academicTerm = data.rows.academicTerm.find((item: any) => item.id === 'term-B');
    const aula = await data.service.getById(estudiante(), 'class-A');
    expect(JSON.stringify(aula.sections)).not.toContain('term-B');
  });

  it('una actividad de A enlazada a una sección de B no entrega el título de B', async () => {
    const data = fixture();
    const actividad = data.rows.classroomActivity.find((item: any) => item.id === 'act-A-pub');
    actividad.sectionId = 'section-B1';
    actividad.section = data.rows.classroomSection.find((item: any) => item.id === 'section-B1');
    const detalle = await data.service.getActivity(estudiante(), 'act-A-pub');
    expect(JSON.stringify(detalle)).not.toContain('Unidad B');
  });
});
