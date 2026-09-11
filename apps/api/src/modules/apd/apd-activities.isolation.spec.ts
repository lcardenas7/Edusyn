import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { apdActivitiesFixture } from '../../../test/fixtures/apd-activities.fixture';

describe('APD activities, progress and audit isolation', () => {
  let f: ReturnType<typeof apdActivitiesFixture>;
  beforeEach(() => { f = apdActivitiesFixture(); });
  function run(operation: string, target = 'A', actor: string | undefined = 'school-A') {
    if (operation === 'create') return f.service.createActivity({ supportPlanId: 'plan-' + target, topic: 'Synthetic' }, actor!, 'actor');
    if (operation === 'update') return f.service.updateActivity('activity-' + target, actor!, { completionStatus: 'COMPLETED' }, 'actor');
    if (operation === 'log') return f.service.createProgressLog({ supportPlanId: 'plan-' + target, progressIndicator: 4 }, actor!, 'actor');
    return f.progress.recalculate('plan-' + target, actor!);
  }
  describe.each([['A', 'B'], ['B', 'A']])('actor %s, resource %s', (actor, target) => {
    it.each(['create', 'update', 'log', 'recalculate'])('%s rejects before collections, writes or transactions', async operation => {
      await expect(run(operation, target, 'school-' + actor)).rejects.toBeInstanceOf(NotFoundException);
      expect(f.writes()).toEqual([]);
      expect(f.calls.filter(c => c.method === 'findMany')).toEqual([]);
      expect(f.prisma.$transaction).not.toHaveBeenCalled();
    });
  });
  it.each(['create', 'update', 'log', 'recalculate'])('%s rejects absent institution before any storage call', async operation => {
    await expect(run(operation, 'A', '')).rejects.toBeInstanceOf(NotFoundException);
    expect(f.calls).toEqual([]);
  });
  it.each(['create', 'update', 'log'])('%s rechecks scope inside the transaction', async operation => {
    f.beforeTransaction(() => { f.rows.pedagogicalSupportPlan[0].institutionId = 'school-B'; });
    await expect(run(operation)).rejects.toBeInstanceOf(NotFoundException);
    expect(f.writes()).toEqual([]);
  });
  it.each(['create', 'update', 'log'])('%s writes and recalculates only inside the same serializable transaction', async operation => {
    await run(operation);
    expect(f.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(f.prisma.$transaction.mock.calls[0][1]).toEqual({ isolationLevel: 'Serializable', timeout: 30000 });
    expect(f.writes().length).toBeGreaterThan(1);
    expect(f.writes().every(c => c.inTransaction)).toBe(true);
    expect(f.rows.pedagogicalSupportPlan[1].progressPercentage).toBe(0);
    expect(f.rows.apdAuditLog.every(r => r.institutionId === 'school-A')).toBe(true);
    for (const call of f.calls.filter(c => c.method === 'findMany')) {
      expect(call.query.where).toEqual({ supportPlanId: 'plan-A', supportPlan: { institutionId: 'school-A' } });
    }
    for (const call of f.writes().filter(c => c.model === 'pedagogicalSupportPlan')) expect(call.query.where).toEqual({ id: 'plan-A', institutionId: 'school-A' });
    if (operation === 'update') expect(f.tx.supportActivity.update.mock.calls[0][0].where).toEqual({ id: 'activity-A', supportPlan: { institutionId: 'school-A' } });
  });
  describe.each(['create', 'update', 'log'])('%s rollback', operation => {
    it.each(['apdAuditLog.create', 'supportProgressLog.findMany', 'pedagogicalSupportPlan.update'])('rolls back records and audit when %s fails', async failure => {
      const original = JSON.stringify(f.rows);
      f.fail(failure);
      await expect(run(operation)).rejects.toThrow('Synthetic failure');
      expect(JSON.stringify(f.rows)).toBe(original);
    });
  });
  it('returns a retryable conflict for a Prisma serialization failure', async () => {
    f.prisma.$transaction.mockRejectedValueOnce({ code: 'P2034' });
    await expect(run('log')).rejects.toBeInstanceOf(ConflictException);
    expect(f.writes()).toEqual([]);
  });
  it('rolls back even when the last audit fails after the percentage was updated', async () => {
    const original = JSON.stringify(f.rows);
    f.fail('apdAuditLog.create', 2);
    await expect(run('log')).rejects.toThrow('Synthetic failure');
    expect(f.writes().some(c => c.model === 'pedagogicalSupportPlan')).toBe(true);
    expect(JSON.stringify(f.rows)).toBe(original);
  });
  it.each([undefined, null, NaN, Infinity, 0, 6, 1.5, '4'])('rejects invalid progress indicator %p before writing', async indicator => {
    await expect(f.service.createProgressLog({ supportPlanId: 'plan-A', progressIndicator: indicator as any }, 'school-A', 'actor')).rejects.toBeInstanceOf(BadRequestException);
    expect(f.writes()).toEqual([]);
    expect(f.prisma.$transaction).not.toHaveBeenCalled();
  });
  it.each([null, NaN, Infinity, -1, 101, 50.5, '80'])('rejects invalid score %p before writing', async score => {
    await expect(f.service.updateActivity('activity-A', 'school-A', { studentPerformanceScore: score as any }, 'actor')).rejects.toBeInstanceOf(BadRequestException);
    expect(f.writes()).toEqual([]);
  });
  it.each([0, 100])('accepts integer score %s', async score => {
    await f.service.updateActivity('activity-A', 'school-A', { studentPerformanceScore: score }, 'actor');
    expect(f.rows.supportActivity[0].studentPerformanceScore).toBe(score);
  });
  it.each([
    [[], [], 0], [['COMPLETED', 'PENDING'], [], 50], [[], [3, 5], 80], [['COMPLETED', 'PENDING'], [4], 59],
  ])('preserves the formula for activities %j and logs %j', async (activities, logs, expected) => {
    f.rows.supportActivity = (activities as string[]).map((completionStatus, i) => ({ id: 'activity-' + i, supportPlanId: 'plan-A', completionStatus }));
    f.rows.supportProgressLog = (logs as number[]).map((progressIndicator, i) => ({ id: 'log-' + i, supportPlanId: 'plan-A', progressIndicator }));
    expect(await f.progress.recalculate('plan-A', 'school-A')).toBe(expected);
    expect(Number(f.rows.pedagogicalSupportPlan[0].progressPercentage)).toBe(expected);
  });
  it('audit reads cannot return the other institution even with the same entity ID', async () => {
    f.rows.apdAuditLog = ['A', 'B'].map(x => ({ id: x, institutionId: 'school-' + x, entityType: 'Plan', entityId: 'shared-id' }));
    expect((await f.audit.getByEntity('Plan', 'shared-id', 'school-A')).map(r => r.id)).toEqual(['A']);
    expect((await f.audit.getByInstitution('school-B')).map(r => r.id)).toEqual(['B']);
  });
  it.each(['entity', 'institution', 'log'])('audit %s rejects absent institution', async operation => {
    const call = operation === 'entity' ? f.audit.getByEntity('Plan', 'id', '') : operation === 'institution' ? f.audit.getByInstitution('') : f.audit.log({ institutionId: '', userId: 'actor', action: 'PLAN_UPDATED', entityType: 'Plan', entityId: 'id' });
    await expect(call).rejects.toBeInstanceOf(NotFoundException);
    expect(f.calls).toEqual([]);
  });
});
