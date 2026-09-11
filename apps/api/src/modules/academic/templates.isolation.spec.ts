import { BadRequestException, NotFoundException } from '@nestjs/common';
import { templatesFixture } from '../../../test/fixtures/templates.fixture';

export const templateOperations = ['create','list','read','update','delete','add-area','update-area','delete-area','add-subject','update-subject','delete-subject','assign','sync','unassign','grade','add-exception','delete-exception','exceptions','quick','grades','effective'];

describe('Templates: actor scope, relationships and atomic defaults', () => {
  let f: ReturnType<typeof templatesFixture>;
  beforeEach(() => { f=templatesFixture(); });
  function run(op: string, x: string, inst: string) {
    const s=f.service;
    switch(op) {
      case 'create': return s.createTemplate({ institutionId: inst, academicYearId: 'year-'+x, name:'New', level:'PRIMARIA' });
      case 'list': return s.listTemplates(inst,'year-'+x);
      case 'read': return s.findTemplateById('template-'+x,inst);
      case 'update': return s.updateTemplate('template-'+x,{name:'Edited'},inst);
      case 'delete': return s.deleteTemplate('template-'+x,inst);
      case 'add-area': return s.addAreaToTemplate({templateId:'template-'+x,areaId:'area-'+x},inst);
      case 'update-area': return s.updateTemplateArea('ta-'+x,{order:1},inst);
      case 'delete-area': return s.removeAreaFromTemplate('ta-'+x,inst);
      case 'add-subject': return s.addSubjectToTemplateArea({templateAreaId:'ta-'+x,subjectId:'subject-'+x},inst);
      case 'update-subject': return s.updateTemplateSubject('ts-'+x,{weeklyHours:5},inst);
      case 'delete-subject': return s.removeSubjectFromTemplateArea('ts-'+x,inst,true);
      case 'assign': return s.assignTemplateToGrade('grade-'+x,'template-'+x,'year-'+x,inst);
      case 'sync': return s.syncTemplateFromActiveAssignments('grade-'+x,'year-'+x,inst);
      case 'unassign': return s.removeTemplateFromGrade('grade-'+x,'year-'+x,inst);
      case 'grade': return s.getGradeTemplate('grade-'+x,'year-'+x,inst);
      case 'add-exception': return s.addGroupException({groupId:'group-'+x,subjectId:'subject-'+x,academicYearId:'year-'+x,type:'EXCLUDE'},inst);
      case 'delete-exception': return s.removeGroupException('group-'+x,'subject-'+x,'year-'+x,inst);
      case 'exceptions': return s.getGroupExceptions('group-'+x,'year-'+x,inst);
      case 'quick': return s.quickSetup({institutionId:inst,gradeId:'grade-'+x,academicYearId:'year-'+x,areas:[{areaId:'area-'+x,subjects:[{subjectId:'subject-'+x,weeklyHours:4}]}]});
      case 'grades': return s.listGradesWithTemplates(inst,'year-'+x);
      default: return s.getEffectiveStructureForGroupInScope('group-'+x,'year-'+x,inst);
    }
  }
  describe.each([['A','B'],['B','A']])('actor %s, resource %s', (actor,target) => {
    it.each(templateOperations)('%s rejects before collections, counts, transactions and writes', async op => {
      await expect(run(op,target,'school-'+actor)).rejects.toBeInstanceOf(NotFoundException);
      expect(f.writes()).toEqual([]);
      expect(f.calls.filter(c => ['findMany','count','groupBy'].includes(c.method))).toEqual([]);
      expect(f.calls.filter(c => c.query.include)).toEqual([]);
      expect(f.prisma.$transaction).not.toHaveBeenCalled();
    });
  });
  it.each(templateOperations)('%s rejects omitted institution', async op => {
    await expect(run(op,'A','')).rejects.toBeInstanceOf(NotFoundException);
    expect(f.calls).toEqual([]);
  });
  it.each(['create','list','read','update','update-area','delete-area','update-subject','delete-subject','assign','sync','unassign','grade','add-exception','delete-exception','exceptions','quick','grades','effective'])('%s preserves a legitimate operation', async op => {
    await expect(run(op,'A','school-A')).resolves.toBeDefined();
    expect(f.rows.academicTemplate.find(t=>t.id==='template-B').name).toBe('Plantilla B');
  });
  it.each(['area','subject','template','exception-subject','quick-area','quick-subject'])('rejects a secondary foreign %s before writing', async kind => {
    const call = kind==='area' ? f.service.addAreaToTemplate({templateId:'template-A',areaId:'area-B'},'school-A')
      : kind==='subject' ? f.service.addSubjectToTemplateArea({templateAreaId:'ta-A',subjectId:'subject-B'},'school-A')
      : kind==='template' ? f.service.assignTemplateToGrade('grade-A','template-B','year-A','school-A')
      : kind==='exception-subject' ? f.service.addGroupException({groupId:'group-A',subjectId:'subject-B',academicYearId:'year-A',type:'EXCLUDE'},'school-A')
      : f.service.quickSetup({institutionId:'school-A',gradeId:'grade-A',academicYearId:'year-A',areas:[{areaId:kind==='quick-area'?'area-B':'area-A',subjects:[{subjectId:kind==='quick-subject'?'subject-B':'subject-A',weeklyHours:4}]}]});
    await expect(call).rejects.toBeInstanceOf(NotFoundException);
    expect(f.writes()).toEqual([]);
    expect(f.prisma.$transaction).not.toHaveBeenCalled();
  });
  it('rejects a template from another year in the same institution', async () => {
    f.rows.academicTemplate[0].academicYearId='old-year';
    await expect(run('assign','A','school-A')).rejects.toBeInstanceOf(BadRequestException);
    expect(f.writes()).toEqual([]);
  });
  it('rejects a subject from another area within the same school', async () => {
    f.rows.area.push({id:'other-area',institutionId:'school-A'});
    f.rows.subject[0].areaId='other-area';
    await expect(f.service.addSubjectToTemplateArea({templateAreaId:'ta-A',subjectId:'subject-A'},'school-A')).rejects.toBeInstanceOf(BadRequestException);
    expect(f.writes()).toEqual([]);
  });
  it('does not unset defaults in another academic year', async () => {
    f.rows.academicTemplate.push({id:'older',institutionId:'school-A',academicYearId:'older-year',level:'PRIMARIA',isDefault:true});
    await f.service.updateTemplate('template-A',{isDefault:true},'school-A');
    expect(f.rows.academicTemplate.find(t=>t.id==='older').isDefault).toBe(true);
  });
  it.each(['template','area','subject'])('ignores injected ownership fields when updating %s', async kind => {
    const data:any={institutionId:'school-B',templateId:'template-B',templateAreaId:'ta-B',subjectId:'subject-B',areaId:'area-B',academicYearId:'year-B'};
    if(kind==='template') await f.service.updateTemplate('template-A',data,'school-A');
    else if(kind==='area') await f.service.updateTemplateArea('ta-A',data,'school-A');
    else await f.service.updateTemplateSubject('ts-A',data,'school-A');
    expect(f.writes().every(c=>Object.keys(c.query.data||{}).length===0)).toBe(true);
  });
  it('filters preexisting foreign children from the template detail', async () => {
    f.rows.templateArea.push({id:'polluted',templateId:'template-A',areaId:'area-B'});
    const result=await f.service.findTemplateById('template-A','school-A');
    expect(result.templateAreas.map(t=>t.id)).toEqual(['ta-A']);
  });
  it('requires unassigning a template before deleting it', async () => {
    await expect(run('delete','A','school-A')).rejects.toBeInstanceOf(BadRequestException);
    expect(f.writes()).toEqual([]);
    f.rows.gradeTemplate=f.rows.gradeTemplate.filter(g=>g.gradeId!=='grade-A');
    await expect(run('delete','A','school-A')).resolves.toBeDefined();
    expect(f.rows.academicTemplate.map(t=>t.id)).toEqual(['template-B']);
  });
  it('rolls back defaults when template creation fails', async () => {
    f.rows.academicTemplate[0].isDefault=true;
    f.fail('academicTemplate.create');
    await expect(f.service.createTemplate({institutionId:'school-A',academicYearId:'year-A',name:'New',level:'PRIMARIA',isDefault:true})).rejects.toThrow('Synthetic failure');
    expect(f.rows.academicTemplate[0].isDefault).toBe(true);
  });
  it('rolls back dominant subjects when insertion fails', async () => {
    f.rows.templateSubject[0].isDominant=true;
    f.rows.subject.push({id:'new-subject',areaId:'area-A'});
    f.fail('templateSubject.create');
    await expect(f.service.addSubjectToTemplateArea({templateAreaId:'ta-A',subjectId:'new-subject',isDominant:true},'school-A')).rejects.toThrow('Synthetic failure');
    expect(f.rows.templateSubject[0].isDominant).toBe(true);
  });
  it('sync rejects an existing template assigned to the wrong year before writing', async () => {
    f.rows.academicTemplate[0].academicYearId='old-year';
    await expect(run('sync','A','school-A')).rejects.toBeInstanceOf(BadRequestException);
    expect(f.writes()).toEqual([]);
  });
  it('quick setup rolls back a newly created catalog when a later subject fails', async () => {
    const original=JSON.stringify(f.rows);
    f.fail('templateSubject.create');
    await expect(f.service.quickSetup({institutionId:'school-A',gradeId:'grade-A',academicYearId:'year-A',areas:[{newAreaName:'New area',subjects:[{newSubjectName:'New subject',weeklyHours:3}]}]})).rejects.toThrow('Synthetic failure');
    expect(JSON.stringify(f.rows)).toBe(original);
  });
  it('sync rolls back earlier area changes when a later subject update fails', async () => {
    f.rows.subject[0].name='Convivencia'; f.rows.subject[0].code='CONV';
    f.rows.area[0].name='Convivencia'; f.rows.area[0].code='CONV';
    const original=JSON.stringify(f.rows);
    f.fail('templateSubject.update');
    await expect(f.service.syncTemplateFromActiveAssignments('grade-A','year-A','school-A',{countInAverage:false})).rejects.toThrow('Synthetic failure');
    expect(JSON.stringify(f.rows)).toBe(original);
  });
});
