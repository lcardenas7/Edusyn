import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
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
import { ElectionsModule } from './modules/elections/elections.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { StorageModule } from './modules/storage/storage.module';
import { AchievementsModule } from './modules/achievements/achievements.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { ManagementTasksModule } from './modules/management-tasks/management-tasks.module';
import { FinanceModule } from './modules/finance/finance.module';
import { TimetablingModule } from './modules/timetabling/timetabling.module';
import { TeacherScheduleModule } from './modules/teacher-schedule/teacher-schedule.module';
import { CapabilitiesModule } from './modules/capabilities/capabilities.module';
import { InstitutionContextModule } from './modules/institution-context/institution-context.module';
import { PedagogicalSupportModule } from './modules/pedagogical-support/pedagogical-support.module';
import { ApdModule } from './modules/apd/apd.module';
import { TeacherWorkspaceModule } from './modules/teacher-workspace/teacher-workspace.module';
import { PedagogicalDesignModule } from './modules/pedagogical-design/pedagogical-design.module';
import { ClassroomModule } from './modules/classroom/classroom.module';
import { GamificationModule } from './modules/gamification/gamification.module';
import { LearningRouteModule } from './modules/learning-route/learning-route.module';
import { AbpModule } from './modules/abp/abp.module';
import { TallerModule } from './modules/taller/taller.module';
import { LiveSessionModule } from './modules/live-session/live-session.module';
import { StaffLeaveModule } from './modules/staff-leave/staff-leave.module';
import { EdusynPlayModule } from './modules/edusyn-play/edusyn-play.module';
import { TenantContextInterceptor } from './common/interceptors/tenant-context.interceptor';
import { TenantGuard } from './modules/auth/guards/tenant.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
    ScheduleModule.forRoot(),
    PrismaModule,
    InstitutionContextModule,
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
    ElectionsModule,
    PaymentsModule,
    StorageModule,
    AchievementsModule,
    DocumentsModule,
    ManagementTasksModule,
    FinanceModule,
    TimetablingModule,
    TeacherScheduleModule,
    CapabilitiesModule,
    PedagogicalSupportModule,
    ApdModule,
    TeacherWorkspaceModule,
    PedagogicalDesignModule,
    ClassroomModule,
    GamificationModule,
    LearningRouteModule,
    AbpModule,
    TallerModule,
    LiveSessionModule,
    StaffLeaveModule,
    EdusynPlayModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: TenantGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantContextInterceptor,
    },
  ],
})
export class AppModule {}
