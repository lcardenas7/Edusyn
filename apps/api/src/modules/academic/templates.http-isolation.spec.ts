import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'node:crypto';
import request = require('supertest');
import { JwtStrategy } from '../auth/jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';
import { TemplatesController } from './templates.controller';
import { TemplatesService } from './templates.service';
import { templatesFixture } from '../../../test/fixtures/templates.fixture';

const cases = (x: string): [string,string,any?][] => [
  ['post','',{institutionId:'school-'+x,academicYearId:'year-'+x,name:'New',level:'PRIMARIA'}],
  ['get','?academicYearId=year-'+x], ['get','template-'+x], ['put','template-'+x,{name:'Edited'}], ['delete','template-'+x],
  ['post','template-'+x+'/areas',{areaId:'area-'+x}], ['put','areas/ta-'+x,{order:1}], ['delete','areas/ta-'+x],
  ['post','areas/ta-'+x+'/subjects',{subjectId:'subject-'+x}], ['put','subjects/ts-'+x,{weeklyHours:5}], ['delete','subjects/ts-'+x+'?force=true'],
  ['post','grades/grade-'+x+'/assign',{templateId:'template-'+x,academicYearId:'year-'+x}],
  ['post','grades/grade-'+x+'/sync-from-assignments',{academicYearId:'year-'+x}],
  ['delete','grades/grade-'+x+'/assign?academicYearId=year-'+x], ['get','grades/grade-'+x+'?academicYearId=year-'+x],
  ['post','groups/group-'+x+'/exceptions',{subjectId:'subject-'+x,academicYearId:'year-'+x,type:'EXCLUDE'}],
  ['delete','groups/group-'+x+'/exceptions/subject-'+x+'?academicYearId=year-'+x],
  ['get','groups/group-'+x+'/exceptions?academicYearId=year-'+x],
  ['post','quick-setup',{institutionId:'school-'+x,academicYearId:'year-'+x,gradeId:'grade-'+x,areas:[{areaId:'area-'+x,subjects:[{subjectId:'subject-'+x,weeklyHours:4}]}]}],
  ['get','grades?academicYearId=year-'+x], ['get','groups/group-'+x+'/effective-structure?academicYearId=year-'+x],
];
describe('Academic templates HTTP actor boundary', () => {
  let app: INestApplication, jwt: JwtService, f: ReturnType<typeof templatesFixture>;
  beforeEach(async () => {
    f=templatesFixture(); const secret=randomBytes(32).toString('hex'); jwt=new JwtService({secret});
    const module=await Test.createTestingModule({controllers:[TemplatesController],providers:[JwtStrategy,{provide:ConfigService,useValue:{getOrThrow:()=>secret}},{provide:PrismaService,useValue:f.prisma},{provide:TemplatesService,useValue:f.service}]}).compile();
    app=module.createNestApplication({logger:false}); app.useGlobalPipes(new ValidationPipe({transform:true,whitelist:true})); await app.init();
  });
  afterEach(async()=>{await app?.close();});
  const token=(school='A',role='ADMIN_INSTITUTIONAL')=>jwt.sign({sub:'actor-'+school,institutionId:'school-'+school,roles:[role]},{expiresIn:'1m'});
  function send(method:string,path:string,body:any,auth:string) {
    return request(app.getHttpServer())[method]('/academic-templates'+(path.startsWith('?')?'':'/')+path).auth(auth,{type:'bearer'}).send(body);
  }
  describe.each([['A','B'],['B','A']])('actor %s against %s',(actor,foreign)=>{
    it.each(cases(foreign).map(([method,path,body])=>[method,path,body]))('%s %s returns 404 without secondary queries or mutation',async(method,path,body)=>{
      await send(method,path,body,token(actor)).expect(404);
      expect(f.writes()).toEqual([]); expect(f.prisma.$transaction).not.toHaveBeenCalled();
      expect(f.calls.filter(c=>['findMany','count','groupBy'].includes(c.method))).toEqual([]);
    });
  });
  it.each(cases('A').filter(([method])=>method==='get').map(([method,path,body])=>[method,path,body]))('teacher can read %s %s in own school',async(method,path,body)=>{
    await send(method,path,body,token('A','DOCENTE')).expect(200);
    expect(f.writes()).toEqual([]);
  });
  it.each(cases('A').filter(([method])=>method!=='get').map(([method,path,body])=>[method,path,body]))('teacher cannot mutate %s %s',async(method,path,body)=>{
    await send(method,path,body,token('A','DOCENTE')).expect(403);
    expect(f.calls).toEqual([]);
  });
  it('body institution cannot replace the actor when creating',async()=>{
    await send('post','',{institutionId:'school-B',academicYearId:'year-A',name:'Actor-owned',level:'PRIMARIA'},token()).expect(201);
    expect(f.rows.academicTemplate.find(t=>t.name==='Actor-owned').institutionId).toBe('school-A');
  });
  it('body cannot replace the template ID in the path',async()=>{
    f.rows.templateArea=f.rows.templateArea.filter(t=>t.id!=='ta-A');
    await send('post','template-A/areas',{templateId:'template-B',areaId:'area-A'},token()).expect(201);
    expect(f.rows.templateArea.find(t=>t.id.startsWith('created-')).templateId).toBe('template-A');
  });
  it('body cannot move a template to another school or year',async()=>{
    await send('put','template-A',{institutionId:'school-B',academicYearId:'year-B',name:'Safe'},token()).expect(200);
    expect(f.rows.academicTemplate[0]).toMatchObject({institutionId:'school-A',academicYearId:'year-A',name:'Safe'});
  });
  it('enums is a static catalog and does not consult storage',async()=>{
    await send('get','enums',undefined,token('A','DOCENTE')).expect(200);
    expect(f.calls).toEqual([]);
  });
});
