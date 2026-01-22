import { Module } from '@nestjs/common';

import { CampusesController } from './campuses.controller';
import { CampusesService } from './campuses.service';
import { AreasController } from './areas.controller';
import { AreasService } from './areas.service';
import { GradesController } from './grades.controller';
import { GradesService } from './grades.service';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';
import { InstitutionsController } from './institutions.controller';
import { InstitutionsService } from './institutions.service';
import { ShiftsController } from './shifts.controller';
import { ShiftsService } from './shifts.service';
import { SubjectsController } from './subjects.controller';
import { SubjectsService } from './subjects.service';
import { TeacherAssignmentsController } from './teacher-assignments.controller';
import { TeacherAssignmentsService } from './teacher-assignments.service';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';
import { TeachersController } from './teachers.controller';
import { TeachersService } from './teachers.service';
import { GradingPeriodConfigController } from './grading-period-config.controller';
import { GradingPeriodConfigService } from './grading-period-config.service';
import { RecoveryPeriodConfigController } from './recovery-period-config.controller';
import { RecoveryPeriodConfigService } from './recovery-period-config.service';
import { AcademicYearLifecycleController } from './academic-year-lifecycle.controller';
import { AcademicYearLifecycleService } from './academic-year-lifecycle.service';
import { EnrollmentController } from './enrollment.controller';
import { EnrollmentService } from './enrollment.service';
import { GuardiansController } from './guardians.controller';
import { GuardiansService } from './guardians.service';

@Module({
  controllers: [
    InstitutionsController,
    CampusesController,
    ShiftsController,
    GradesController,
    GroupsController,
    AreasController,
    SubjectsController,
    TeacherAssignmentsController,
    StudentsController,
    TeachersController,
    GradingPeriodConfigController,
    RecoveryPeriodConfigController,
    AcademicYearLifecycleController,
    EnrollmentController,
    GuardiansController,
  ],
  providers: [
    InstitutionsService,
    CampusesService,
    ShiftsService,
    GradesService,
    GroupsService,
    AreasService,
    SubjectsService,
    TeacherAssignmentsService,
    StudentsService,
    TeachersService,
    GradingPeriodConfigService,
    RecoveryPeriodConfigService,
    AcademicYearLifecycleService,
    EnrollmentService,
    GuardiansService,
  ],
  exports: [GradingPeriodConfigService, RecoveryPeriodConfigService, AcademicYearLifecycleService, EnrollmentService, GuardiansService],
})
export class AcademicModule {}
