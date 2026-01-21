import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { IamModule } from './modules/iam/iam.module';
import { AcademicModule } from './modules/academic/academic.module';
import { EvaluationModule } from './modules/evaluation/evaluation.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { ObserverModule } from './modules/observer/observer.module';
import { ReportsModule } from './modules/reports/reports.module';
import { CommunicationsModule } from './modules/communications/communications.module';
import { MenReportsModule } from './modules/men-reports/men-reports.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { RecoveryModule } from './modules/recovery/recovery.module';
import { PerformanceModule } from './modules/performance/performance.module';
import { SuperadminModule } from './modules/superadmin/superadmin.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { InstitutionConfigModule } from './modules/institution-config/institution-config.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    IamModule,
    AuthModule,
    AcademicModule,
    EvaluationModule,
    AttendanceModule,
    ObserverModule,
    ReportsModule,
    CommunicationsModule,
    MenReportsModule,
    DashboardModule,
    RecoveryModule,
    PerformanceModule,
    SuperadminModule,
    PermissionsModule,
    InstitutionConfigModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
