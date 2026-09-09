import { ClassroomService } from './classroom.service';

describe('Classroom copy completeness', () => {
  function setup() {
    const activity = {id:'without-unit',title:'Trabajo sin unidad',type:'TASK',academicTermId:'source-term',sectionId:null,maxScore:5,isPublished:true,metadata:{attachmentUrl:'/files/guide.pdf',attachmentName:'Guía'}};
    const source = {id:'source',color:null,teacherAssignment:{teacherId:'teacher',academicYear:{terms:[{id:'source-term',type:'PERIOD',order:1}]}},
      activities:[activity],sections:[{id:'unit',title:'Unidad',academicTermId:'source-term',materials:[],activities:[{...activity,id:'in-unit',sectionId:'unit'}]}],announcements:[]};
    const prisma = {
      classroom:{findUnique:jest.fn().mockResolvedValueOnce(source).mockResolvedValue({id:'target'})},
      teacherAssignment:{findFirst:jest.fn().mockResolvedValue({id:'assignment',institutionId:'institution',academicYear:{terms:[{id:'target-term',type:'PERIOD',order:1}]}})},
      classroomSection:{create:jest.fn().mockResolvedValue({id:'new-unit'})},
      classroomActivity:{create:jest.fn().mockImplementation(async ({data})=>({id:'copy-'+data.title,...data}))},
      forumPost:{findMany:jest.fn().mockResolvedValue([])},
    };
    const service = new ClassroomService(prisma as any,{} as any,{} as any,{} as any);
    jest.spyOn(service as any,'cloneActivityContent').mockResolvedValue({});
    return {service,prisma};
  }
  it('copies activities with and without units, as drafts and without student work',async()=>{
    const {service,prisma}=setup();
    expect((await service.copyClassroomTo('source',['assignment'],'teacher')).copied).toBe(1);
    const writes=prisma.classroomActivity.create.mock.calls.map(c=>c[0].data);
    expect(writes).toHaveLength(2);
    expect(writes.map(w=>w.sectionId)).toEqual(expect.arrayContaining(['new-unit',null]));
    for(const w of writes){expect(w.isPublished).toBe(false);expect(w.isVisible).toBe(false);expect(w).not.toHaveProperty('submissions');}
  });
  it('maps periods to the destination year and preserves the attached teaching material',async()=>{
    const {service,prisma}=setup();
    await service.copyClassroomTo('source',['assignment'],'teacher');
    expect(prisma.classroomSection.create.mock.calls[0][0].data.academicTermId).toBe('target-term');
    for(const [write] of prisma.classroomActivity.create.mock.calls){
      expect(write.data).toMatchObject({academicTermId:'target-term',metadata:{attachmentUrl:'/files/guide.pdf',attachmentName:'Guía'}});
    }
  });
});
