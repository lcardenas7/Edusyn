import { Module } from '@nestjs/common';

import { AcademicTermsController } from './academic-terms.controller';
import { AcademicTermsService } from './academic-terms.service';
import { EvaluationComponentsController } from './evaluation-components.controller';
import { EvaluationComponentsService } from './evaluation-components.service';
import { EvaluationPlansController } from './evaluation-plans.controller';
import { EvaluationPlansService } from './evaluation-plans.service';
import { EvaluativeActivitiesController } from './evaluative-activities.controller';
import { EvaluativeActivitiesService } from './evaluative-activities.service';
import { PerformanceScaleController } from './performance-scale.controller';
import { PerformanceScaleService } from './performance-scale.service';
import { PreventiveCutsController } from './preventive-cuts.controller';
import { PreventiveCutsService } from './preventive-cuts.service';
import { StudentGradesController } from './student-grades.controller';
import { StudentGradesService } from './student-grades.service';
import { PeriodFinalGradesController } from './period-final-grades.controller';
import { PeriodFinalGradesService } from './period-final-grades.service';
import { PartialGradesController } from './partial-grades.controller';
import { PartialGradesService } from './partial-grades.service';
import { GradeAuditService } from './grade-audit.service';
import { PeriodFinalGradeWriter } from './period-final-grade.writer';
import { FinalComponentsController } from './final-components.controller';
import { FinalComponentsService } from './final-components.service';
import { FinalComponentGradesController } from './final-component-grades.controller';
import { FinalComponentGradesService } from './final-component-grades.service';
import { ValidateTenantContextGuard } from '../../common/guards/validate-tenant-context.guard';

@Module({
  controllers: [
    PerformanceScaleController,
    AcademicTermsController,
    EvaluationComponentsController,
    EvaluativeActivitiesController,
    EvaluationPlansController,
    StudentGradesController,
    PreventiveCutsController,
    PeriodFinalGradesController,
    PartialGradesController,
    FinalComponentsController,
    FinalComponentGradesController,
  ],
  providers: [
    PerformanceScaleService,
    AcademicTermsService,
    EvaluationComponentsService,
    EvaluativeActivitiesService,
    EvaluationPlansService,
    StudentGradesService,
    PreventiveCutsService,
    PeriodFinalGradesService,
    PartialGradesService,
    GradeAuditService,
    PeriodFinalGradeWriter,
    FinalComponentsService,
    FinalComponentGradesService,
    ValidateTenantContextGuard,
  ],
  exports: [StudentGradesService, PeriodFinalGradesService, PartialGradesService, GradeAuditService, FinalComponentsService, FinalComponentGradesService, PeriodFinalGradeWriter],
})
export class EvaluationModule {}
