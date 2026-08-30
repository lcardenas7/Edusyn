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

describe('Reports tenant context (HTTP local, isolated)', () => {
  let app: INestApplication;
  const transaction = { $queryRawUnsafe: jest.fn().mockResolvedValue(undefined) };
  const raw = {
    $transaction: jest.fn(async (callback: (tx: typeof transaction) => Promise<void>) => callback(transaction)),
  };
  const reportsService = {
    getSubjectAverages: jest.fn(async (institutionId: string) => ({ institutionId })),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        Reflector,
        TenantContextInterceptor,
        { provide: PrismaService, useValue: { $raw: raw } },
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
