import { TemplatesService } from '../../src/modules/academic/templates.service';

export function templatesFixture() {
  const models = ['academicYear','grade','campus','group','area','subject','academicTemplate','templateArea','templateSubject','gradeTemplate','groupSubjectException','teacherAssignment','partialGrade','periodFinalGrade'];
  const rows: Record<string, any[]> = Object.fromEntries(models.map(m => [m, []]));
  for (const x of ['A','B']) {
    const institutionId = 'school-' + x;
    rows.academicYear.push({ id: 'year-' + x, institutionId });
    rows.grade.push({ id: 'grade-' + x, institutionId, name: 'Quinto ' + x, stage: 'BASICA_PRIMARIA' });
    rows.campus.push({ id: 'campus-' + x, institutionId });
    rows.group.push({ id: 'group-' + x, gradeId: 'grade-' + x, campusId: 'campus-' + x });
    rows.area.push({ id: 'area-' + x, institutionId, name: 'Matemáticas ' + x, code: 'MAT' });
    rows.subject.push({ id: 'subject-' + x, areaId: 'area-' + x, name: 'Álgebra ' + x, code: 'ALG' });
    rows.academicTemplate.push({ id: 'template-' + x, institutionId, academicYearId: 'year-' + x, name: 'Plantilla ' + x, level: 'PRIMARIA', isActive: true, isDefault: false });
    rows.templateArea.push({ id: 'ta-' + x, templateId: 'template-' + x, areaId: 'area-' + x, weightPercentage: 100, calculationType: 'AVERAGE', isMandatory: true });
    rows.templateSubject.push({ id: 'ts-' + x, templateAreaId: 'ta-' + x, subjectId: 'subject-' + x, weeklyHours: 4, isDominant: false });
    rows.gradeTemplate.push({ id: 'gt-' + x, gradeId: 'grade-' + x, templateId: 'template-' + x, academicYearId: 'year-' + x });
    rows.groupSubjectException.push({ id: 'ex-' + x, groupId: 'group-' + x, subjectId: 'subject-' + x, academicYearId: 'year-' + x, type: 'MODIFY', weeklyHours: 5 });
    rows.teacherAssignment.push({ id: 'assignment-' + x, institutionId, academicYearId: 'year-' + x, groupId: 'group-' + x, subjectId: 'subject-' + x, endDate: null, weeklyHours: 4 });
  }
  // Relation predicates are evaluated against current rows, not pre-baked objects.
  const one: Record<string, Record<string, [string, string]>> = {
    group: { grade: ['grade','gradeId'], campus: ['campus','campusId'] }, subject: { area: ['area','areaId'] },
    academicTemplate: { academicYear: ['academicYear','academicYearId'] },
    templateArea: { template: ['academicTemplate','templateId'], area: ['area','areaId'] },
    templateSubject: { templateArea: ['templateArea','templateAreaId'], subject: ['subject','subjectId'] },
    gradeTemplate: { grade: ['grade','gradeId'], template: ['academicTemplate','templateId'], academicYear: ['academicYear','academicYearId'] },
    groupSubjectException: { group: ['group','groupId'], subject: ['subject','subjectId'], academicYear: ['academicYear','academicYearId'] },
    teacherAssignment: { group: ['group','groupId'], subject: ['subject','subjectId'], academicYear: ['academicYear','academicYearId'] },
    partialGrade: { teacherAssignment: ['teacherAssignment','teacherAssignmentId'] },
  };
  const many: Record<string, Record<string, [string, string]>> = {
    academicTemplate: { templateAreas: ['templateArea','templateId'], gradeTemplates: ['gradeTemplate','templateId'] },
    templateArea: { templateSubjects: ['templateSubject','templateAreaId'] },
    grade: { gradeTemplates: ['gradeTemplate','gradeId'] }, group: { subjectExceptions: ['groupSubjectException','groupId'] },
  };
  function matches(model: string, row: any, where: any = {}): boolean {
    if (!row) return false;
    return Object.entries(where).every(([key, value]: [string, any]) => {
      if (value === undefined) return true;
      if (key === 'AND') return (Array.isArray(value) ? value : [value]).every(w => matches(model,row,w));
      if (key === 'OR') return value.some((w: any) => matches(model,row,w));
      const single = one[model]?.[key];
      if (single) return matches(single[0], rows[single[0]].find(r => r.id === row[single[1]]), value);
      const multiple = many[model]?.[key];
      if (multiple) {
        const related = rows[multiple[0]].filter(r => r[multiple[1]] === row.id);
        if ('none' in value) return !related.some(r => matches(multiple[0],r,value.none));
        if ('some' in value) return related.some(r => matches(multiple[0],r,value.some));
        throw new Error('Unsupported collection predicate');
      }
      if (value && typeof value === 'object') {
        if ('in' in value) return value.in.includes(row[key]);
        if ('not' in value) return row[key] !== value.not;
        throw new Error('Unsupported predicate: ' + key);
      }
      return row[key] === value;
    });
  }
  function project(model: string, row: any, query: any = {}): any {
    if (!row) return null;
    const result: any = query.select ? {} : { ...row };
    for (const [key, spec] of Object.entries(query.select || query.include || {}) as [string, any][]) {
      if (!spec) continue;
      if (key === '_count') {
        result[key] = Object.fromEntries(Object.keys(spec.select).map(k => {
          const relation = many[model]?.[k]; return [k, relation ? rows[relation[0]].filter(r => r[relation[1]] === row.id).length : 0];
        })); continue;
      }
      const single = one[model]?.[key], multiple = many[model]?.[key];
      if (single) result[key] = project(single[0],rows[single[0]].find(r => r.id === row[single[1]]),spec === true ? {} : spec);
      else if (multiple) result[key] = rows[multiple[0]].filter(r => r[multiple[1]] === row.id && matches(multiple[0],r,spec.where)).map(r => project(multiple[0],r,spec === true ? {} : spec));
      else result[key] = row[key];
    }
    return result;
  }
  let next = 0;
  let failPoint = '';
  const calls: any[] = [];
  function client(inTransaction: boolean) {
    const db: any = {};
    for (const model of models) {
      db[model] = {};
      for (const method of ['findFirst','findMany','count','groupBy','create','update','updateMany','deleteMany']) {
        db[model][method] = jest.fn(async (query: any = {}) => {
          calls.push({ model, method, query, inTransaction });
          if (failPoint === model + '.' + method) throw new Error('Synthetic failure');
          const records = rows[model].filter(r => matches(model,r,query.where));
          if (method === 'findFirst') return project(model,records[0],query);
          if (method === 'findMany') return records.map(r => project(model,r,query));
          if (method === 'count') return records.length;
          if (method === 'groupBy') return [...new Set(records.map(r => r.groupId))].map(groupId => ({ groupId, _count: { _all: records.filter(r => r.groupId === groupId).length } }));
          if (method === 'create') {
            const row = { id: 'created-' + (++next), isActive: true, ...query.data };
            rows[model].push(row); return project(model,row,query);
          }
          if (method === 'deleteMany') { rows[model] = rows[model].filter(r => !records.includes(r)); return { count: records.length }; }
          if (method === 'update') {
            if (!records[0]) throw new Error('P2025');
            Object.assign(records[0],query.data); return project(model,records[0],query);
          }
          records.forEach(r => Object.assign(r,query.data)); return { count: records.length };
        });
      }
    }
    return db;
  }
  const prisma=client(false), tx=client(true);
  prisma.$transaction=jest.fn(async (action: any) => {
    const before=Object.fromEntries(Object.entries(rows).map(([m,r]) => [m,r.map(x => ({...x}))]));
    try { return await action(tx); } catch (error) { Object.assign(rows,before); throw error; }
  });
  return { rows, prisma, tx, calls, service: new TemplatesService(prisma), fail: (point: string) => { failPoint=point; }, writes: () => calls.filter(c => ['create','update','updateMany','deleteMany'].includes(c.method)) };
}
