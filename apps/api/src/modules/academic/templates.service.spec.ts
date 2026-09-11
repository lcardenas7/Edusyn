import { templatesFixture } from '../../../test/fixtures/templates.fixture';

/** Quick setup keeps catalog creation, template and grade assignment together. */
describe('TemplatesService.quickSetup', () => {
  const dto = {
    institutionId: 'school-A', academicYearId: 'year-A', gradeId: 'grade-A',
    areas: [{ newAreaName: 'Matemáticas nuevas', subjects: [{ newSubjectName: 'Álgebra nueva', weeklyHours: 4 }, { newSubjectName: 'Geometría nueva', weeklyHours: 3 }] }],
  };
  it('rechaza preescolar (usa dimensiones)', async () => {
    const f = templatesFixture();
    f.rows.grade[0].stage = 'PREESCOLAR';
    await expect(f.service.quickSetup(dto)).rejects.toThrow(/dimensiones/i);
    expect(f.writes()).toEqual([]);
  });
  it('rechaza si no hay áreas', async () => {
    const f = templatesFixture();
    await expect(f.service.quickSetup({ ...dto, areas: [] })).rejects.toThrow(/al menos un área/i);
    expect(f.writes()).toEqual([]);
  });
  it('crea catálogo + plantilla + asignación en la transacción', async () => {
    const f = templatesFixture();
    f.rows.gradeTemplate = f.rows.gradeTemplate.filter(g => g.gradeId !== 'grade-A');
    const result = await f.service.quickSetup(dto);
    expect(result.success).toBe(true);
    expect(f.rows.subject.filter(s => /nueva/.test(s.name)).map(s => s.name).sort()).toEqual(['Geometría nueva', 'Álgebra nueva'].sort());
    expect(f.tx.gradeTemplate.create).toHaveBeenCalled();
    expect(f.writes().every(c => c.inTransaction)).toBe(true);
  });
  it('reutiliza una materia existente en vez de duplicarla', async () => {
    const f = templatesFixture();
    f.rows.area.push({ id: 'reused-area', institutionId: 'school-A', name: 'Matemáticas nuevas' });
    f.rows.subject.push({ id: 'reused-subject', areaId: 'reused-area', name: 'Álgebra nueva' });
    await f.service.quickSetup(dto);
    expect(f.tx.subject.create).toHaveBeenCalledTimes(1);
    expect(f.rows.templateSubject.some(ts => ts.subjectId === 'reused-subject')).toBe(true);
  });
});
