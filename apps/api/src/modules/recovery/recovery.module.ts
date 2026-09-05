import { Module } from '@nestjs/common';
import { RecoveryConfigService } from './recovery-config.service';
import { RecoveryConfigController } from './recovery-config.controller';
import { PeriodRecoveryService } from './period-recovery.service';
// Las recuperaciones alteran la nota final: deben hacerlo por la puerta unica.
import { EvaluationModule } from '../evaluation/evaluation.module';
import { PeriodRecoveryController } from './period-recovery.controller';
import { FinalRecoveryService } from './final-recovery.service';
import { FinalRecoveryController } from './final-recovery.controller';
import { AcademicActsService } from './academic-acts.service';
import { AcademicActsController } from './academic-acts.controller';
import { RecoveryEngineService } from './recovery-engine.service';
import { RecoverySnapshotService } from './recovery-snapshot.service';
import { ReportsModule } from '../reports/reports.module';

@Module({
  imports: [ReportsModule, EvaluationModule],
  controllers: [
    RecoveryConfigController,
    PeriodRecoveryController,
    FinalRecoveryController,
    AcademicActsController,
  ],
  providers: [
    RecoveryConfigService,
    RecoveryEngineService,
    RecoverySnapshotService,
    PeriodRecoveryService,
    FinalRecoveryService,
    AcademicActsService,
  ],
  exports: [
    RecoveryConfigService,
    RecoveryEngineService,
    RecoverySnapshotService,
    PeriodRecoveryService,
    FinalRecoveryService,
    AcademicActsService,
  ],
})
export class RecoveryModule {}
