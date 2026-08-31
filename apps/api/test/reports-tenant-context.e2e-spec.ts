import { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { ReportsController } from '../src/modules/reports/reports.controller';
import { ReportsService } from '../src/modules/reports/reports.service';
import { ReportsExportService } from '../src/modules/reports/reports-export.service';
import { AcademicPdfService } from '../src/modules/reports/academic-pdf.service';
import { CapabilitiesService } from '../src/modules/capabilities/capabilities.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/modules/auth/guards/roles.guard';
import { TenantContextInterceptor } from '../src/common/interceptors/tenant-context.interceptor';
import { ValidateReportTenantGuard } from '../src/modules/reports/guards/validate-report-tenant.guard';

describe('Reports tenant context (HTTP local, isolated)', () => {
  let app: INestApplication;
  const transaction = { $queryRawUnsafe: jest.fn().mockResolvedValue(undefined) };
  const raw = {
    $transaction: jest.fn(async (callback: (tx: typeof transaction) => Promise<void>) => callback(transaction)),
  };
  const institution = { findUnique: jest.fn() };
  const reportsService = {
    getSubjectAverages: jest.fn(async (institutionId: string) => ({ institutionId })),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    institution.findUnique.mockImplementation(async ({ where }: any) => (
      where.id === 'tenant-b' ? { id: 'tenant-b' } : null
    ));
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        Reflector,
        TenantContextInterceptor,
        ValidateReportTenantGuard,
        { provide: PrismaService, useValue: { $raw: raw, institution } },
        { provide: ReportsService, useValue: reportsService },
        { provide: ReportsExportService, useValue: {} },
        { provide: AcademicPdfService, useValue: {} },
        { provide: CapabilitiesService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: any) => {
          const request = context.switchToHttp().getRequest();
          request.user = request.headers['x-test-user'] === 'superadmin'
            ? { isSuperAdmin: true }
            : { isSuperAdmin: false, institutionId: 'tenant-a', roles: ['DOCENTE'] };
          return true;
        },
      })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalInterceptors(moduleFixture.get(TenantContextInterceptor));
    await app.init();
  });

  afterEach(async () => app.close());

  it('returns 403 before a query when SuperAdmin omits institutionId', async () => {
    await request(app.getHttpServer())
      .get('/reports/academic/subject-averages?academicYearId=year-1')
      .set('x-test-user', 'superadmin')
      .expect(403);

    expect(raw.$transaction).not.toHaveBeenCalled();
    expect(reportsService.getSubjectAverages).not.toHaveBeenCalled();
  });

  it('uses the explicit SuperAdmin tenant throughout the real HTTP route', async () => {
    await request(app.getHttpServer())
      .get('/reports/academic/subject-averages?academicYearId=year-1&institutionId=tenant-b')
      .set('x-test-user', 'superadmin')
      .expect(200)
      .expect({ institutionId: 'tenant-b' });

    expect(transaction.$queryRawUnsafe).toHaveBeenCalledWith(
      "SELECT set_config('app.current_institution', $1, true)",
      'tenant-b',
    );
    expect(reportsService.getSubjectAverages).toHaveBeenCalledWith(
      'tenant-b', 'year-1', undefined, undefined, undefined, undefined,
    );
  });

  it('returns 404 before a transaction when the SuperAdmin destination does not exist', async () => {
    await request(app.getHttpServer())
      .get('/reports/academic/subject-averages?academicYearId=year-1&institutionId=unknown')
      .set('x-test-user', 'superadmin')
      .expect(404);

    expect(raw.$transaction).not.toHaveBeenCalled();
    expect(reportsService.getSubjectAverages).not.toHaveBeenCalled();
  });

  it('ignores a normal user query tenant throughout the real HTTP route', async () => {
    await request(app.getHttpServer())
      .get('/reports/academic/subject-averages?academicYearId=year-1&institutionId=tenant-b')
      .set('x-test-user', 'institutional')
      .expect(200)
      .expect({ institutionId: 'tenant-a' });

    expect(reportsService.getSubjectAverages).toHaveBeenCalledWith(
      'tenant-a', 'year-1', undefined, undefined, undefined, undefined,
    );
  });
});

/**
 * R-1-S2-L — cross-tenant rejection through the wired HTTP pipeline.
 *
 * Unlike the block above, this one injects the REAL ReportsService so that the
 * ownership assertions added in `3932ced` run for real: guard → interceptor →
 * controller → assertion. Prisma is a faithful in-memory double, so this is an
 * INTEGRATION test of the application wiring, NOT an end-to-end test: it proves
 * that the application rejects a cross-tenant resource, and proves nothing
 * about database-level isolation (RLS policies), which needs a separate A/B run
 * against staging.
 */
describe('Reports cross-tenant resource rejection (HTTP local, real assertions)', () => {
  let app: INestApplication;
  let service: ReportsService;

  // Two institutions, each with its own year, term and enrollment.
  const enrollments = [
    { id: 'enrollment-a', institutionId: 'tenant-a', academicYearId: 'year-a' },
    { id: 'enrollment-b', institutionId: 'tenant-b', academicYearId: 'year-b' },
  ];
  const terms = [
    { id: 'term-a', institutionId: 'tenant-a', academicYearId: 'year-a' },
    { id: 'term-b', institutionId: 'tenant-b', academicYearId: 'year-b' },
  ];
  const years = [
    { id: 'year-a', institutionId: 'tenant-a' },
    { id: 'year-b', institutionId: 'tenant-b' },
  ];

  const transaction = { $queryRawUnsafe: jest.fn().mockResolvedValue(undefined) };
  const raw = {
    $transaction: jest.fn(async (callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction)),
  };

  // Honours the real `where` clauses so a rejection cannot pass vacuously.
  const prisma = {
    $raw: raw,
    institution: {
      findUnique: jest.fn(async ({ where }: any) => (
        ['tenant-a', 'tenant-b'].includes(where.id) ? { id: where.id } : null
      )),
    },
    studentEnrollment: {
      findFirst: jest.fn(async ({ where }: any) => {
        const found = enrollments.find(
          (e) => e.id === where.id && e.institutionId === where.institutionId,
        );
        return found ? { id: found.id, academicYearId: found.academicYearId } : null;
      }),
    },
    academicTerm: {
      findFirst: jest.fn(async ({ where }: any) => {
        const found = terms.find((t) => (
          t.id === where.id
          && t.institutionId === where.academicYear?.institutionId
          && (where.academicYearId === undefined || t.academicYearId === where.academicYearId)
        ));
        return found ? { id: found.id, academicYearId: found.academicYearId } : null;
      }),
      findUnique: jest.fn(async () => ({ bulletinsReleasedForTeachers: true })),
    },
    academicYear: {
      findFirst: jest.fn(async ({ where }: any) => {
        const found = years.find(
          (y) => y.id === where.id && y.institutionId === where.institutionId,
        );
        return found ? { id: found.id } : null;
      }),
    },
  };

  const capabilities = {
    getUserCapabilities: jest.fn(async () => ({ effectiveRoles: ['COORDINADOR'] })),
  };

  /** Downstream readers and lifecycle actions that must never run on rejection. */
  const downstream = [
    'getReportCardData',
    'getReportCardYear',
    'getCompletenessStatus',
    'validateTermGrades',
    'closeTerm',
    'finalizeTerm',
    'reopenFinalizedTerm',
    'reSnapshotTerm',
  ] as const;

  const expectNoDownstreamCall = () => {
    for (const method of downstream) {
      expect(service[method]).not.toHaveBeenCalled();
    }
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        Reflector,
        TenantContextInterceptor,
        ValidateReportTenantGuard,
        { provide: PrismaService, useValue: prisma },
        {
          // Real service: only `prisma` is used by the three assertions, so the
          // remaining collaborators stay inert on the paths under test.
          provide: ReportsService,
          useFactory: () => new ReportsService(
            prisma as any, {} as any, {} as any, {} as any,
            {} as any, {} as any, {} as any, {} as any,
          ),
        },
        { provide: ReportsExportService, useValue: {} },
        { provide: AcademicPdfService, useValue: {} },
        { provide: CapabilitiesService, useValue: capabilities },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: any) => {
          const request = context.switchToHttp().getRequest();
          request.user = request.headers['x-test-user'] === 'superadmin'
            ? { isSuperAdmin: true, id: 'superadmin-user' }
            : { isSuperAdmin: false, institutionId: 'tenant-a', id: 'user-a', roles: ['COORDINADOR'] };
          return true;
        },
      })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    service = moduleFixture.get(ReportsService);
    for (const method of downstream) {
      jest.spyOn(service, method).mockResolvedValue({ ok: true } as never);
    }

    app = moduleFixture.createNestApplication();
    app.useGlobalInterceptors(moduleFixture.get(TenantContextInterceptor));
    await app.init();
  });

  afterEach(async () => app.close());

  describe('report card — enrollment and term must belong to the effective tenant', () => {
    it('rejects an enrollment of B for an institutional user of A', async () => {
      await request(app.getHttpServer())
        .get('/reports/report-card/enrollment-b?academicTermId=term-b')
        .set('x-test-user', 'institutional')
        .expect(404);

      // Stops at the very first assertion: the term is never even inspected.
      expect(prisma.studentEnrollment.findFirst).toHaveBeenCalledWith({
        where: { id: 'enrollment-b', institutionId: 'tenant-a' },
        select: { id: true, academicYearId: true },
      });
      expect(prisma.academicTerm.findFirst).not.toHaveBeenCalled();
      expect(capabilities.getUserCapabilities).not.toHaveBeenCalled();
      expectNoDownstreamCall();
    });

    it('rejects an enrollment of B for a SuperAdmin whose validated destination is A', async () => {
      await request(app.getHttpServer())
        .get('/reports/report-card/enrollment-b?academicTermId=term-b&institutionId=tenant-a')
        .set('x-test-user', 'superadmin')
        .expect(404);

      // The rejection happens INSIDE a legitimately opened tenant context for A,
      // not because the request failed to reach the handler.
      expect(transaction.$queryRawUnsafe).toHaveBeenCalledWith(
        "SELECT set_config('app.current_institution', $1, true)",
        'tenant-a',
      );
      expect(prisma.studentEnrollment.findFirst).toHaveBeenCalledWith({
        where: { id: 'enrollment-b', institutionId: 'tenant-a' },
        select: { id: true, academicYearId: true },
      });
      expectNoDownstreamCall();
    });

    it('rejects a term of B combined with an in-scope enrollment of A', async () => {
      await request(app.getHttpServer())
        .get('/reports/report-card/enrollment-a?academicTermId=term-b')
        .set('x-test-user', 'institutional')
        .expect(404);

      expect(prisma.academicTerm.findFirst).toHaveBeenCalledWith({
        where: { id: 'term-b', academicYear: { institutionId: 'tenant-a' } },
        select: { id: true, academicYearId: true },
      });
      expectNoDownstreamCall();
    });

    it('applies the same rejection to the yearly report card', async () => {
      await request(app.getHttpServer())
        .get('/reports/report-card-year/enrollment-b?academicTermId=term-b')
        .set('x-test-user', 'institutional')
        .expect(404);

      expectNoDownstreamCall();
    });

    it('serves an in-scope report card for an institutional user of A', async () => {
      await request(app.getHttpServer())
        .get('/reports/report-card/enrollment-a?academicTermId=term-a')
        .set('x-test-user', 'institutional')
        .expect(200);

      expect(service.getReportCardData).toHaveBeenCalledWith('enrollment-a', 'term-a');
    });

    it('serves an in-scope report card for a SuperAdmin with destination A', async () => {
      await request(app.getHttpServer())
        .get('/reports/report-card/enrollment-a?academicTermId=term-a&institutionId=tenant-a')
        .set('x-test-user', 'superadmin')
        .expect(200);

      expect(service.getReportCardData).toHaveBeenCalledWith('enrollment-a', 'term-a');
    });
  });

  describe('term lifecycle — a cross-tenant term is rejected before any action', () => {
    const lifecycle: Array<[string, 'get' | 'post', string, Record<string, unknown>]> = [
      ['validate-grades', 'get', '/reports/terms/term-b/validate-grades', {}],
      ['close', 'post', '/reports/terms/term-b/close', {}],
      ['finalize', 'post', '/reports/terms/term-b/finalize', {}],
      ['reopen', 'post', '/reports/terms/term-b/reopen', { reason: 'test' }],
      ['re-snapshot', 'post', '/reports/terms/term-b/re-snapshot', {}],
    ];

    it.each(lifecycle)('rejects %s for an institutional user of A', async (_name, method, url, body) => {
      const call = method === 'get'
        ? request(app.getHttpServer()).get(url)
        : request(app.getHttpServer()).post(url).send(body);

      await call.set('x-test-user', 'institutional').expect(404);

      expect(prisma.academicTerm.findFirst).toHaveBeenCalledWith({
        where: { id: 'term-b', academicYear: { institutionId: 'tenant-a' } },
        select: { id: true },
      });
      // No lifecycle mutation is reached: nothing is closed, finalized,
      // reopened or re-snapshotted.
      expectNoDownstreamCall();
    });

    it.each(lifecycle)('rejects %s for a SuperAdmin whose destination is A', async (_name, method, url, body) => {
      const target = `${url}${url.includes('?') ? '&' : '?'}institutionId=tenant-a`;
      const call = method === 'get'
        ? request(app.getHttpServer()).get(target)
        : request(app.getHttpServer()).post(target).send(body);

      await call.set('x-test-user', 'superadmin').expect(404);

      expectNoDownstreamCall();
    });
  });

  describe('completeness — year and optional term must share the effective tenant', () => {
    it('rejects year A combined with term B', async () => {
      await request(app.getHttpServer())
        .get('/reports/academic/completeness-status?academicYearId=year-a&termId=term-b')
        .set('x-test-user', 'institutional')
        .expect(404);

      expect(prisma.academicTerm.findFirst).toHaveBeenCalledWith({
        where: { id: 'term-b', academicYearId: 'year-a', academicYear: { institutionId: 'tenant-a' } },
        select: { id: true },
      });
      expectNoDownstreamCall();
    });

    it('rejects a year of B before inspecting any term', async () => {
      await request(app.getHttpServer())
        .get('/reports/academic/completeness-status?academicYearId=year-b&termId=term-b')
        .set('x-test-user', 'institutional')
        .expect(404);

      expect(prisma.academicTerm.findFirst).not.toHaveBeenCalled();
      expectNoDownstreamCall();
    });

    it('rejects year A + term B for a SuperAdmin whose destination is A', async () => {
      await request(app.getHttpServer())
        .get('/reports/academic/completeness-status?academicYearId=year-a&termId=term-b&institutionId=tenant-a')
        .set('x-test-user', 'superadmin')
        .expect(404);

      expectNoDownstreamCall();
    });

    it('serves completeness for an in-scope year and term', async () => {
      await request(app.getHttpServer())
        .get('/reports/academic/completeness-status?academicYearId=year-a&termId=term-a')
        .set('x-test-user', 'institutional')
        .expect(200);

      expect(service.getCompletenessStatus).toHaveBeenCalledWith('tenant-a', 'year-a', 'term-a');
    });
  });
});
