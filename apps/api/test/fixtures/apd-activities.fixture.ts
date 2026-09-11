import { ApdService } from '../../src/modules/apd/apd.service';
import { ApdProgressService } from '../../src/modules/apd/apd-progress.service';
import { ApdAuditService } from '../../src/modules/apd/apd-audit.service';

// Relation-aware storage double. Transactions restore records on failure; this
// verifies application ordering, not PostgreSQL concurrency or RLS.
export function apdActivitiesFixture() {
  const rows: Record<string, any[]> = {
    institution: [], pedagogicalSupportPlan: [], supportActivity: [], supportProgressLog: [], apdAuditLog: [],
  };
  for (const x of ['A', 'B']) {
    rows.institution.push({ id: 'school-' + x, allowTeacherAccess: true, enableDifferentialSupport: true });
    rows.pedagogicalSupportPlan.push({ id: 'plan-' + x, institutionId: 'school-' + x, status: 'ACTIVE', progressPercentage: 0 });
    rows.supportActivity.push({ id: 'activity-' + x, supportPlanId: 'plan-' + x, topic: 'Synthetic', completionStatus: 'PENDING' });
  }
  let nextId = 0;
  const calls: { model: string; method: string; query: any; inTransaction: boolean }[] = [];
  let failAt: string | undefined;
  let callsUntilFailure = 1;
  let beforeTransaction: (() => void) | undefined;
  const hydrate = (row: any) => ({ ...row, ...(row.supportPlanId && { supportPlan: rows.pedagogicalSupportPlan.find(p => p.id === row.supportPlanId) }) });
  function matches(row: any, where: any = {}): boolean {
    return !!row && Object.entries(where).every(([key, value]) => value === undefined ||
      (value && typeof value === 'object' ? matches(row[key], value) : row[key] === value));
  }
  function client(inTransaction: boolean) {
    const result: any = {};
    for (const model of Object.keys(rows)) {
      result[model] = {};
      for (const method of ['findFirst', 'findUnique', 'findMany', 'create', 'update']) {
        result[model][method] = jest.fn(async (query: any) => {
          calls.push({ model, method, query, inTransaction });
          if (failAt === model + '.' + method && --callsUntilFailure === 0) throw new Error('Synthetic failure: ' + failAt);
          const found = rows[model].filter(r => matches(hydrate(r), query.where));
          if (method === 'findMany') return found.map(hydrate);
          if (method === 'findFirst' || method === 'findUnique') {
            if (!found[0]) return null;
            const row = hydrate(found[0]);
            return query.select ? Object.fromEntries(Object.keys(query.select).map(k => [k, row[k]])) : row;
          }
          const data = { ...query.data };
          if (data.supportPlan) {
            const plan = rows.pedagogicalSupportPlan.find(p => matches(p, data.supportPlan.connect));
            if (!plan) throw new Error('P2025: connected plan not found');
            data.supportPlanId = plan.id; delete data.supportPlan;
          }
          if (data.createdBy) { data.createdById = data.createdBy.connect.id; delete data.createdBy; }
          if (method === 'create') {
            const row = { id: 'new-' + (++nextId), ...(model === 'supportActivity' && { completionStatus: 'PENDING' }), ...data };
            rows[model].push(row); return { ...row };
          }
          if (!found[0]) throw new Error('P2025: update target not found');
          Object.assign(found[0], data); return { ...found[0] };
        });
      }
    }
    return result;
  }
  const prisma = client(false);
  const tx = client(true);
  prisma.$transaction = jest.fn(async (action: (db: any) => any) => {
    beforeTransaction?.();
    const snapshot = Object.fromEntries(Object.entries(rows).map(([model, records]) => [model, records.map(r => ({ ...r }))]));
    try { return await action(tx); }
    catch (error) { Object.assign(rows, snapshot); throw error; }
  });
  const audit = new ApdAuditService(prisma);
  const progress = new ApdProgressService(prisma);
  return {
    rows, prisma, tx, calls, audit, progress,
    service: new ApdService(prisma, audit, progress),
    fail: (point: string, occurrence = 1) => { failAt = point; callsUntilFailure = occurrence; },
    beforeTransaction: (action: () => void) => { beforeTransaction = action; },
    writes: () => calls.filter(c => ['create', 'update'].includes(c.method)),
  };
}
