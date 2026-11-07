import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { QualitativePromotionDecisionController } from '../src/modules/academic/qualitative-promotion-decision.controller';
import { QualitativePromotionPolicyController } from '../src/modules/academic/qualitative-promotion-policy.controller';
import { QualitativeYearAssessmentService } from '../src/modules/academic/qualitative-year-assessment.service';
import { QualitativePromotionPolicyService } from '../src/modules/academic/qualitative-promotion-policy.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';

// Real HTTP routing, role guard and institution resolver. Authentication is replaced
// with explicit fixture claims; database invariants are covered separately.
describe('qualitative promotion HTTP boundaries', () => {
  let app: INestApplication;
  const assessment = { assess: jest.fn(), confirm: jest.fn() };
  const policies = { history: jest.fn(), revise: jest.fn() };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [QualitativePromotionDecisionController, QualitativePromotionPolicyController],
      providers: [
        { provide: QualitativeYearAssessmentService, useValue: assessment },
        { provide: QualitativePromotionPolicyService, useValue: policies },
        { provide: PrismaService, useValue: {} },
      ],
    }).overrideGuard(JwtAuthGuard).useValue({ canActivate: (context: any) => {
      const req = context.switchToHttp().getRequest();
      req.user = { id: 'actor-from-session', institutionId: 'tenant-a', roles: [req.headers['x-test-role'] || 'RECTOR'] };
      return true;
    } }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => { await app.close(); });
  beforeEach(() => {
    jest.clearAllMocks();
    assessment.assess.mockResolvedValue({ status: 'REVIEW_PENDING' });
    assessment.confirm.mockResolvedValue({ outcome: 'CONTINUE' });
    policies.history.mockResolvedValue([]);
    policies.revise.mockResolvedValue({ revision: 1 });
  });
  it('ignores a foreign institution query for an institutional rector', async () => {
    await request(app.getHttpServer()).get('/qualitative-promotion/e?institutionId=tenant-b').expect(200);
    expect(assessment.assess).toHaveBeenCalledWith('e', 'tenant-a');
  });
  it('takes the confirming actor only from the session', async () => {
    const body = { reportText: 'QA', reason: 'QA', expectedFingerprint: 'f', approvedById: 'forged' };
    await request(app.getHttpServer()).post('/qualitative-promotion/e/confirm').send(body).expect(201);
    expect(assessment.confirm).toHaveBeenCalledWith('e', 'tenant-a', 'actor-from-session', body);
  });
  it('allows coordinator review but does not silently delegate administrative confirmation', async () => {
    await request(app.getHttpServer()).get('/qualitative-promotion/e').set('x-test-role', 'COORDINADOR').expect(200);
    await request(app.getHttpServer()).post('/qualitative-promotion/e/confirm').set('x-test-role', 'COORDINADOR').send({}).expect(403);
    expect(assessment.confirm).not.toHaveBeenCalled();
  });
  it('does not expose the administrative report to a teacher', async () => {
    await request(app.getHttpServer()).get('/qualitative-promotion/e').set('x-test-role', 'DOCENTE').expect(403);
    expect(assessment.assess).not.toHaveBeenCalled();
  });
  it('scopes policy writing to the session institution and actor', async () => {
    const body = { reason: 'QA', expectedRevision: 0 };
    await request(app.getHttpServer()).post('/academic-years/y/qualitative-promotion-policies/g?institutionId=tenant-b').send(body).expect(201);
    expect(policies.revise).toHaveBeenCalledWith('tenant-a', 'y', 'g', 'actor-from-session', body);
  });
  it('rejects a teacher policy write', async () => {
    await request(app.getHttpServer()).post('/academic-years/y/qualitative-promotion-policies/g').set('x-test-role', 'DOCENTE').send({}).expect(403);
    expect(policies.revise).not.toHaveBeenCalled();
  });
});
