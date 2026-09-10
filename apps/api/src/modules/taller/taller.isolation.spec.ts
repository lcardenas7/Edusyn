import { NotFoundException } from '@nestjs/common';
import { TallerController } from './taller.controller';
import { TallerService } from './taller.service';

const A = { institutionId: 'school-A', userId: 'user-A' };
const B = { institutionId: 'school-B', userId: 'user-B' };
const writes = ['create', 'createMany', 'updateMany', 'deleteMany'];

// A missing where.institutionId really returns the foreign row: permissive mocks cannot
// silently make a removed guard/filter pass. Mutations also filter the in-memory rows.
function matches(row: any, where: any = {}): boolean {
  return Object.entries(where).every(([key, value]: [string, any]) => {
    if (value === undefined) return true;
    if (key === 'OR') return value.some((clause: any) => matches(row, clause));
    if (value && typeof value === 'object' && 'in' in value) return value.in.includes(row[key]);
    return row[key] === value;
  });
}

function harness() {
  const rows: Record<string, any[]> = { abpTeam: [], classroom: [], tallerInstrument: [], tallerObject: [], tallerRelation: [], tallerEvent: [] };
  for (const [suffix, ctx] of [['A', A], ['B', B]] as const) {
    rows.abpTeam.push({ id: `team-${suffix}`, institutionId: ctx.institutionId, projectId: `project-${suffix}`, project: { classroomId: `class-${suffix}` }, members: [{ studentEnrollmentId: `enr-${suffix}`, studentEnrollment: { student: { userId: ctx.userId, firstName: suffix, lastName: 'Synthetic' } } }] });
    rows.classroom.push({ id: `class-${suffix}`, institutionId: ctx.institutionId, teacherAssignment: { teacherId: `teacher-${suffix}` } });
    rows.tallerInstrument.push({ id: `inst-${suffix}`, institutionId: ctx.institutionId, teamId: `team-${suffix}`, motor: 'BOARD', dynamic: null, stationId: null });
    for (const n of [1, 2]) rows.tallerObject.push({ id: `obj-${suffix}-${n}`, institutionId: ctx.institutionId, teamId: `team-${suffix}`, instrumentId: `inst-${suffix}`, deletedAt: null, version: 1, type: 'PostIt', authorId: `enr-${suffix}`, data: { text: 'Synthetic' } });
    rows.tallerRelation.push({ id: `rel-${suffix}`, institutionId: ctx.institutionId, teamId: `team-${suffix}`, fromId: `obj-${suffix}-1`, toId: `obj-${suffix}-2`, relType: 'conecta-con' });
  }
  const prisma: any = {};
  let nextId = 0;
  for (const [model, records] of Object.entries(rows)) {
    prisma[model] = {
      findFirst: jest.fn(async ({ where }: any) => records.find(r => matches(r, where)) ?? null),
      findMany: jest.fn(async ({ where }: any) => records.filter(r => matches(r, where))),
      create: jest.fn(async ({ data }: any) => {
        const row = { id: `new-${++nextId}`, deletedAt: null, version: 1, ...data };
        records.push(row); return row;
      }),
      createMany: jest.fn(async ({ data }: any) => {
        let count = 0;
        for (const row of data) {
          if (model === 'tallerRelation' && records.some(r => r.fromId === row.fromId && r.toId === row.toId && r.relType === row.relType)) continue;
          records.push({ id: `new-${++nextId}`, ...row }); count++;
        }
        return { count };
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const found = records.filter(r => matches(r, where));
        for (const row of found) for (const [k, v] of Object.entries(data) as any) row[k] = v?.increment ? row[k] + v.increment : v;
        return { count: found.length };
      }),
      deleteMany: jest.fn(async ({ where }: any) => {
        const found = records.filter(r => matches(r, where));
        for (const row of found) records.splice(records.indexOf(row), 1);
        return { count: found.length };
      }),
    };
  }
  return { rows, prisma, service: new TallerService(prisma) };
}

function noWrites(prisma: any) {
  for (const delegate of Object.values(prisma) as any[]) for (const method of writes) expect(delegate[method]).not.toHaveBeenCalled();
}

describe('Taller: institution isolation', () => {
  const foreignActions = [
    ['resolve', (s: TallerService, ctx: typeof A, x: string) => s.resolveInstrument(ctx, { teamId: `team-${x}`, motor: 'BOARD' }), 'abpTeam'],
    ['read', (s: TallerService, ctx: typeof A, x: string) => s.getInstrumentState(ctx, `inst-${x}`), 'tallerInstrument'],
    ['create', (s: TallerService, ctx: typeof A, x: string) => s.createObject(ctx, `inst-${x}`, { text: 'Synthetic' }), 'tallerInstrument'],
    ['update', (s: TallerService, ctx: typeof A, x: string) => s.updateObject(ctx, `obj-${x}-1`, { text: 'Synthetic' }), 'tallerObject'],
    ['delete', (s: TallerService, ctx: typeof A, x: string) => s.deleteObject(ctx, `obj-${x}-1`), 'tallerObject'],
    ['vote', (s: TallerService, ctx: typeof A, x: string) => s.toggleVote(ctx, `obj-${x}-1`), 'tallerObject'],
    ['comment', (s: TallerService, ctx: typeof A, x: string) => s.addComment(ctx, `obj-${x}-1`, 'Synthetic'), 'tallerObject'],
    ['connect', (s: TallerService, ctx: typeof A, x: string) => s.connectObjects(ctx, { fromId: `obj-${x}-1`, toId: `obj-${x}-2` }), 'tallerObject'],
    ['disconnect', (s: TallerService, ctx: typeof A, x: string) => s.disconnectObjects(ctx, `rel-${x}`), 'tallerRelation'],
    ['timeline', (s: TallerService, ctx: typeof A, x: string) => s.teamTimeline(ctx, `team-${x}`), 'abpTeam'],
  ] as const;

  describe.each([[A, 'B'], [B, 'A']] as const)('actor %j rejects school %s', (ctx, foreign) => {
    it.each(foreignActions)('%s rejects before subsequent reads or any write', async (_name, action, guardModel) => {
      const { service, prisma } = harness();
      await expect(action(service, ctx, foreign)).rejects.toBeInstanceOf(NotFoundException);
      noWrites(prisma);
      for (const [model, delegate] of Object.entries(prisma) as any) {
        expect(delegate.findMany).not.toHaveBeenCalled();
        expect(delegate.findFirst).toHaveBeenCalledTimes(model === guardModel ? 1 : 0);
      }
    });
  });

  it('foreign and nonexistent objects have the same response and no side effects', async () => {
    for (const id of ['obj-B-1', 'missing']) {
      const { service, prisma } = harness();
      await expect(service.deleteObject(A, id)).rejects.toThrow(new NotFoundException('Objeto no encontrado'));
      noWrites(prisma);
      expect(prisma.abpTeam.findFirst).not.toHaveBeenCalled();
    }
  });

  it('a foreign parent cannot create an object or event in an owned instrument', async () => {
    const { service, prisma } = harness();
    await expect(service.createObject(A, 'inst-A', { text: 'Synthetic', parentId: 'obj-B-1' })).rejects.toBeInstanceOf(NotFoundException);
    noWrites(prisma);
  });

  it('a foreign second endpoint cannot create or update a relation', async () => {
    const { service, prisma } = harness();
    await expect(service.connectObjects(A, { fromId: 'obj-A-1', toId: 'obj-B-2' })).rejects.toBeInstanceOf(NotFoundException);
    noWrites(prisma);
    expect(prisma.abpTeam.findFirst).not.toHaveBeenCalled();
  });

  it('child reads filter institution even when a foreign row names the owned instrument', async () => {
    const { service, rows } = harness();
    rows.tallerObject[2].instrumentId = 'inst-A';
    const state = await service.getInstrumentState(A, 'inst-A');
    expect(state.objects.map(o => o.id)).toEqual(['obj-A-1', 'obj-A-2']);
  });

  it('every query and mutation remains scoped after the guard, including vote removal', async () => {
    const { service, prisma, rows } = harness();
    const foreignBefore = JSON.stringify(Object.values(rows).flat().filter(r => r.institutionId === B.institutionId));
    rows.tallerInstrument[0].motor = 'POLL';
    await service.getInstrumentState(A, 'inst-A');
    await service.resolveInstrument(A, { teamId: 'team-A', motor: 'CARDS' });
    await service.createObject(A, 'inst-A', { text: 'Synthetic', parentId: 'obj-A-1' });
    await service.updateObject(A, 'obj-A-1', { text: 'Changed', version: 1 });
    await service.updateObject(A, 'obj-A-1', { x: 2 });
    await service.connectObjects(A, { fromId: 'obj-A-1', toId: 'obj-A-2', label: 'Synthetic' });
    await service.toggleVote(A, 'obj-A-1');
    await service.toggleVote(A, 'obj-A-1');
    await service.addComment(A, 'obj-A-1', 'Synthetic');
    await service.disconnectObjects(A, 'rel-A');
    await service.deleteObject(A, 'obj-A-2');
    await service.teamTimeline(A, 'team-A');
    for (const delegate of Object.values(prisma) as any[]) {
      for (const method of ['findFirst', 'findMany', 'updateMany', 'deleteMany']) {
        for (const [args] of delegate[method].mock.calls) expect(args.where.institutionId).toBe(A.institutionId);
      }
      for (const [args] of delegate.create.mock.calls) expect(args.data.institutionId).toBe(A.institutionId);
      for (const [args] of delegate.createMany.mock.calls) expect(args.data.every((row: any) => row.institutionId === A.institutionId)).toBe(true);
    }
    expect(JSON.stringify(Object.values(rows).flat().filter(r => r.institutionId === B.institutionId))).toBe(foreignBefore);
  });

  it('the controller ignores a forged institution in the body', async () => {
    const { service, prisma } = harness();
    const controller = new TallerController(service, prisma);
    const body = { teamId: 'team-B', motor: 'BOARD', institutionId: B.institutionId };
    await expect(controller.resolve({ user: { id: A.userId, institutionId: A.institutionId } }, body)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.abpTeam.findFirst.mock.calls[0][0].where.institutionId).toBe(A.institutionId);
    noWrites(prisma);
  });

  it.each(foreignActions)('%s refuses a missing context before accessing Prisma', async (_name, action) => {
    const { service, prisma } = harness();
    await expect(action(service, {} as any, 'A')).rejects.toBeInstanceOf(NotFoundException);
    for (const delegate of Object.values(prisma) as any[]) for (const method of Object.values(delegate) as jest.Mock[]) expect(method).not.toHaveBeenCalled();
  });

  it.each(['update', 'delete', 'disconnect'])('%s returns 404 and emits no event if the scoped write loses its target', async action => {
    const { service, prisma, rows } = harness();
    if (action === 'disconnect') {
      prisma.tallerRelation.deleteMany.mockResolvedValueOnce({ count: 0 });
      await expect(service.disconnectObjects(A, 'rel-A')).rejects.toBeInstanceOf(NotFoundException);
    } else {
      prisma.tallerObject.updateMany.mockImplementationOnce(async () => {
        rows.tallerObject[0].institutionId = B.institutionId;
        return { count: 0 };
      });
      await expect(action === 'update'
        ? service.updateObject(A, 'obj-A-1', { text: 'Synthetic' })
        : service.deleteObject(A, 'obj-A-1')).rejects.toBeInstanceOf(NotFoundException);
    }
    expect(prisma.tallerEvent.create).not.toHaveBeenCalled();
  });

  it('duplicate instrument cleanup deletes only the created row inside the actor institution', async () => {
    const { service, prisma, rows } = harness();
    let calls = 0;
    prisma.tallerInstrument.findFirst.mockImplementation(async ({ where }: any) => {
      calls++;
      // Simulate a concurrent canonical instrument becoming visible after creation.
      if (calls === 1) return null;
      return rows.tallerInstrument.find(r => matches(r, where)) ?? null;
    });
    const inst = await service.resolveInstrument(A, { teamId: 'team-A', motor: 'BOARD' });
    expect(inst.id).toBe('inst-A');
    expect(prisma.tallerInstrument.deleteMany).toHaveBeenCalledWith({ where: { id: expect.stringMatching(/^new-/), institutionId: A.institutionId } });
    expect(rows.tallerInstrument.some(r => r.id === 'inst-B')).toBe(true);
  });
});
