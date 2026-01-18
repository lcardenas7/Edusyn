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

@Module({
  controllers: [
    PerformanceScaleController,
    AcademicTermsController,
    EvaluationComponentsController,
    EvaluativeActivitiesController,
    EvaluationPlansController,
    StudentGradesController,
    PreventiveCutsController,
  ],
  providers: [
    PerformanceScaleService,
    AcademicTermsService,
    EvaluationComponentsService,
    EvaluativeActivitiesService,
    EvaluationPlansService,
    StudentGradesService,
    PreventiveCutsService,
  ],
  exports: [StudentGradesService],
})
export class EvaluationModule {}
