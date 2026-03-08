import { Module } from '@nestjs/common';
import { RecoveryConfigService } from './recovery-config.service';
import { RecoveryConfigController } from './recovery-config.controller';
import { PeriodRecoveryService } from './period-recovery.service';
import { PeriodRecoveryController } from './period-recovery.controller';
import { FinalRecoveryService } from './final-recovery.service';
import { FinalRecoveryController } from './final-recovery.controller';
import { AcademicActsService } from './academic-acts.service';
import { AcademicActsController } from './academic-acts.controller';
import { RecoveryEngineService } from './recovery-engine.service';

@Module({
  controllers: [
    RecoveryConfigController,
    PeriodRecoveryController,
    FinalRecoveryController,
    AcademicActsController,
  ],
  providers: [
    RecoveryConfigService,
    RecoveryEngineService,
    PeriodRecoveryService,
    FinalRecoveryService,
    AcademicActsService,
  ],
  exports: [
    RecoveryConfigService,
    RecoveryEngineService,
    PeriodRecoveryService,
    FinalRecoveryService,
    AcademicActsService,
  ],
})
export class RecoveryModule {}
