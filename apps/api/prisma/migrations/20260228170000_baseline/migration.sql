-- CreateEnum
CREATE TYPE "SchoolShift" AS ENUM ('MORNING', 'AFTERNOON', 'SINGLE', 'NIGHT');

-- CreateEnum
CREATE TYPE "GradeStage" AS ENUM ('PREESCOLAR', 'BASICA_PRIMARIA', 'BASICA_SECUNDARIA', 'MEDIA');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('TI', 'CC', 'CE', 'PASAPORTE', 'RC', 'NIP', 'NUIP');

-- CreateEnum
CREATE TYPE "PerformanceLevel" AS ENUM ('SUPERIOR', 'ALTO', 'BASICO', 'BAJO');

-- CreateEnum
CREATE TYPE "AcademicTermType" AS ENUM ('PERIOD', 'SEMESTER_EXAM');

-- CreateEnum
CREATE TYPE "AcademicTermStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'FINALIZED');

-- CreateEnum
CREATE TYPE "AcademicYearStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "CalendarType" AS ENUM ('A', 'B', 'FLEXIBLE');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'PROMOTED', 'REPEATED', 'WITHDRAWN', 'TRANSFERRED');

-- CreateEnum
CREATE TYPE "EnrollmentType" AS ENUM ('NEW', 'RENEWAL', 'TRANSFER_IN', 'REENTRY');

-- CreateEnum
CREATE TYPE "EnrollmentEventType" AS ENUM ('CREATED', 'GROUP_CHANGED', 'WITHDRAWN', 'TRANSFERRED', 'PROMOTED', 'REPEATED', 'REACTIVATED', 'STATUS_CHANGED', 'GRADE_CORRECTED', 'PROMOTION_EXCEPTION');

-- CreateEnum
CREATE TYPE "EnrollmentMovementType" AS ENUM ('ADMINISTRATIVE', 'ACADEMIC');

-- CreateEnum
CREATE TYPE "AcademicActType" AS ENUM ('GRADE_CORRECTION', 'PROMOTION_EXCEPTION', 'ATTENDANCE_CORRECTION', 'ENROLLMENT_CORRECTION', 'COMMITTEE_DECISION', 'YEAR_CLOSURE', 'ACADEMIC_COUNCIL', 'PROMOTION', 'RECOVERY_APPROVAL', 'FINAL_DECISION');

-- CreateEnum
CREATE TYPE "StudyModality" AS ENUM ('PRESENTIAL', 'VIRTUAL', 'HYBRID');

-- CreateEnum
CREATE TYPE "InstitutionStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'TRIAL', 'INACTIVE');

-- CreateEnum
CREATE TYPE "AreaCalculationType" AS ENUM ('INFORMATIVE', 'AVERAGE', 'WEIGHTED', 'DOMINANT');

-- CreateEnum
CREATE TYPE "AreaApprovalRule" AS ENUM ('AREA_AVERAGE', 'ALL_SUBJECTS_PASS', 'DOMINANT_SUBJECT_PASS');

-- CreateEnum
CREATE TYPE "AreaRecoveryRule" AS ENUM ('INDIVIDUAL_SUBJECT', 'FULL_AREA', 'CONDITIONAL', 'NONE');

-- CreateEnum
CREATE TYPE "SystemModule" AS ENUM ('ACADEMIC', 'ENROLLMENTS', 'ATTENDANCE', 'EVALUATION', 'RECOVERY', 'REPORTS', 'COMMUNICATIONS', 'OBSERVER', 'PERFORMANCE', 'MEN_REPORTS', 'DASHBOARD', 'USERS', 'CONFIG', 'ELECTIONS', 'PAYMENTS', 'FINANCE', 'TIMETABLE', 'DIAGNOSIS', 'TEACHER_WORKSPACE', 'VIRTUAL_CLASSROOM');

-- CreateEnum
CREATE TYPE "AcademicLevel" AS ENUM ('PREESCOLAR', 'PRIMARIA', 'SECUNDARIA', 'MEDIA', 'MEDIA_TECNICA', 'OTRO');

-- CreateEnum
CREATE TYPE "SubjectType" AS ENUM ('MANDATORY', 'ELECTIVE', 'OPTIONAL', 'TECHNICAL');

-- CreateEnum
CREATE TYPE "GroupExceptionType" AS ENUM ('EXCLUDE', 'INCLUDE', 'MODIFY');

-- CreateEnum
CREATE TYPE "AcademicStructureType" AS ENUM ('DIMENSIONS', 'SUBJECTS_ONLY', 'AREAS_SUBJECTS');

-- CreateEnum
CREATE TYPE "EnrollmentDocType" AS ENUM ('REGISTRO_CIVIL', 'TARJETA_IDENTIDAD', 'CEDULA', 'FOTO', 'BOLETIN_ANTERIOR', 'CERTIFICADO_ESTUDIO', 'CERTIFICADO_CONDUCTA', 'EPS', 'SISBEN', 'CARNET_VACUNACION', 'PAZ_Y_SALVO', 'OTRO');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'DELIVERED', 'VALIDATED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "GuardianRelationship" AS ENUM ('FATHER', 'MOTHER', 'STEPFATHER', 'STEPMOTHER', 'GRANDFATHER', 'GRANDMOTHER', 'UNCLE', 'AUNT', 'SIBLING', 'LEGAL_GUARDIAN', 'OTHER');

-- CreateEnum
CREATE TYPE "PreventiveAlertStatus" AS ENUM ('OPEN', 'IN_RECOVERY', 'RESOLVED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED');

-- CreateEnum
CREATE TYPE "ObservationType" AS ENUM ('POSITIVE', 'PEDAGOGICAL', 'BEHAVIORAL_MILD', 'ACTA_TYPE_I', 'ACTA_TYPE_II', 'ACTA_TYPE_III', 'PARENT_CITATION', 'COMMITMENT', 'COUNSELING_FOLLOWUP', 'REFERRAL', 'COMMITTEE_DECISION', 'PEDAGOGICAL_FOLLOWUP');

-- CreateEnum
CREATE TYPE "ObservationCategory" AS ENUM ('ACADEMIC', 'BEHAVIORAL', 'ATTENDANCE', 'UNIFORM', 'OTHER');

-- CreateEnum
CREATE TYPE "ObserverEntryStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'CLOSED');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('ANNOUNCEMENT', 'CIRCULAR', 'NOTIFICATION', 'REMINDER');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('DRAFT', 'SENT', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "RecipientType" AS ENUM ('USER', 'GROUP', 'GRADE', 'ALL_STUDENTS', 'ALL_TEACHERS', 'ALL_PARENTS');

-- CreateEnum
CREATE TYPE "RecoveryType" AS ENUM ('PERIOD', 'FINAL');

-- CreateEnum
CREATE TYPE "RecoveryStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'APPROVED', 'NOT_APPROVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RecoveryImpactType" AS ENUM ('ADJUST_TO_MINIMUM', 'AVERAGE_WITH_ORIGINAL', 'REPLACE_IF_HIGHER', 'QUALITATIVE_ONLY');

-- CreateEnum
CREATE TYPE "PerformanceDimension" AS ENUM ('COGNITIVO', 'PROCEDIMENTAL', 'ACTITUDINAL');

-- CreateEnum
CREATE TYPE "ComplementDisplayMode" AS ENUM ('CONCATENATE', 'SEPARATE_LINE');

-- CreateEnum
CREATE TYPE "AchievementDisplayMode" AS ENUM ('SEPARATE', 'COMBINED');

-- CreateEnum
CREATE TYPE "AchievementDisplayFormat" AS ENUM ('LIST', 'PARAGRAPH');

-- CreateEnum
CREATE TYPE "JudgmentPosition" AS ENUM ('END_OF_EACH', 'END_OF_ALL', 'NONE');

-- CreateEnum
CREATE TYPE "AttitudinalAchievementMode" AS ENUM ('GENERAL_PER_PERIOD', 'PER_ACADEMIC_ACHIEVEMENT');

-- CreateEnum
CREATE TYPE "AchievementType" AS ENUM ('ACADEMIC', 'ATTITUDINAL', 'PROMOTIONAL');

-- CreateEnum
CREATE TYPE "SupportStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PermissionAuditAction" AS ENUM ('GRANT', 'REVOKE', 'EXPIRE', 'ROLE_ASSIGN', 'ROLE_REMOVE', 'RULE_CHANGE', 'PERIOD_OPEN', 'PERIOD_CLOSE', 'WINDOW_OPEN', 'WINDOW_CLOSE');

-- CreateEnum
CREATE TYPE "ElectionProcessStatus" AS ENUM ('DRAFT', 'REGISTRATION', 'CAMPAIGN', 'VOTING', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ElectionType" AS ENUM ('PERSONERO', 'CONTRALOR', 'REPRESENTANTE_GRADO', 'REPRESENTANTE_CURSO', 'REPRESENTANTE_DOCENTES', 'COMITE_CONVIVENCIA_DOC');

-- CreateEnum
CREATE TYPE "ElectionStatus" AS ENUM ('ACTIVE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CandidateStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ElectionAuditAction" AS ENUM ('PROCESS_CREATED', 'PROCESS_STATUS_CHANGED', 'PROCESS_LOCKED', 'PROCESS_CLOSED', 'CANDIDATE_REGISTERED', 'CANDIDATE_APPROVED', 'CANDIDATE_REJECTED', 'CANDIDATE_UPDATED', 'VOTE_CAST', 'VOTE_ATTEMPTED_DUPLICATE', 'VOTE_ATTEMPTED_INVALID', 'RESULTS_CALCULATED', 'RESULTS_SNAPSHOT_CREATED', 'UNAUTHORIZED_ACCESS_ATTEMPT', 'INTEGRITY_CHECK_FAILED');

-- CreateEnum
CREATE TYPE "PaymentScope" AS ENUM ('INSTITUTION', 'SHIFT', 'GRADE', 'GROUP', 'INDIVIDUAL');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'EXEMPT', 'OVERDUE');

-- CreateEnum
CREATE TYPE "InstitutionalDocumentCategory" AS ENUM ('MANUAL', 'REGLAMENTO', 'FORMATO', 'CIRCULAR', 'PEI', 'SIEE', 'OTRO');

-- CreateEnum
CREATE TYPE "ManagementArea" AS ENUM ('ACADEMICA', 'DIRECTIVA', 'COMUNITARIA', 'ADMINISTRATIVA');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('BAJA', 'NORMAL', 'ALTA', 'URGENTE');

-- CreateEnum
CREATE TYPE "TaskCategory" AS ENUM ('PLANEACION', 'SEGUIMIENTO', 'EVIDENCIA', 'REUNION', 'CAPACITACION', 'PROYECTO', 'OTRO');

-- CreateEnum
CREATE TYPE "TaskAssignmentStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ThirdPartyType" AS ENUM ('STUDENT', 'TEACHER', 'GUARDIAN', 'GROUP', 'GRADE', 'EXTERNAL', 'PROVIDER');

-- CreateEnum
CREATE TYPE "ObligationStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'CANCELLED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'TRANSFER', 'CARD', 'CHECK', 'PSE', 'NEQUI', 'DAVIPLATA', 'OTHER');

-- CreateEnum
CREATE TYPE "FinancialMovementType" AS ENUM ('INCOME', 'EXPENSE', 'REFUND', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ScheduleMode" AS ENUM ('FIXED_TEACHER', 'ROTATING_TEACHER');

-- CreateEnum
CREATE TYPE "TimeBlockType" AS ENUM ('CLASS', 'BREAK', 'LUNCH', 'ASSEMBLY', 'FREE', 'TUTORING');

-- CreateEnum
CREATE TYPE "DayOfWeek" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY');

-- CreateEnum
CREATE TYPE "RoomRestrictionType" AS ENUM ('PREFERRED', 'EXCLUSIVE');

-- CreateEnum
CREATE TYPE "AdaptationLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "ActivityCompletionStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ApdAuditAction" AS ENUM ('PROFILE_CREATED', 'PROFILE_UPDATED', 'PROFILE_ACTIVATED', 'PROFILE_DEACTIVATED', 'PROFILE_VIEWED', 'PLAN_CREATED', 'PLAN_UPDATED', 'PLAN_STATUS_CHANGED', 'PLAN_PROGRESS_UPDATED', 'ACTIVITY_CREATED', 'ACTIVITY_UPDATED', 'PROGRESS_LOG_CREATED');

-- CreateEnum
CREATE TYPE "WorkspaceBoardType" AS ENUM ('KANBAN', 'CLASS_LOG', 'STUDENT_NOTES', 'CHECKLIST', 'MICRO_COLLECT', 'CLASSROOM_ROLES', 'PROJECT');

-- CreateEnum
CREATE TYPE "WorkspaceVisibility" AS ENUM ('PRIVATE', 'SHARED_COORDINATOR', 'SHARED_ADMIN');

-- CreateEnum
CREATE TYPE "WorkspaceItemStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "WorkspaceScopeType" AS ENUM ('GROUP', 'GRADE', 'MULTI_GROUP');

-- CreateEnum
CREATE TYPE "MaterialType" AS ENUM ('DOCUMENT', 'VIDEO_YOUTUBE', 'VIDEO_UPLOAD', 'LINK', 'TEXT', 'IMAGE');

-- CreateEnum
CREATE TYPE "ClassroomActivityType" AS ENUM ('TASK', 'QUIZ', 'FORUM', 'GAME', 'EXAM', 'ICFES_SIMULATOR');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('MULTIPLE_CHOICE', 'MULTIPLE_SELECT', 'TRUE_FALSE', 'SHORT_ANSWER', 'FILL_BLANK', 'ORDERING', 'MATCHING');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'GRADED', 'RETURNED', 'LATE', 'AUTO_GRADED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "documentType" "DocumentType",
    "documentNumber" TEXT,
    "phone" TEXT,
    "birthDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "signatureImageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "Institution" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "daneCode" TEXT,
    "nit" TEXT,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "status" "InstitutionStatus" NOT NULL DEFAULT 'TRIAL',
    "trialEndsAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "areaCalculationType" "AreaCalculationType" NOT NULL DEFAULT 'WEIGHTED',
    "areaApprovalRule" "AreaApprovalRule" NOT NULL DEFAULT 'AREA_AVERAGE',
    "areaRecoveryRule" "AreaRecoveryRule" NOT NULL DEFAULT 'INDIVIDUAL_SUBJECT',
    "areaFailIfAnyFails" BOOLEAN NOT NULL DEFAULT false,
    "gradingConfig" JSONB,
    "academicLevelsConfig" JSONB,
    "periodsConfig" JSONB,
    "enableDifferentialSupport" BOOLEAN NOT NULL DEFAULT false,
    "allowTeacherAccess" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Institution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstitutionModule" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "module" "SystemModule" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "features" TEXT[],

    CONSTRAINT "InstitutionModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstitutionUser" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstitutionUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campus" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL,
    "campusId" TEXT NOT NULL,
    "type" "SchoolShift" NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grade" (
    "id" TEXT NOT NULL,
    "stage" "GradeStage" NOT NULL,
    "number" INTEGER,
    "name" TEXT NOT NULL,
    "academicStructure" "AcademicStructureType" NOT NULL DEFAULT 'AREAS_SUBJECTS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Grade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "campusId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "gradeId" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "maxCapacity" INTEGER,
    "directorId" TEXT,
    "companionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Area" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Area_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "subjectType" "SubjectType" NOT NULL DEFAULT 'MANDATORY',
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicTemplate" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "level" "AcademicLevel" NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "achievementsPerPeriod" INTEGER NOT NULL DEFAULT 1,
    "useAttitudinalAchievement" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateArea" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "weightPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "calculationType" "AreaCalculationType" NOT NULL DEFAULT 'AVERAGE',
    "approvalRule" "AreaApprovalRule" NOT NULL DEFAULT 'AREA_AVERAGE',
    "recoveryRule" "AreaRecoveryRule" NOT NULL DEFAULT 'INDIVIDUAL_SUBJECT',
    "isMandatory" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateSubject" (
    "id" TEXT NOT NULL,
    "templateAreaId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "weeklyHours" INTEGER NOT NULL DEFAULT 0,
    "weightPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isDominant" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "achievementsPerPeriod" INTEGER,
    "useAttitudinalAchievement" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateSubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dimension" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dimension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateDimension" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "dimensionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateDimension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeTemplate" (
    "id" TEXT NOT NULL,
    "gradeId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "overrides" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradeTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupSubjectException" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "type" "GroupExceptionType" NOT NULL,
    "weeklyHours" INTEGER,
    "weightPercentage" DOUBLE PRECISION,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupSubjectException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicYear" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "name" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "status" "AcademicYearStatus" NOT NULL DEFAULT 'ACTIVE',
    "activatedAt" TIMESTAMP(3),
    "activatedById" TEXT,
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicCalendar" (
    "id" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "type" "CalendarType" NOT NULL DEFAULT 'A',
    "totalWeeks" INTEGER NOT NULL DEFAULT 40,
    "totalHours" INTEGER NOT NULL DEFAULT 800,
    "classStartDate" TIMESTAMP(3),
    "classEndDate" TIMESTAMP(3),
    "developmentWeeks" INTEGER NOT NULL DEFAULT 5,
    "vacations" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicCalendar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Period" (
    "id" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Period_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicTerm" (
    "id" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "type" "AcademicTermType" NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "weightPercentage" INTEGER NOT NULL,
    "status" "AcademicTermStatus" NOT NULL DEFAULT 'OPEN',
    "bulletinsReleasedForTeachers" BOOLEAN NOT NULL DEFAULT false,
    "finalizedAt" TIMESTAMP(3),
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TermReportCardSnapshot" (
    "id" TEXT NOT NULL,
    "academicTermId" TEXT NOT NULL,
    "studentEnrollmentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedById" TEXT,
    "data" JSONB NOT NULL,

    CONSTRAINT "TermReportCardSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TermReopeningRecord" (
    "id" TEXT NOT NULL,
    "academicTermId" TEXT NOT NULL,
    "reopenedById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "previousVersion" INTEGER NOT NULL,
    "reopenedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TermReopeningRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradingPeriodConfig" (
    "id" TEXT NOT NULL,
    "academicTermId" TEXT NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT false,
    "openDate" TIMESTAMP(3),
    "closeDate" TIMESTAMP(3),
    "allowLateEntry" BOOLEAN NOT NULL DEFAULT false,
    "lateEntryDays" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradingPeriodConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryPeriodConfig" (
    "id" TEXT NOT NULL,
    "academicTermId" TEXT NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT false,
    "openDate" TIMESTAMP(3),
    "closeDate" TIMESTAMP(3),
    "allowLateEntry" BOOLEAN NOT NULL DEFAULT false,
    "lateEntryDays" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecoveryPeriodConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherAssignment" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "weeklyHours" INTEGER NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "endReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerformanceScale" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "level" "PerformanceLevel" NOT NULL,
    "minScore" DECIMAL(65,30) NOT NULL,
    "maxScore" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerformanceScale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluativeActivity" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "teacherAssignmentId" TEXT NOT NULL,
    "academicTermId" TEXT NOT NULL,
    "evaluationPlanId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvaluativeActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationPlan" (
    "id" TEXT NOT NULL,
    "teacherAssignmentId" TEXT NOT NULL,
    "academicTermId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvaluationPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationComponent" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "parentId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvaluationComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationPlanComponentWeight" (
    "id" TEXT NOT NULL,
    "evaluationPlanId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "percentage" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvaluationPlanComponentWeight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "userId" TEXT,
    "documentType" TEXT NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "secondName" TEXT,
    "lastName" TEXT NOT NULL,
    "secondLastName" TEXT,
    "birthDate" TIMESTAMP(3),
    "birthPlace" TEXT,
    "gender" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "neighborhood" TEXT,
    "city" TEXT,
    "bloodType" TEXT,
    "eps" TEXT,
    "allergies" TEXT,
    "medicalConditions" TEXT,
    "medications" TEXT,
    "emergencyContact" TEXT,
    "emergencyPhone" TEXT,
    "stratum" INTEGER,
    "sisbenLevel" TEXT,
    "ethnicity" TEXT,
    "displacement" BOOLEAN NOT NULL DEFAULT false,
    "disability" TEXT,
    "disabilityType" TEXT,
    "hasDiagnosis" BOOLEAN NOT NULL DEFAULT false,
    "diagnosisType" TEXT,
    "diagnosisDetails" TEXT,
    "diagnosisSupports" TEXT,
    "diagnosisDate" TIMESTAMP(3),
    "diagnosisEntity" TEXT,
    "previousSchool" TEXT,
    "photo" TEXT,
    "observations" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "deletedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentDocument" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "type" "EnrollmentDocType" NOT NULL,
    "name" TEXT NOT NULL,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "validatedById" TEXT,
    "validatedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "observations" TEXT,
    "expirationDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guardian" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "secondName" TEXT,
    "lastName" TEXT NOT NULL,
    "secondLastName" TEXT,
    "phone" TEXT NOT NULL,
    "alternatePhone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "neighborhood" TEXT,
    "city" TEXT,
    "occupation" TEXT,
    "workplace" TEXT,
    "workPhone" TEXT,
    "workAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Guardian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentGuardian" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "relationship" "GuardianRelationship" NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "canPickUp" BOOLEAN NOT NULL DEFAULT true,
    "isEmergencyContact" BOOLEAN NOT NULL DEFAULT false,
    "receivesNotifications" BOOLEAN NOT NULL DEFAULT true,
    "receivesGrades" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentGuardian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentEnrollment" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "enrollmentType" "EnrollmentType" NOT NULL DEFAULT 'NEW',
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "shift" "SchoolShift",
    "modality" "StudyModality" NOT NULL DEFAULT 'PRESENTIAL',
    "enrollmentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawalDate" TIMESTAMP(3),
    "withdrawalReason" TEXT,
    "promotedFromId" TEXT,
    "observations" TEXT,
    "enrolledById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnrollmentArea" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "areaId" TEXT,
    "areaName" TEXT NOT NULL,
    "areaCode" TEXT,
    "weightPercentage" DOUBLE PRECISION NOT NULL,
    "calculationType" "AreaCalculationType" NOT NULL,
    "approvalRule" "AreaApprovalRule" NOT NULL,
    "recoveryRule" "AreaRecoveryRule" NOT NULL,
    "isMandatory" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnrollmentArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnrollmentSubject" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "enrollmentAreaId" TEXT NOT NULL,
    "subjectId" TEXT,
    "subjectName" TEXT NOT NULL,
    "subjectCode" TEXT,
    "weeklyHours" INTEGER NOT NULL DEFAULT 0,
    "weightPercentage" DOUBLE PRECISION NOT NULL,
    "isDominant" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "achievementsPerPeriod" INTEGER NOT NULL DEFAULT 1,
    "useAttitudinalAchievement" BOOLEAN NOT NULL DEFAULT false,
    "teacherId" TEXT,
    "teacherName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnrollmentSubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnrollmentDimension" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "dimensionId" TEXT,
    "dimensionName" TEXT NOT NULL,
    "dimensionCode" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnrollmentDimension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnrollmentEvent" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "type" "EnrollmentEventType" NOT NULL,
    "movementType" "EnrollmentMovementType",
    "previousValue" JSONB,
    "newValue" JSONB,
    "reason" TEXT,
    "observations" TEXT,
    "academicActId" TEXT,
    "performedById" TEXT NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnrollmentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentGrade" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "studentEnrollmentId" TEXT NOT NULL,
    "evaluativeActivityId" TEXT NOT NULL,
    "score" DECIMAL(3,1) NOT NULL,
    "observations" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentGrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeriodFinalGrade" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "studentEnrollmentId" TEXT NOT NULL,
    "academicTermId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "finalScore" DECIMAL(3,1) NOT NULL,
    "observations" TEXT,
    "enteredById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PeriodFinalGrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartialGrade" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "studentEnrollmentId" TEXT NOT NULL,
    "teacherAssignmentId" TEXT NOT NULL,
    "academicTermId" TEXT NOT NULL,
    "componentType" TEXT NOT NULL,
    "activityIndex" INTEGER NOT NULL,
    "activityName" TEXT NOT NULL,
    "activityType" TEXT,
    "score" DECIMAL(3,1) NOT NULL,
    "observations" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartialGrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinalComponent" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weightPercentage" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinalComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinalComponentGrade" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "studentEnrollmentId" TEXT NOT NULL,
    "teacherAssignmentId" TEXT NOT NULL,
    "finalComponentId" TEXT NOT NULL,
    "grade" DECIMAL(3,1) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinalComponentGrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreventiveCutConfig" (
    "id" TEXT NOT NULL,
    "academicTermId" TEXT NOT NULL,
    "cutoffDate" TIMESTAMP(3) NOT NULL,
    "riskThresholdScore" DECIMAL(3,1) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreventiveCutConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreventiveAlert" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "teacherAssignmentId" TEXT NOT NULL,
    "studentEnrollmentId" TEXT NOT NULL,
    "academicTermId" TEXT NOT NULL,
    "cutoffDate" TIMESTAMP(3) NOT NULL,
    "computedGrade" DECIMAL(3,1),
    "performanceLevel" "PerformanceLevel",
    "status" "PreventiveAlertStatus" NOT NULL DEFAULT 'OPEN',
    "recoveryPlan" TEXT,
    "meetingAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreventiveAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "teacherAssignmentId" TEXT NOT NULL,
    "studentEnrollmentId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "observations" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TutoringAttendance" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "studentEnrollmentId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "observations" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TutoringAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentObservation" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "studentEnrollmentId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "type" "ObservationType" NOT NULL,
    "category" "ObservationCategory" NOT NULL,
    "status" "ObserverEntryStatus" NOT NULL DEFAULT 'OPEN',
    "description" TEXT NOT NULL,
    "actionTaken" TEXT,
    "parentNotified" BOOLEAN NOT NULL DEFAULT false,
    "parentNotifiedAt" TIMESTAMP(3),
    "requiresFollowUp" BOOLEAN NOT NULL DEFAULT false,
    "followUpDate" TIMESTAMP(3),
    "followUpNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActaRecord" (
    "id" TEXT NOT NULL,
    "observationId" TEXT NOT NULL,
    "actaNumber" TEXT,
    "actaType" TEXT NOT NULL,
    "facts" TEXT NOT NULL,
    "regulationApplied" TEXT,
    "witnesses" TEXT,
    "studentStatement" TEXT,
    "digitalSignatures" TEXT,
    "sanctions" TEXT,
    "followUpRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActaRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObserverCommitment" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "observationId" TEXT,
    "studentEnrollmentId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "responsibleRole" TEXT,
    "status" "ObserverEntryStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "closureEvidence" TEXT,
    "closedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ObserverCommitment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuardianCitation" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "observationId" TEXT,
    "studentEnrollmentId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "attended" BOOLEAN,
    "agreements" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuardianCitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObserverReferral" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "observationId" TEXT,
    "studentEnrollmentId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "referredToRole" TEXT NOT NULL,
    "referredToUserId" TEXT,
    "reason" TEXT NOT NULL,
    "status" "ObserverEntryStatus" NOT NULL DEFAULT 'OPEN',
    "responseNotes" TEXT,
    "respondedAt" TIMESTAMP(3),
    "respondedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ObserverReferral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObserverEvidence" (
    "id" TEXT NOT NULL,
    "observationId" TEXT,
    "actaRecordId" TEXT,
    "citationId" TEXT,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER,
    "description" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ObserverEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedagogicalMeasure" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "observationId" TEXT NOT NULL,
    "studentEnrollmentId" TEXT NOT NULL,
    "measureType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "status" "ObserverEntryStatus" NOT NULL DEFAULT 'OPEN',
    "result" TEXT,
    "appliedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PedagogicalMeasure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "parentId" TEXT,
    "type" "MessageType" NOT NULL,
    "subject" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageRecipient" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "recipientType" "RecipientType" NOT NULL,
    "recipientId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageAttachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "imageUrl" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "authorId" TEXT NOT NULL,
    "visibleToRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GalleryImage" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT NOT NULL,
    "category" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "uploadedById" TEXT NOT NULL,
    "visibleToRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GalleryImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "location" TEXT,
    "eventType" TEXT NOT NULL DEFAULT 'GENERAL',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "authorId" TEXT NOT NULL,
    "visibleToRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryConfig" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "minPassingScore" DECIMAL(3,1) NOT NULL DEFAULT 3.0,
    "periodRecoveryEnabled" BOOLEAN NOT NULL DEFAULT true,
    "periodMaxScore" DECIMAL(3,1) NOT NULL DEFAULT 3.0,
    "periodImpactType" "RecoveryImpactType" NOT NULL DEFAULT 'ADJUST_TO_MINIMUM',
    "finalRecoveryEnabled" BOOLEAN NOT NULL DEFAULT true,
    "finalMaxScore" DECIMAL(3,1) NOT NULL DEFAULT 3.0,
    "finalImpactType" "RecoveryImpactType" NOT NULL DEFAULT 'ADJUST_TO_MINIMUM',
    "maxAreasRecoverable" INTEGER NOT NULL DEFAULT 2,
    "periodRecoveryStartDate" TIMESTAMP(3),
    "periodRecoveryEndDate" TIMESTAMP(3),
    "finalRecoveryStartDate" TIMESTAMP(3),
    "finalRecoveryEndDate" TIMESTAMP(3),
    "requiresAcademicCouncilAct" BOOLEAN NOT NULL DEFAULT true,
    "requiresPromotionAct" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecoveryConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeriodRecovery" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "studentEnrollmentId" TEXT NOT NULL,
    "academicTermId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "originalScore" DECIMAL(3,1) NOT NULL,
    "status" "RecoveryStatus" NOT NULL DEFAULT 'PENDING',
    "activityDescription" TEXT,
    "scheduledDate" TIMESTAMP(3),
    "completedDate" TIMESTAMP(3),
    "reinforcedDimension" TEXT DEFAULT 'COGNITIVA',
    "recoveryScore" DECIMAL(3,1),
    "finalScore" DECIMAL(3,1),
    "impactType" "RecoveryImpactType",
    "evidences" TEXT,
    "observations" TEXT,
    "assignedById" TEXT NOT NULL,
    "evaluatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PeriodRecovery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinalRecoveryPlan" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "studentEnrollmentId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "originalAreaScore" DECIMAL(3,1) NOT NULL,
    "status" "RecoveryStatus" NOT NULL DEFAULT 'PENDING',
    "activities" TEXT,
    "objectives" TEXT,
    "resources" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "completedDate" TIMESTAMP(3),
    "recoveryScore" DECIMAL(3,1),
    "finalAreaScore" DECIMAL(3,1),
    "impactType" "RecoveryImpactType",
    "evidences" TEXT,
    "observations" TEXT,
    "responsibleTeacherId" TEXT NOT NULL,
    "supervisorId" TEXT,
    "finalDecision" TEXT,
    "approvedById" TEXT,
    "approvalDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinalRecoveryPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicAct" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "actType" "AcademicActType" NOT NULL,
    "actNumber" TEXT NOT NULL,
    "actDate" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "decisions" TEXT,
    "attendees" TEXT,
    "studentEnrollmentId" TEXT,
    "finalRecoveryPlanId" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvalDate" TIMESTAMP(3),
    "documentUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicAct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerformanceLevelComplement" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "level" "PerformanceLevel" NOT NULL,
    "complement" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayMode" "ComplementDisplayMode" NOT NULL DEFAULT 'CONCATENATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerformanceLevelComplement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerformanceConfig" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "showByDimension" BOOLEAN NOT NULL DEFAULT true,
    "allowManualEdit" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerformanceConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubjectPerformance" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "teacherAssignmentId" TEXT NOT NULL,
    "academicTermId" TEXT NOT NULL,
    "dimension" "PerformanceDimension" NOT NULL,
    "baseDescription" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubjectPerformance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerformanceManualEdit" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "studentEnrollmentId" TEXT NOT NULL,
    "academicTermId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "dimension" "PerformanceDimension" NOT NULL,
    "originalText" TEXT NOT NULL,
    "editedText" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "editedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PerformanceManualEdit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AchievementConfig" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "achievementsPerPeriod" INTEGER NOT NULL DEFAULT 1,
    "usePromotionalAchievement" BOOLEAN NOT NULL DEFAULT true,
    "useAttitudinalAchievement" BOOLEAN NOT NULL DEFAULT false,
    "attitudinalMode" "AttitudinalAchievementMode" NOT NULL DEFAULT 'GENERAL_PER_PERIOD',
    "useValueJudgments" BOOLEAN NOT NULL DEFAULT true,
    "useObservations" BOOLEAN NOT NULL DEFAULT false,
    "displayMode" "AchievementDisplayMode" NOT NULL DEFAULT 'SEPARATE',
    "displayFormat" "AchievementDisplayFormat" NOT NULL DEFAULT 'LIST',
    "judgmentPosition" "JudgmentPosition" NOT NULL DEFAULT 'END_OF_EACH',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AchievementConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObservationTemplate" (
    "id" TEXT NOT NULL,
    "achievementConfigId" TEXT NOT NULL,
    "level" "PerformanceLevel" NOT NULL,
    "template" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ObservationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValueJudgmentTemplate" (
    "id" TEXT NOT NULL,
    "achievementConfigId" TEXT NOT NULL,
    "level" "PerformanceLevel" NOT NULL,
    "template" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ValueJudgmentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "teacherAssignmentId" TEXT NOT NULL,
    "academicTermId" TEXT NOT NULL,
    "orderNumber" INTEGER NOT NULL DEFAULT 1,
    "achievementType" "AchievementType" NOT NULL DEFAULT 'ACADEMIC',
    "baseDescription" TEXT NOT NULL,
    "isPromotional" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttitudinalAchievement" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "teacherAssignmentId" TEXT NOT NULL,
    "academicTermId" TEXT NOT NULL,
    "achievementId" TEXT,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttitudinalAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentAchievement" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "studentEnrollmentId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "performanceLevel" "PerformanceLevel" NOT NULL,
    "suggestedText" TEXT,
    "approvedText" TEXT,
    "isTextApproved" BOOLEAN NOT NULL DEFAULT false,
    "suggestedJudgment" TEXT,
    "approvedJudgment" TEXT,
    "isJudgmentApproved" BOOLEAN NOT NULL DEFAULT false,
    "observation" TEXT,
    "attitudinalText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,

    CONSTRAINT "StudentAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AchievementBank" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "subjectId" TEXT,
    "areaId" TEXT,
    "gradeId" TEXT,
    "description" TEXT NOT NULL,
    "achievementType" "AchievementType" NOT NULL DEFAULT 'ACADEMIC',
    "performanceLevel" "PerformanceLevel",
    "category" TEXT,
    "tags" TEXT,
    "createdById" TEXT NOT NULL,
    "isShared" BOOLEAN NOT NULL DEFAULT true,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AchievementBank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "function" TEXT NOT NULL,
    "subFunction" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleBasePermission" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoleBasePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserExtraPermission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "grantedById" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "revokeReason" TEXT,

    CONSTRAINT "UserExtraPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermissionAuditLog" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "action" "PermissionAuditAction" NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "permissionId" TEXT,
    "oldRole" TEXT,
    "newRole" TEXT,
    "performedById" TEXT NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,

    CONSTRAINT "PermissionAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ElectionProcess" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "registrationStart" TIMESTAMP(3),
    "registrationEnd" TIMESTAMP(3),
    "campaignStart" TIMESTAMP(3),
    "campaignEnd" TIMESTAMP(3),
    "votingStart" TIMESTAMP(3),
    "votingEnd" TIMESTAMP(3),
    "status" "ElectionProcessStatus" NOT NULL DEFAULT 'DRAFT',
    "enablePersonero" BOOLEAN NOT NULL DEFAULT true,
    "enableContralor" BOOLEAN NOT NULL DEFAULT true,
    "enableRepresentanteGrado" BOOLEAN NOT NULL DEFAULT true,
    "enableRepresentanteCurso" BOOLEAN NOT NULL DEFAULT true,
    "allowBlankVote" BOOLEAN NOT NULL DEFAULT true,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "lockedAt" TIMESTAMP(3),
    "lockedById" TEXT,
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "closureSignature" TEXT,
    "finalSnapshot" JSONB,
    "finalHash" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ElectionProcess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Election" (
    "id" TEXT NOT NULL,
    "electionProcessId" TEXT NOT NULL,
    "type" "ElectionType" NOT NULL,
    "gradeId" TEXT,
    "groupId" TEXT,
    "status" "ElectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Election_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "slogan" TEXT,
    "proposals" TEXT,
    "photo" TEXT,
    "color" TEXT,
    "ballotNumber" INTEGER,
    "status" "CandidateStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "candidateId" TEXT,
    "votedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ElectionResult" (
    "id" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "candidateId" TEXT,
    "votes" INTEGER NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL,
    "position" INTEGER NOT NULL,
    "isWinner" BOOLEAN NOT NULL DEFAULT false,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ElectionResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ElectionAuditLog" (
    "id" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "electionId" TEXT,
    "action" "ElectionAuditAction" NOT NULL,
    "actorId" TEXT,
    "actorType" TEXT NOT NULL,
    "actorIp" TEXT,
    "payload" JSONB,
    "previousState" JSONB,
    "newState" JSONB,
    "checksum" TEXT NOT NULL,
    "previousLogId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ElectionAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentConcept" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "defaultAmount" DECIMAL(12,2),
    "isRecurrent" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentConcept_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "conceptId" TEXT,
    "academicYearId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "scope" "PaymentScope" NOT NULL DEFAULT 'INSTITUTION',
    "scopeFilter" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentPayment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "discountAmount" DECIMAL(12,2),
    "discountReason" TEXT,
    "observations" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentTransaction" (
    "id" TEXT NOT NULL,
    "studentPaymentId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paymentMethod" TEXT,
    "reference" TEXT,
    "observations" TEXT,
    "receivedById" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstitutionalDocument" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "InstitutionalDocumentCategory" NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "uploadedById" TEXT NOT NULL,
    "visibleToRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstitutionalDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagementLeader" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "area" "ManagementArea" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "assignedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagementLeader_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagementTask" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "TaskCategory" NOT NULL,
    "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL',
    "dueDate" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "leaderId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagementTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskAssignment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "assigneeId" TEXT NOT NULL,
    "status" "TaskAssignmentStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "responseNote" TEXT,
    "evidenceUrl" TEXT,
    "evidenceFileName" TEXT,
    "evidenceFileSize" INTEGER,
    "evidenceMimeType" TEXT,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verificationNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstitutionStorageUsage" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "documentsUsage" BIGINT NOT NULL DEFAULT 0,
    "evidencesUsage" BIGINT NOT NULL DEFAULT 0,
    "galleryUsage" BIGINT NOT NULL DEFAULT 0,
    "otherUsage" BIGINT NOT NULL DEFAULT 0,
    "documentsLimit" BIGINT NOT NULL DEFAULT 524288000,
    "evidencesLimit" BIGINT NOT NULL DEFAULT 1073741824,
    "galleryLimit" BIGINT NOT NULL DEFAULT 104857600,
    "lastCalculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstitutionStorageUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialThirdParty" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "type" "ThirdPartyType" NOT NULL,
    "referenceId" TEXT,
    "name" TEXT NOT NULL,
    "document" TEXT,
    "documentType" "DocumentType",
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "businessName" TEXT,
    "nit" TEXT,
    "bankName" TEXT,
    "bankAccount" TEXT,
    "bankAccountType" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialThirdParty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialCategory" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "code" TEXT,
    "type" "FinancialMovementType" NOT NULL DEFAULT 'INCOME',
    "budgetAmount" DECIMAL(15,2),
    "color" TEXT,
    "icon" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChargeConcept" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT NOT NULL,
    "defaultAmount" DECIMAL(15,2) NOT NULL,
    "isMassive" BOOLEAN NOT NULL DEFAULT false,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "allowPartial" BOOLEAN NOT NULL DEFAULT true,
    "allowDiscount" BOOLEAN NOT NULL DEFAULT true,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "lateFeeType" TEXT,
    "lateFeeValue" DECIMAL(15,2),
    "gracePeriodDays" INTEGER DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChargeConcept_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialObligation" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "thirdPartyId" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "originalAmount" DECIMAL(15,2) NOT NULL,
    "discountAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "lateFeeAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(15,2) NOT NULL,
    "paidAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "balance" DECIMAL(15,2) NOT NULL,
    "status" "ObligationStatus" NOT NULL DEFAULT 'PENDING',
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "paidDate" TIMESTAMP(3),
    "discountReason" TEXT,
    "discountApprovedBy" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialObligation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialPayment" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "obligationId" TEXT,
    "thirdPartyId" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "receiptNumber" TEXT,
    "transactionRef" TEXT,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "pdfUrl" TEXT,
    "pdfGeneratedAt" TIMESTAMP(3),
    "verificationHash" TEXT,
    "receivedById" TEXT NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "voidReason" TEXT,
    "externalInvoiceId" TEXT,
    "cufe" TEXT,
    "dianStatus" TEXT,
    "electronicProvider" TEXT,
    "electronicXmlUrl" TEXT,
    "electronicPdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialExpense" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "providerId" TEXT,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "expenseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invoiceNumber" TEXT,
    "invoiceDate" TIMESTAMP(3),
    "paymentMethod" "PaymentMethod",
    "transactionRef" TEXT,
    "attachmentUrl" TEXT,
    "attachmentName" TEXT,
    "notes" TEXT,
    "registeredById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialInvoice" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "thirdPartyId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "type" "FinancialMovementType" NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotal" DECIMAL(15,2) NOT NULL,
    "discountTotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(15,2) NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "paidDate" TIMESTAMP(3),
    "pdfUrl" TEXT,
    "pdfGeneratedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "cancelledById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialInvoiceItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "obligationId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(15,2) NOT NULL,
    "discount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(15,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialInvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialSettings" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "invoicePrefix" TEXT NOT NULL DEFAULT 'FAC',
    "invoiceNextNumber" INTEGER NOT NULL DEFAULT 1,
    "receiptPrefix" TEXT NOT NULL DEFAULT 'REC',
    "receiptNextNumber" INTEGER NOT NULL DEFAULT 1,
    "defaultLateFeeType" TEXT,
    "defaultLateFeeValue" DECIMAL(15,2),
    "defaultGracePeriodDays" INTEGER NOT NULL DEFAULT 5,
    "billingMode" TEXT NOT NULL DEFAULT 'INTERNAL_ONLY',
    "taxId" TEXT,
    "businessName" TEXT,
    "taxRegime" TEXT,
    "ciiu" TEXT,
    "economicActivity" TEXT,
    "invoiceResolution" TEXT,
    "invoiceResolutionDate" TIMESTAMP(3),
    "invoiceResolutionPrefix" TEXT,
    "invoiceRangeFrom" INTEGER,
    "invoiceRangeTo" INTEGER,
    "invoiceLogoUrl" TEXT,
    "invoicePageSize" TEXT NOT NULL DEFAULT 'HALF_LETTER',
    "invoicePrimaryColor" TEXT DEFAULT '#1E40AF',
    "invoiceSecondaryColor" TEXT DEFAULT '#F0F9FF',
    "invoiceFooterText" TEXT,
    "invoiceShowQR" BOOLEAN NOT NULL DEFAULT true,
    "invoiceShowBankAccounts" BOOLEAN NOT NULL DEFAULT true,
    "invoiceCity" TEXT,
    "invoiceAddress" TEXT,
    "invoicePhone" TEXT,
    "invoiceEmail" TEXT,
    "bankAccounts" JSONB,
    "allowTeacherCollection" BOOLEAN NOT NULL DEFAULT false,
    "sendPaymentReminders" BOOLEAN NOT NULL DEFAULT true,
    "reminderDaysBefore" INTEGER NOT NULL DEFAULT 3,
    "electronicProvider" TEXT,
    "electronicProviderKey" TEXT,
    "electronicProviderUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashRegisterClose" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "closeDate" DATE NOT NULL,
    "cashTotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "transferTotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "cardTotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "otherTotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "physicalCash" DECIMAL(15,2),
    "difference" DECIMAL(15,2),
    "notes" TEXT,
    "closedById" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashRegisterClose_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeBlock" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "type" "TimeBlockType" NOT NULL DEFAULT 'CLASS',
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimeBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "campusId" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "capacity" INTEGER,
    "description" TEXT,
    "equipment" TEXT[],
    "isReservable" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomRestriction" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "subjectId" TEXT,
    "type" "RoomRestrictionType" NOT NULL DEFAULT 'PREFERRED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomRestriction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleGradeConfig" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "gradeId" TEXT NOT NULL,
    "mode" "ScheduleMode" NOT NULL DEFAULT 'ROTATING_TEACHER',
    "maxConsecutiveHours" INTEGER,
    "preferDistribution" BOOLEAN NOT NULL DEFAULT true,
    "avoidHeavyLastHours" BOOLEAN NOT NULL DEFAULT false,
    "allowDoubleBlocks" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleGradeConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherAvailability" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "dayOfWeek" "DayOfWeek" NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleEntry" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "timeBlockId" TEXT NOT NULL,
    "dayOfWeek" "DayOfWeek" NOT NULL,
    "teacherAssignmentId" TEXT,
    "projectName" TEXT,
    "projectDescription" TEXT,
    "roomId" TEXT,
    "notes" TEXT,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleGenerationContext" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "lastStep" TEXT NOT NULL DEFAULT 'load',
    "startTime" TEXT,
    "classesPerDay" INTEGER,
    "classDurationMinutes" INTEGER,
    "breakDurationMinutes" INTEGER,
    "breakAfterBlock" INTEGER,
    "secondBreakAfterBlock" INTEGER,
    "includeLunch" BOOLEAN NOT NULL DEFAULT true,
    "lunchDurationMinutes" INTEGER,
    "lunchAfterBlock" INTEGER,
    "includeTutoring" BOOLEAN NOT NULL DEFAULT false,
    "tutoringDurationMinutes" INTEGER,
    "activeDays" TEXT[],
    "clearExisting" BOOLEAN NOT NULL DEFAULT true,
    "respectAvailability" BOOLEAN NOT NULL DEFAULT true,
    "groupTeacherBlocks" BOOLEAN NOT NULL DEFAULT true,
    "selectedGroupIds" TEXT[],
    "lastGenerationResult" JSONB,
    "configSaved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleGenerationContext_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportCardConfig" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "showLogo" BOOLEAN NOT NULL DEFAULT true,
    "showShield" BOOLEAN NOT NULL DEFAULT false,
    "logoUrl" TEXT,
    "headerResolution" TEXT,
    "headerMunicipality" TEXT,
    "headerDepartment" TEXT,
    "primaryColor" TEXT DEFAULT '#1E3A8A',
    "evaluationType" TEXT NOT NULL DEFAULT 'NUMERIC',
    "showNumericGrade" BOOLEAN NOT NULL DEFAULT true,
    "showPerformanceLevel" BOOLEAN NOT NULL DEFAULT true,
    "showAchievements" BOOLEAN NOT NULL DEFAULT true,
    "showRecommendations" BOOLEAN NOT NULL DEFAULT true,
    "showMotivationalMsg" BOOLEAN NOT NULL DEFAULT true,
    "motivationalMsgType" TEXT NOT NULL DEFAULT 'AUTO',
    "customMotivationalTpl" TEXT,
    "showAttendance" BOOLEAN NOT NULL DEFAULT true,
    "showRanking" BOOLEAN NOT NULL DEFAULT true,
    "showObservations" BOOLEAN NOT NULL DEFAULT true,
    "showAreaAverages" BOOLEAN NOT NULL DEFAULT true,
    "showGeneralAverage" BOOLEAN NOT NULL DEFAULT true,
    "showScale" BOOLEAN NOT NULL DEFAULT true,
    "showRecoveryGrades" BOOLEAN NOT NULL DEFAULT true,
    "showComponents" BOOLEAN NOT NULL DEFAULT false,
    "signatureConfig" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportCardConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstitutionRoleCapability" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "capabilityKey" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstitutionRoleCapability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedagogicalSupportPlan" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "studentEnrollmentId" TEXT NOT NULL,
    "achievementId" TEXT,
    "academicTermId" TEXT NOT NULL,
    "supportProfileId" TEXT,
    "supportStrategy" TEXT NOT NULL,
    "familyCommitment" TEXT,
    "followUpDate" TIMESTAMP(3),
    "observations" TEXT,
    "objectives" JSONB,
    "adaptationStrategies" JSONB,
    "evaluationAdjustments" JSONB,
    "progressPercentage" DECIMAL(5,2),
    "status" "SupportStatus" NOT NULL DEFAULT 'ACTIVE',
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PedagogicalSupportPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EducationalSupportProfile" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "supportCategory" TEXT NOT NULL,
    "pedagogicalNotes" TEXT,
    "parentConsentAccepted" BOOLEAN NOT NULL DEFAULT false,
    "consentDate" TIMESTAMP(3),
    "consentDocumentUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EducationalSupportProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportActivity" (
    "id" TEXT NOT NULL,
    "supportPlanId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "originalActivityDescription" TEXT,
    "teacherFinalActivity" TEXT,
    "adaptationLevel" "AdaptationLevel" NOT NULL DEFAULT 'MEDIUM',
    "completionStatus" "ActivityCompletionStatus" NOT NULL DEFAULT 'PENDING',
    "teacherFeedback" TEXT,
    "studentPerformanceScore" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportProgressLog" (
    "id" TEXT NOT NULL,
    "supportPlanId" TEXT NOT NULL,
    "progressIndicator" INTEGER NOT NULL,
    "qualitativeObservation" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportProgressLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApdAuditLog" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "ApdAuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "details" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApdAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceBoard" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "academicYearId" TEXT,
    "groupId" TEXT,
    "gradeId" TEXT,
    "type" "WorkspaceBoardType" NOT NULL,
    "scopeType" "WorkspaceScopeType",
    "title" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "metadata" JSONB,
    "visibility" "WorkspaceVisibility" NOT NULL DEFAULT 'PRIVATE',
    "sharedAt" TIMESTAMP(3),
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceBoard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceColumn" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT,

    CONSTRAINT "WorkspaceColumn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceItem" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "columnId" TEXT,
    "studentId" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "metadata" JSONB,
    "status" "WorkspaceItemStatus" NOT NULL DEFAULT 'TODO',
    "dueDate" TIMESTAMP(3),
    "eventDate" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Classroom" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "teacherAssignmentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "coverImage" TEXT,
    "color" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Classroom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassroomSection" (
    "id" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassroomSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassroomMaterial" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "type" "MaterialType" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "fileUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassroomMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassroomAnnouncement" (
    "id" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "attachmentUrl" TEXT,
    "attachmentName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassroomAnnouncement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassroomActivity" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "type" "ClassroomActivityType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "maxScore" DECIMAL(3,1),
    "dueDate" TIMESTAMP(3),
    "openDate" TIMESTAMP(3),
    "timeLimitMinutes" INTEGER,
    "allowLateSubmit" BOOLEAN NOT NULL DEFAULT false,
    "maxAttempts" INTEGER NOT NULL DEFAULT 1,
    "shuffleQuestions" BOOLEAN NOT NULL DEFAULT false,
    "showResults" BOOLEAN NOT NULL DEFAULT true,
    "syncToGradebook" BOOLEAN NOT NULL DEFAULT false,
    "gradebookComponent" TEXT,
    "gradebookIndex" INTEGER,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassroomActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityQuestion" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "text" TEXT NOT NULL,
    "imageUrl" TEXT,
    "options" JSONB,
    "correctAnswer" TEXT,
    "points" DECIMAL(3,1) NOT NULL DEFAULT 1.0,
    "explanation" TEXT,
    "wrongExplanations" JSONB,
    "subjectArea" TEXT,
    "competency" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ActivityQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivitySubmission" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "studentEnrollmentId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "content" TEXT,
    "fileUrl" TEXT,
    "score" DECIMAL(3,1),
    "feedback" TEXT,
    "gradedAt" TIMESTAMP(3),
    "gradedById" TEXT,
    "startedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "timeSpentSeconds" INTEGER,
    "syncedToGradebook" BOOLEAN NOT NULL DEFAULT false,
    "partialGradeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivitySubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionAnswer" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answer" TEXT,
    "selectedOptions" JSONB,
    "isCorrect" BOOLEAN,
    "pointsEarned" DECIMAL(3,1),

    CONSTRAINT "QuestionAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForumPost" (
    "id" TEXT NOT NULL,
    "classroomId" TEXT,
    "activityId" TEXT,
    "authorId" TEXT NOT NULL,
    "parentId" TEXT,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForumPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Institution_daneCode_key" ON "Institution"("daneCode");

-- CreateIndex
CREATE UNIQUE INDEX "Institution_slug_key" ON "Institution"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "InstitutionModule_institutionId_module_key" ON "InstitutionModule"("institutionId", "module");

-- CreateIndex
CREATE UNIQUE INDEX "InstitutionUser_userId_institutionId_key" ON "InstitutionUser"("userId", "institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "Campus_institutionId_name_key" ON "Campus"("institutionId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Shift_campusId_type_key" ON "Shift"("campusId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Grade_stage_name_key" ON "Grade"("stage", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Group_campusId_shiftId_gradeId_name_key" ON "Group"("campusId", "shiftId", "gradeId", "name");

-- CreateIndex
CREATE INDEX "Area_institutionId_idx" ON "Area"("institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "Area_institutionId_name_key" ON "Area"("institutionId", "name");

-- CreateIndex
CREATE INDEX "Subject_areaId_idx" ON "Subject"("areaId");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_areaId_name_key" ON "Subject"("areaId", "name");

-- CreateIndex
CREATE INDEX "AcademicTemplate_institutionId_academicYearId_level_idx" ON "AcademicTemplate"("institutionId", "academicYearId", "level");

-- CreateIndex
CREATE INDEX "AcademicTemplate_academicYearId_idx" ON "AcademicTemplate"("academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicTemplate_institutionId_academicYearId_name_key" ON "AcademicTemplate"("institutionId", "academicYearId", "name");

-- CreateIndex
CREATE INDEX "TemplateArea_templateId_idx" ON "TemplateArea"("templateId");

-- CreateIndex
CREATE INDEX "TemplateArea_areaId_idx" ON "TemplateArea"("areaId");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateArea_templateId_areaId_key" ON "TemplateArea"("templateId", "areaId");

-- CreateIndex
CREATE INDEX "TemplateSubject_templateAreaId_idx" ON "TemplateSubject"("templateAreaId");

-- CreateIndex
CREATE INDEX "TemplateSubject_subjectId_idx" ON "TemplateSubject"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateSubject_templateAreaId_subjectId_key" ON "TemplateSubject"("templateAreaId", "subjectId");

-- CreateIndex
CREATE INDEX "TemplateDimension_templateId_idx" ON "TemplateDimension"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateDimension_templateId_dimensionId_key" ON "TemplateDimension"("templateId", "dimensionId");

-- CreateIndex
CREATE INDEX "GradeTemplate_templateId_idx" ON "GradeTemplate"("templateId");

-- CreateIndex
CREATE INDEX "GradeTemplate_academicYearId_idx" ON "GradeTemplate"("academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "GradeTemplate_gradeId_academicYearId_key" ON "GradeTemplate"("gradeId", "academicYearId");

-- CreateIndex
CREATE INDEX "GroupSubjectException_groupId_idx" ON "GroupSubjectException"("groupId");

-- CreateIndex
CREATE INDEX "GroupSubjectException_subjectId_idx" ON "GroupSubjectException"("subjectId");

-- CreateIndex
CREATE INDEX "GroupSubjectException_academicYearId_idx" ON "GroupSubjectException"("academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupSubjectException_groupId_subjectId_academicYearId_key" ON "GroupSubjectException"("groupId", "subjectId", "academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicYear_institutionId_year_key" ON "AcademicYear"("institutionId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicCalendar_academicYearId_key" ON "AcademicCalendar"("academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "Period_academicYearId_order_key" ON "Period"("academicYearId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicTerm_academicYearId_order_key" ON "AcademicTerm"("academicYearId", "order");

-- CreateIndex
CREATE INDEX "TermReportCardSnapshot_academicTermId_idx" ON "TermReportCardSnapshot"("academicTermId");

-- CreateIndex
CREATE INDEX "TermReportCardSnapshot_studentEnrollmentId_idx" ON "TermReportCardSnapshot"("studentEnrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "TermReportCardSnapshot_academicTermId_studentEnrollmentId_v_key" ON "TermReportCardSnapshot"("academicTermId", "studentEnrollmentId", "version");

-- CreateIndex
CREATE INDEX "TermReopeningRecord_academicTermId_idx" ON "TermReopeningRecord"("academicTermId");

-- CreateIndex
CREATE UNIQUE INDEX "GradingPeriodConfig_academicTermId_key" ON "GradingPeriodConfig"("academicTermId");

-- CreateIndex
CREATE UNIQUE INDEX "RecoveryPeriodConfig_academicTermId_key" ON "RecoveryPeriodConfig"("academicTermId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherAssignment_academicYearId_groupId_subjectId_teacherI_key" ON "TeacherAssignment"("academicYearId", "groupId", "subjectId", "teacherId", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "PerformanceScale_institutionId_level_key" ON "PerformanceScale"("institutionId", "level");

-- CreateIndex
CREATE INDEX "EvaluativeActivity_teacherAssignmentId_idx" ON "EvaluativeActivity"("teacherAssignmentId");

-- CreateIndex
CREATE INDEX "EvaluativeActivity_academicTermId_idx" ON "EvaluativeActivity"("academicTermId");

-- CreateIndex
CREATE INDEX "EvaluativeActivity_evaluationPlanId_idx" ON "EvaluativeActivity"("evaluationPlanId");

-- CreateIndex
CREATE INDEX "EvaluativeActivity_componentId_idx" ON "EvaluativeActivity"("componentId");

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationPlan_teacherAssignmentId_academicTermId_key" ON "EvaluationPlan"("teacherAssignmentId", "academicTermId");

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationComponent_institutionId_code_key" ON "EvaluationComponent"("institutionId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationPlanComponentWeight_evaluationPlanId_componentId_key" ON "EvaluationPlanComponentWeight"("evaluationPlanId", "componentId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_userId_key" ON "Student"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_institutionId_documentNumber_key" ON "Student"("institutionId", "documentNumber");

-- CreateIndex
CREATE INDEX "StudentDocument_studentId_idx" ON "StudentDocument"("studentId");

-- CreateIndex
CREATE INDEX "StudentDocument_type_idx" ON "StudentDocument"("type");

-- CreateIndex
CREATE INDEX "StudentDocument_status_idx" ON "StudentDocument"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Guardian_institutionId_documentNumber_key" ON "Guardian"("institutionId", "documentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "StudentGuardian_studentId_guardianId_key" ON "StudentGuardian"("studentId", "guardianId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentEnrollment_promotedFromId_key" ON "StudentEnrollment"("promotedFromId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentEnrollment_studentId_academicYearId_key" ON "StudentEnrollment"("studentId", "academicYearId");

-- CreateIndex
CREATE INDEX "EnrollmentArea_enrollmentId_idx" ON "EnrollmentArea"("enrollmentId");

-- CreateIndex
CREATE INDEX "EnrollmentArea_areaId_idx" ON "EnrollmentArea"("areaId");

-- CreateIndex
CREATE UNIQUE INDEX "EnrollmentArea_enrollmentId_areaId_key" ON "EnrollmentArea"("enrollmentId", "areaId");

-- CreateIndex
CREATE INDEX "EnrollmentSubject_enrollmentId_idx" ON "EnrollmentSubject"("enrollmentId");

-- CreateIndex
CREATE INDEX "EnrollmentSubject_enrollmentAreaId_idx" ON "EnrollmentSubject"("enrollmentAreaId");

-- CreateIndex
CREATE INDEX "EnrollmentSubject_subjectId_idx" ON "EnrollmentSubject"("subjectId");

-- CreateIndex
CREATE INDEX "EnrollmentSubject_teacherId_idx" ON "EnrollmentSubject"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "EnrollmentSubject_enrollmentId_subjectId_key" ON "EnrollmentSubject"("enrollmentId", "subjectId");

-- CreateIndex
CREATE INDEX "EnrollmentDimension_enrollmentId_idx" ON "EnrollmentDimension"("enrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "EnrollmentDimension_enrollmentId_dimensionId_key" ON "EnrollmentDimension"("enrollmentId", "dimensionId");

-- CreateIndex
CREATE INDEX "EnrollmentEvent_enrollmentId_idx" ON "EnrollmentEvent"("enrollmentId");

-- CreateIndex
CREATE INDEX "EnrollmentEvent_performedAt_idx" ON "EnrollmentEvent"("performedAt");

-- CreateIndex
CREATE INDEX "EnrollmentEvent_type_idx" ON "EnrollmentEvent"("type");

-- CreateIndex
CREATE UNIQUE INDEX "StudentGrade_studentEnrollmentId_evaluativeActivityId_key" ON "StudentGrade"("studentEnrollmentId", "evaluativeActivityId");

-- CreateIndex
CREATE INDEX "PeriodFinalGrade_studentEnrollmentId_academicTermId_idx" ON "PeriodFinalGrade"("studentEnrollmentId", "academicTermId");

-- CreateIndex
CREATE UNIQUE INDEX "PeriodFinalGrade_studentEnrollmentId_academicTermId_subject_key" ON "PeriodFinalGrade"("studentEnrollmentId", "academicTermId", "subjectId");

-- CreateIndex
CREATE INDEX "PartialGrade_teacherAssignmentId_academicTermId_idx" ON "PartialGrade"("teacherAssignmentId", "academicTermId");

-- CreateIndex
CREATE INDEX "PartialGrade_studentEnrollmentId_academicTermId_idx" ON "PartialGrade"("studentEnrollmentId", "academicTermId");

-- CreateIndex
CREATE UNIQUE INDEX "PartialGrade_studentEnrollmentId_teacherAssignmentId_academ_key" ON "PartialGrade"("studentEnrollmentId", "teacherAssignmentId", "academicTermId", "componentType", "activityIndex");

-- CreateIndex
CREATE UNIQUE INDEX "FinalComponent_academicYearId_order_key" ON "FinalComponent"("academicYearId", "order");

-- CreateIndex
CREATE INDEX "FinalComponentGrade_teacherAssignmentId_finalComponentId_idx" ON "FinalComponentGrade"("teacherAssignmentId", "finalComponentId");

-- CreateIndex
CREATE UNIQUE INDEX "FinalComponentGrade_studentEnrollmentId_teacherAssignmentId_key" ON "FinalComponentGrade"("studentEnrollmentId", "teacherAssignmentId", "finalComponentId");

-- CreateIndex
CREATE UNIQUE INDEX "PreventiveCutConfig_academicTermId_key" ON "PreventiveCutConfig"("academicTermId");

-- CreateIndex
CREATE INDEX "PreventiveAlert_teacherAssignmentId_idx" ON "PreventiveAlert"("teacherAssignmentId");

-- CreateIndex
CREATE INDEX "PreventiveAlert_studentEnrollmentId_idx" ON "PreventiveAlert"("studentEnrollmentId");

-- CreateIndex
CREATE INDEX "PreventiveAlert_academicTermId_idx" ON "PreventiveAlert"("academicTermId");

-- CreateIndex
CREATE UNIQUE INDEX "PreventiveAlert_teacherAssignmentId_studentEnrollmentId_aca_key" ON "PreventiveAlert"("teacherAssignmentId", "studentEnrollmentId", "academicTermId");

-- CreateIndex
CREATE INDEX "AttendanceRecord_teacherAssignmentId_idx" ON "AttendanceRecord"("teacherAssignmentId");

-- CreateIndex
CREATE INDEX "AttendanceRecord_studentEnrollmentId_idx" ON "AttendanceRecord"("studentEnrollmentId");

-- CreateIndex
CREATE INDEX "AttendanceRecord_date_idx" ON "AttendanceRecord"("date");

-- CreateIndex
CREATE INDEX "AttendanceRecord_studentEnrollmentId_date_idx" ON "AttendanceRecord"("studentEnrollmentId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_teacherAssignmentId_studentEnrollmentId_da_key" ON "AttendanceRecord"("teacherAssignmentId", "studentEnrollmentId", "date");

-- CreateIndex
CREATE INDEX "TutoringAttendance_institutionId_idx" ON "TutoringAttendance"("institutionId");

-- CreateIndex
CREATE INDEX "TutoringAttendance_groupId_date_idx" ON "TutoringAttendance"("groupId", "date");

-- CreateIndex
CREATE INDEX "TutoringAttendance_teacherId_idx" ON "TutoringAttendance"("teacherId");

-- CreateIndex
CREATE INDEX "TutoringAttendance_studentEnrollmentId_date_idx" ON "TutoringAttendance"("studentEnrollmentId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "TutoringAttendance_groupId_studentEnrollmentId_date_key" ON "TutoringAttendance"("groupId", "studentEnrollmentId", "date");

-- CreateIndex
CREATE INDEX "StudentObservation_studentEnrollmentId_idx" ON "StudentObservation"("studentEnrollmentId");

-- CreateIndex
CREATE INDEX "StudentObservation_authorId_idx" ON "StudentObservation"("authorId");

-- CreateIndex
CREATE INDEX "StudentObservation_date_idx" ON "StudentObservation"("date");

-- CreateIndex
CREATE INDEX "StudentObservation_type_idx" ON "StudentObservation"("type");

-- CreateIndex
CREATE INDEX "StudentObservation_status_idx" ON "StudentObservation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ActaRecord_observationId_key" ON "ActaRecord"("observationId");

-- CreateIndex
CREATE INDEX "ActaRecord_actaType_idx" ON "ActaRecord"("actaType");

-- CreateIndex
CREATE INDEX "ObserverCommitment_studentEnrollmentId_idx" ON "ObserverCommitment"("studentEnrollmentId");

-- CreateIndex
CREATE INDEX "ObserverCommitment_status_idx" ON "ObserverCommitment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "GuardianCitation_observationId_key" ON "GuardianCitation"("observationId");

-- CreateIndex
CREATE INDEX "GuardianCitation_studentEnrollmentId_idx" ON "GuardianCitation"("studentEnrollmentId");

-- CreateIndex
CREATE INDEX "GuardianCitation_scheduledDate_idx" ON "GuardianCitation"("scheduledDate");

-- CreateIndex
CREATE UNIQUE INDEX "ObserverReferral_observationId_key" ON "ObserverReferral"("observationId");

-- CreateIndex
CREATE INDEX "ObserverReferral_studentEnrollmentId_idx" ON "ObserverReferral"("studentEnrollmentId");

-- CreateIndex
CREATE INDEX "ObserverReferral_status_idx" ON "ObserverReferral"("status");

-- CreateIndex
CREATE INDEX "ObserverEvidence_observationId_idx" ON "ObserverEvidence"("observationId");

-- CreateIndex
CREATE INDEX "PedagogicalMeasure_studentEnrollmentId_idx" ON "PedagogicalMeasure"("studentEnrollmentId");

-- CreateIndex
CREATE INDEX "PedagogicalMeasure_status_idx" ON "PedagogicalMeasure"("status");

-- CreateIndex
CREATE INDEX "Message_institutionId_idx" ON "Message"("institutionId");

-- CreateIndex
CREATE INDEX "Message_authorId_idx" ON "Message"("authorId");

-- CreateIndex
CREATE INDEX "Message_parentId_idx" ON "Message"("parentId");

-- CreateIndex
CREATE INDEX "Message_status_idx" ON "Message"("status");

-- CreateIndex
CREATE INDEX "MessageRecipient_messageId_idx" ON "MessageRecipient"("messageId");

-- CreateIndex
CREATE INDEX "MessageRecipient_recipientId_idx" ON "MessageRecipient"("recipientId");

-- CreateIndex
CREATE INDEX "MessageAttachment_messageId_idx" ON "MessageAttachment"("messageId");

-- CreateIndex
CREATE INDEX "Announcement_institutionId_idx" ON "Announcement"("institutionId");

-- CreateIndex
CREATE INDEX "Announcement_isActive_idx" ON "Announcement"("isActive");

-- CreateIndex
CREATE INDEX "Announcement_publishedAt_idx" ON "Announcement"("publishedAt");

-- CreateIndex
CREATE INDEX "GalleryImage_institutionId_idx" ON "GalleryImage"("institutionId");

-- CreateIndex
CREATE INDEX "GalleryImage_isActive_idx" ON "GalleryImage"("isActive");

-- CreateIndex
CREATE INDEX "GalleryImage_category_idx" ON "GalleryImage"("category");

-- CreateIndex
CREATE INDEX "Event_institutionId_idx" ON "Event"("institutionId");

-- CreateIndex
CREATE INDEX "Event_eventDate_idx" ON "Event"("eventDate");

-- CreateIndex
CREATE INDEX "Event_isActive_idx" ON "Event"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "RecoveryConfig_institutionId_academicYearId_key" ON "RecoveryConfig"("institutionId", "academicYearId");

-- CreateIndex
CREATE INDEX "PeriodRecovery_studentEnrollmentId_idx" ON "PeriodRecovery"("studentEnrollmentId");

-- CreateIndex
CREATE INDEX "PeriodRecovery_academicTermId_idx" ON "PeriodRecovery"("academicTermId");

-- CreateIndex
CREATE INDEX "PeriodRecovery_status_idx" ON "PeriodRecovery"("status");

-- CreateIndex
CREATE INDEX "FinalRecoveryPlan_studentEnrollmentId_idx" ON "FinalRecoveryPlan"("studentEnrollmentId");

-- CreateIndex
CREATE INDEX "FinalRecoveryPlan_academicYearId_idx" ON "FinalRecoveryPlan"("academicYearId");

-- CreateIndex
CREATE INDEX "FinalRecoveryPlan_status_idx" ON "FinalRecoveryPlan"("status");

-- CreateIndex
CREATE INDEX "AcademicAct_institutionId_idx" ON "AcademicAct"("institutionId");

-- CreateIndex
CREATE INDEX "AcademicAct_academicYearId_idx" ON "AcademicAct"("academicYearId");

-- CreateIndex
CREATE INDEX "AcademicAct_actType_idx" ON "AcademicAct"("actType");

-- CreateIndex
CREATE UNIQUE INDEX "PerformanceLevelComplement_institutionId_level_key" ON "PerformanceLevelComplement"("institutionId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "PerformanceConfig_institutionId_key" ON "PerformanceConfig"("institutionId");

-- CreateIndex
CREATE INDEX "SubjectPerformance_teacherAssignmentId_idx" ON "SubjectPerformance"("teacherAssignmentId");

-- CreateIndex
CREATE INDEX "SubjectPerformance_academicTermId_idx" ON "SubjectPerformance"("academicTermId");

-- CreateIndex
CREATE UNIQUE INDEX "SubjectPerformance_teacherAssignmentId_academicTermId_dimen_key" ON "SubjectPerformance"("teacherAssignmentId", "academicTermId", "dimension");

-- CreateIndex
CREATE INDEX "PerformanceManualEdit_studentEnrollmentId_idx" ON "PerformanceManualEdit"("studentEnrollmentId");

-- CreateIndex
CREATE INDEX "PerformanceManualEdit_academicTermId_idx" ON "PerformanceManualEdit"("academicTermId");

-- CreateIndex
CREATE UNIQUE INDEX "AchievementConfig_institutionId_key" ON "AchievementConfig"("institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "ObservationTemplate_achievementConfigId_level_key" ON "ObservationTemplate"("achievementConfigId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "ValueJudgmentTemplate_achievementConfigId_level_key" ON "ValueJudgmentTemplate"("achievementConfigId", "level");

-- CreateIndex
CREATE INDEX "Achievement_teacherAssignmentId_idx" ON "Achievement"("teacherAssignmentId");

-- CreateIndex
CREATE INDEX "Achievement_academicTermId_idx" ON "Achievement"("academicTermId");

-- CreateIndex
CREATE INDEX "Achievement_code_idx" ON "Achievement"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_teacherAssignmentId_academicTermId_orderNumber__key" ON "Achievement"("teacherAssignmentId", "academicTermId", "orderNumber", "isPromotional");

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_code_teacherAssignmentId_key" ON "Achievement"("code", "teacherAssignmentId");

-- CreateIndex
CREATE INDEX "AttitudinalAchievement_teacherAssignmentId_idx" ON "AttitudinalAchievement"("teacherAssignmentId");

-- CreateIndex
CREATE INDEX "AttitudinalAchievement_academicTermId_idx" ON "AttitudinalAchievement"("academicTermId");

-- CreateIndex
CREATE INDEX "StudentAchievement_studentEnrollmentId_idx" ON "StudentAchievement"("studentEnrollmentId");

-- CreateIndex
CREATE INDEX "StudentAchievement_achievementId_idx" ON "StudentAchievement"("achievementId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentAchievement_studentEnrollmentId_achievementId_key" ON "StudentAchievement"("studentEnrollmentId", "achievementId");

-- CreateIndex
CREATE INDEX "AchievementBank_institutionId_idx" ON "AchievementBank"("institutionId");

-- CreateIndex
CREATE INDEX "AchievementBank_institutionId_subjectId_idx" ON "AchievementBank"("institutionId", "subjectId");

-- CreateIndex
CREATE INDEX "AchievementBank_institutionId_areaId_idx" ON "AchievementBank"("institutionId", "areaId");

-- CreateIndex
CREATE INDEX "AchievementBank_institutionId_achievementType_idx" ON "AchievementBank"("institutionId", "achievementType");

-- CreateIndex
CREATE INDEX "AchievementBank_createdById_idx" ON "AchievementBank"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_code_key" ON "Permission"("code");

-- CreateIndex
CREATE INDEX "RoleBasePermission_role_idx" ON "RoleBasePermission"("role");

-- CreateIndex
CREATE UNIQUE INDEX "RoleBasePermission_role_permissionId_key" ON "RoleBasePermission"("role", "permissionId");

-- CreateIndex
CREATE INDEX "UserExtraPermission_userId_idx" ON "UserExtraPermission"("userId");

-- CreateIndex
CREATE INDEX "UserExtraPermission_validTo_idx" ON "UserExtraPermission"("validTo");

-- CreateIndex
CREATE UNIQUE INDEX "UserExtraPermission_userId_permissionId_key" ON "UserExtraPermission"("userId", "permissionId");

-- CreateIndex
CREATE INDEX "PermissionAuditLog_institutionId_performedAt_idx" ON "PermissionAuditLog"("institutionId", "performedAt");

-- CreateIndex
CREATE INDEX "PermissionAuditLog_targetUserId_idx" ON "PermissionAuditLog"("targetUserId");

-- CreateIndex
CREATE INDEX "PermissionAuditLog_action_idx" ON "PermissionAuditLog"("action");

-- CreateIndex
CREATE INDEX "ElectionProcess_institutionId_academicYearId_idx" ON "ElectionProcess"("institutionId", "academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "Election_electionProcessId_type_gradeId_groupId_key" ON "Election"("electionProcessId", "type", "gradeId", "groupId");

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_electionId_studentId_key" ON "Candidate"("electionId", "studentId");

-- CreateIndex
CREATE INDEX "Vote_electionId_idx" ON "Vote"("electionId");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_electionId_voterId_key" ON "Vote"("electionId", "voterId");

-- CreateIndex
CREATE UNIQUE INDEX "ElectionResult_candidateId_key" ON "ElectionResult"("candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "ElectionResult_electionId_candidateId_key" ON "ElectionResult"("electionId", "candidateId");

-- CreateIndex
CREATE INDEX "ElectionAuditLog_processId_idx" ON "ElectionAuditLog"("processId");

-- CreateIndex
CREATE INDEX "ElectionAuditLog_electionId_idx" ON "ElectionAuditLog"("electionId");

-- CreateIndex
CREATE INDEX "ElectionAuditLog_action_idx" ON "ElectionAuditLog"("action");

-- CreateIndex
CREATE INDEX "ElectionAuditLog_createdAt_idx" ON "ElectionAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "PaymentConcept_institutionId_idx" ON "PaymentConcept"("institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentConcept_institutionId_name_key" ON "PaymentConcept"("institutionId", "name");

-- CreateIndex
CREATE INDEX "PaymentEvent_institutionId_idx" ON "PaymentEvent"("institutionId");

-- CreateIndex
CREATE INDEX "PaymentEvent_academicYearId_idx" ON "PaymentEvent"("academicYearId");

-- CreateIndex
CREATE INDEX "StudentPayment_studentId_idx" ON "StudentPayment"("studentId");

-- CreateIndex
CREATE INDEX "StudentPayment_eventId_idx" ON "StudentPayment"("eventId");

-- CreateIndex
CREATE INDEX "StudentPayment_status_idx" ON "StudentPayment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "StudentPayment_studentId_eventId_key" ON "StudentPayment"("studentId", "eventId");

-- CreateIndex
CREATE INDEX "PaymentTransaction_studentPaymentId_idx" ON "PaymentTransaction"("studentPaymentId");

-- CreateIndex
CREATE INDEX "InstitutionalDocument_institutionId_idx" ON "InstitutionalDocument"("institutionId");

-- CreateIndex
CREATE INDEX "InstitutionalDocument_category_idx" ON "InstitutionalDocument"("category");

-- CreateIndex
CREATE INDEX "InstitutionalDocument_isActive_idx" ON "InstitutionalDocument"("isActive");

-- CreateIndex
CREATE INDEX "ManagementLeader_institutionId_idx" ON "ManagementLeader"("institutionId");

-- CreateIndex
CREATE INDEX "ManagementLeader_userId_idx" ON "ManagementLeader"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ManagementLeader_institutionId_userId_area_key" ON "ManagementLeader"("institutionId", "userId", "area");

-- CreateIndex
CREATE INDEX "ManagementTask_institutionId_idx" ON "ManagementTask"("institutionId");

-- CreateIndex
CREATE INDEX "ManagementTask_createdById_idx" ON "ManagementTask"("createdById");

-- CreateIndex
CREATE INDEX "ManagementTask_dueDate_idx" ON "ManagementTask"("dueDate");

-- CreateIndex
CREATE INDEX "ManagementTask_priority_idx" ON "ManagementTask"("priority");

-- CreateIndex
CREATE INDEX "TaskAssignment_taskId_idx" ON "TaskAssignment"("taskId");

-- CreateIndex
CREATE INDEX "TaskAssignment_assigneeId_idx" ON "TaskAssignment"("assigneeId");

-- CreateIndex
CREATE INDEX "TaskAssignment_status_idx" ON "TaskAssignment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TaskAssignment_taskId_assigneeId_key" ON "TaskAssignment"("taskId", "assigneeId");

-- CreateIndex
CREATE UNIQUE INDEX "InstitutionStorageUsage_institutionId_key" ON "InstitutionStorageUsage"("institutionId");

-- CreateIndex
CREATE INDEX "FinancialThirdParty_institutionId_idx" ON "FinancialThirdParty"("institutionId");

-- CreateIndex
CREATE INDEX "FinancialThirdParty_type_idx" ON "FinancialThirdParty"("type");

-- CreateIndex
CREATE INDEX "FinancialThirdParty_referenceId_idx" ON "FinancialThirdParty"("referenceId");

-- CreateIndex
CREATE INDEX "FinancialThirdParty_document_idx" ON "FinancialThirdParty"("document");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialThirdParty_institutionId_type_referenceId_key" ON "FinancialThirdParty"("institutionId", "type", "referenceId");

-- CreateIndex
CREATE INDEX "FinancialCategory_institutionId_idx" ON "FinancialCategory"("institutionId");

-- CreateIndex
CREATE INDEX "FinancialCategory_type_idx" ON "FinancialCategory"("type");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialCategory_institutionId_name_key" ON "FinancialCategory"("institutionId", "name");

-- CreateIndex
CREATE INDEX "ChargeConcept_institutionId_idx" ON "ChargeConcept"("institutionId");

-- CreateIndex
CREATE INDEX "ChargeConcept_categoryId_idx" ON "ChargeConcept"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "ChargeConcept_institutionId_name_key" ON "ChargeConcept"("institutionId", "name");

-- CreateIndex
CREATE INDEX "FinancialObligation_institutionId_idx" ON "FinancialObligation"("institutionId");

-- CreateIndex
CREATE INDEX "FinancialObligation_thirdPartyId_idx" ON "FinancialObligation"("thirdPartyId");

-- CreateIndex
CREATE INDEX "FinancialObligation_conceptId_idx" ON "FinancialObligation"("conceptId");

-- CreateIndex
CREATE INDEX "FinancialObligation_status_idx" ON "FinancialObligation"("status");

-- CreateIndex
CREATE INDEX "FinancialObligation_dueDate_idx" ON "FinancialObligation"("dueDate");

-- CreateIndex
CREATE INDEX "FinancialObligation_reference_idx" ON "FinancialObligation"("reference");

-- CreateIndex
CREATE INDEX "FinancialPayment_institutionId_idx" ON "FinancialPayment"("institutionId");

-- CreateIndex
CREATE INDEX "FinancialPayment_obligationId_idx" ON "FinancialPayment"("obligationId");

-- CreateIndex
CREATE INDEX "FinancialPayment_thirdPartyId_idx" ON "FinancialPayment"("thirdPartyId");

-- CreateIndex
CREATE INDEX "FinancialPayment_paymentDate_idx" ON "FinancialPayment"("paymentDate");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialPayment_institutionId_receiptNumber_key" ON "FinancialPayment"("institutionId", "receiptNumber");

-- CreateIndex
CREATE INDEX "FinancialExpense_institutionId_idx" ON "FinancialExpense"("institutionId");

-- CreateIndex
CREATE INDEX "FinancialExpense_categoryId_idx" ON "FinancialExpense"("categoryId");

-- CreateIndex
CREATE INDEX "FinancialExpense_providerId_idx" ON "FinancialExpense"("providerId");

-- CreateIndex
CREATE INDEX "FinancialExpense_expenseDate_idx" ON "FinancialExpense"("expenseDate");

-- CreateIndex
CREATE INDEX "FinancialInvoice_institutionId_idx" ON "FinancialInvoice"("institutionId");

-- CreateIndex
CREATE INDEX "FinancialInvoice_thirdPartyId_idx" ON "FinancialInvoice"("thirdPartyId");

-- CreateIndex
CREATE INDEX "FinancialInvoice_status_idx" ON "FinancialInvoice"("status");

-- CreateIndex
CREATE INDEX "FinancialInvoice_issueDate_idx" ON "FinancialInvoice"("issueDate");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialInvoice_institutionId_invoiceNumber_key" ON "FinancialInvoice"("institutionId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "FinancialInvoiceItem_invoiceId_idx" ON "FinancialInvoiceItem"("invoiceId");

-- CreateIndex
CREATE INDEX "FinancialInvoiceItem_obligationId_idx" ON "FinancialInvoiceItem"("obligationId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialSettings_institutionId_key" ON "FinancialSettings"("institutionId");

-- CreateIndex
CREATE INDEX "CashRegisterClose_institutionId_idx" ON "CashRegisterClose"("institutionId");

-- CreateIndex
CREATE INDEX "CashRegisterClose_closeDate_idx" ON "CashRegisterClose"("closeDate");

-- CreateIndex
CREATE UNIQUE INDEX "CashRegisterClose_institutionId_closeDate_key" ON "CashRegisterClose"("institutionId", "closeDate");

-- CreateIndex
CREATE INDEX "TimeBlock_institutionId_idx" ON "TimeBlock"("institutionId");

-- CreateIndex
CREATE INDEX "TimeBlock_shiftId_idx" ON "TimeBlock"("shiftId");

-- CreateIndex
CREATE UNIQUE INDEX "TimeBlock_institutionId_shiftId_order_key" ON "TimeBlock"("institutionId", "shiftId", "order");

-- CreateIndex
CREATE INDEX "Room_institutionId_idx" ON "Room"("institutionId");

-- CreateIndex
CREATE INDEX "Room_campusId_idx" ON "Room"("campusId");

-- CreateIndex
CREATE UNIQUE INDEX "Room_institutionId_name_key" ON "Room"("institutionId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "RoomRestriction_roomId_subjectId_key" ON "RoomRestriction"("roomId", "subjectId");

-- CreateIndex
CREATE INDEX "ScheduleGradeConfig_institutionId_idx" ON "ScheduleGradeConfig"("institutionId");

-- CreateIndex
CREATE INDEX "ScheduleGradeConfig_academicYearId_idx" ON "ScheduleGradeConfig"("academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleGradeConfig_institutionId_academicYearId_gradeId_key" ON "ScheduleGradeConfig"("institutionId", "academicYearId", "gradeId");

-- CreateIndex
CREATE INDEX "TeacherAvailability_institutionId_idx" ON "TeacherAvailability"("institutionId");

-- CreateIndex
CREATE INDEX "TeacherAvailability_teacherId_idx" ON "TeacherAvailability"("teacherId");

-- CreateIndex
CREATE INDEX "TeacherAvailability_academicYearId_idx" ON "TeacherAvailability"("academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherAvailability_institutionId_academicYearId_teacherId__key" ON "TeacherAvailability"("institutionId", "academicYearId", "teacherId", "dayOfWeek", "startTime");

-- CreateIndex
CREATE INDEX "ScheduleEntry_institutionId_idx" ON "ScheduleEntry"("institutionId");

-- CreateIndex
CREATE INDEX "ScheduleEntry_academicYearId_idx" ON "ScheduleEntry"("academicYearId");

-- CreateIndex
CREATE INDEX "ScheduleEntry_groupId_idx" ON "ScheduleEntry"("groupId");

-- CreateIndex
CREATE INDEX "ScheduleEntry_timeBlockId_idx" ON "ScheduleEntry"("timeBlockId");

-- CreateIndex
CREATE INDEX "ScheduleEntry_teacherAssignmentId_idx" ON "ScheduleEntry"("teacherAssignmentId");

-- CreateIndex
CREATE INDEX "ScheduleEntry_roomId_idx" ON "ScheduleEntry"("roomId");

-- CreateIndex
CREATE INDEX "ScheduleEntry_dayOfWeek_idx" ON "ScheduleEntry"("dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleEntry_groupId_timeBlockId_dayOfWeek_key" ON "ScheduleEntry"("groupId", "timeBlockId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "ScheduleGenerationContext_institutionId_idx" ON "ScheduleGenerationContext"("institutionId");

-- CreateIndex
CREATE INDEX "ScheduleGenerationContext_academicYearId_idx" ON "ScheduleGenerationContext"("academicYearId");

-- CreateIndex
CREATE INDEX "ScheduleGenerationContext_shiftId_idx" ON "ScheduleGenerationContext"("shiftId");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleGenerationContext_institutionId_academicYearId_shif_key" ON "ScheduleGenerationContext"("institutionId", "academicYearId", "shiftId");

-- CreateIndex
CREATE UNIQUE INDEX "ReportCardConfig_institutionId_key" ON "ReportCardConfig"("institutionId");

-- CreateIndex
CREATE INDEX "ReportCardConfig_institutionId_idx" ON "ReportCardConfig"("institutionId");

-- CreateIndex
CREATE INDEX "InstitutionRoleCapability_institutionId_idx" ON "InstitutionRoleCapability"("institutionId");

-- CreateIndex
CREATE INDEX "InstitutionRoleCapability_institutionId_role_idx" ON "InstitutionRoleCapability"("institutionId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "InstitutionRoleCapability_institutionId_role_capabilityKey_key" ON "InstitutionRoleCapability"("institutionId", "role", "capabilityKey");

-- CreateIndex
CREATE INDEX "PedagogicalSupportPlan_institutionId_idx" ON "PedagogicalSupportPlan"("institutionId");

-- CreateIndex
CREATE INDEX "PedagogicalSupportPlan_studentEnrollmentId_idx" ON "PedagogicalSupportPlan"("studentEnrollmentId");

-- CreateIndex
CREATE INDEX "PedagogicalSupportPlan_academicTermId_idx" ON "PedagogicalSupportPlan"("academicTermId");

-- CreateIndex
CREATE INDEX "PedagogicalSupportPlan_status_idx" ON "PedagogicalSupportPlan"("status");

-- CreateIndex
CREATE INDEX "PedagogicalSupportPlan_supportProfileId_idx" ON "PedagogicalSupportPlan"("supportProfileId");

-- CreateIndex
CREATE INDEX "EducationalSupportProfile_institutionId_idx" ON "EducationalSupportProfile"("institutionId");

-- CreateIndex
CREATE INDEX "EducationalSupportProfile_studentId_idx" ON "EducationalSupportProfile"("studentId");

-- CreateIndex
CREATE INDEX "EducationalSupportProfile_active_idx" ON "EducationalSupportProfile"("active");

-- CreateIndex
CREATE UNIQUE INDEX "EducationalSupportProfile_institutionId_studentId_key" ON "EducationalSupportProfile"("institutionId", "studentId");

-- CreateIndex
CREATE INDEX "SupportActivity_supportPlanId_idx" ON "SupportActivity"("supportPlanId");

-- CreateIndex
CREATE INDEX "SupportActivity_completionStatus_idx" ON "SupportActivity"("completionStatus");

-- CreateIndex
CREATE INDEX "SupportProgressLog_supportPlanId_idx" ON "SupportProgressLog"("supportPlanId");

-- CreateIndex
CREATE INDEX "SupportProgressLog_createdById_idx" ON "SupportProgressLog"("createdById");

-- CreateIndex
CREATE INDEX "ApdAuditLog_institutionId_idx" ON "ApdAuditLog"("institutionId");

-- CreateIndex
CREATE INDEX "ApdAuditLog_userId_idx" ON "ApdAuditLog"("userId");

-- CreateIndex
CREATE INDEX "ApdAuditLog_entityType_entityId_idx" ON "ApdAuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ApdAuditLog_createdAt_idx" ON "ApdAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "WorkspaceBoard_teacherId_institutionId_idx" ON "WorkspaceBoard"("teacherId", "institutionId");

-- CreateIndex
CREATE INDEX "WorkspaceBoard_teacherId_type_idx" ON "WorkspaceBoard"("teacherId", "type");

-- CreateIndex
CREATE INDEX "WorkspaceBoard_institutionId_visibility_idx" ON "WorkspaceBoard"("institutionId", "visibility");

-- CreateIndex
CREATE INDEX "WorkspaceBoard_gradeId_idx" ON "WorkspaceBoard"("gradeId");

-- CreateIndex
CREATE INDEX "WorkspaceBoard_startDate_endDate_idx" ON "WorkspaceBoard"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "WorkspaceColumn_boardId_idx" ON "WorkspaceColumn"("boardId");

-- CreateIndex
CREATE INDEX "WorkspaceItem_boardId_columnId_idx" ON "WorkspaceItem"("boardId", "columnId");

-- CreateIndex
CREATE INDEX "WorkspaceItem_boardId_status_idx" ON "WorkspaceItem"("boardId", "status");

-- CreateIndex
CREATE INDEX "WorkspaceItem_boardId_studentId_idx" ON "WorkspaceItem"("boardId", "studentId");

-- CreateIndex
CREATE INDEX "WorkspaceItem_dueDate_idx" ON "WorkspaceItem"("dueDate");

-- CreateIndex
CREATE INDEX "WorkspaceItem_eventDate_idx" ON "WorkspaceItem"("eventDate");

-- CreateIndex
CREATE UNIQUE INDEX "Classroom_teacherAssignmentId_key" ON "Classroom"("teacherAssignmentId");

-- CreateIndex
CREATE INDEX "Classroom_institutionId_idx" ON "Classroom"("institutionId");

-- CreateIndex
CREATE INDEX "Classroom_teacherAssignmentId_idx" ON "Classroom"("teacherAssignmentId");

-- CreateIndex
CREATE INDEX "ClassroomSection_classroomId_idx" ON "ClassroomSection"("classroomId");

-- CreateIndex
CREATE INDEX "ClassroomMaterial_sectionId_idx" ON "ClassroomMaterial"("sectionId");

-- CreateIndex
CREATE INDEX "ClassroomAnnouncement_classroomId_idx" ON "ClassroomAnnouncement"("classroomId");

-- CreateIndex
CREATE INDEX "ClassroomActivity_classroomId_idx" ON "ClassroomActivity"("classroomId");

-- CreateIndex
CREATE INDEX "ClassroomActivity_sectionId_idx" ON "ClassroomActivity"("sectionId");

-- CreateIndex
CREATE INDEX "ClassroomActivity_dueDate_idx" ON "ClassroomActivity"("dueDate");

-- CreateIndex
CREATE INDEX "ActivityQuestion_activityId_idx" ON "ActivityQuestion"("activityId");

-- CreateIndex
CREATE INDEX "ActivitySubmission_activityId_idx" ON "ActivitySubmission"("activityId");

-- CreateIndex
CREATE INDEX "ActivitySubmission_studentEnrollmentId_idx" ON "ActivitySubmission"("studentEnrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "ActivitySubmission_activityId_studentEnrollmentId_attemptNu_key" ON "ActivitySubmission"("activityId", "studentEnrollmentId", "attemptNumber");

-- CreateIndex
CREATE INDEX "QuestionAnswer_submissionId_idx" ON "QuestionAnswer"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionAnswer_submissionId_questionId_key" ON "QuestionAnswer"("submissionId", "questionId");

-- CreateIndex
CREATE INDEX "ForumPost_classroomId_idx" ON "ForumPost"("classroomId");

-- CreateIndex
CREATE INDEX "ForumPost_activityId_idx" ON "ForumPost"("activityId");

-- CreateIndex
CREATE INDEX "ForumPost_authorId_idx" ON "ForumPost"("authorId");

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Institution" ADD CONSTRAINT "Institution_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionModule" ADD CONSTRAINT "InstitutionModule_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionUser" ADD CONSTRAINT "InstitutionUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionUser" ADD CONSTRAINT "InstitutionUser_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campus" ADD CONSTRAINT "Campus_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_directorId_fkey" FOREIGN KEY ("directorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_companionId_fkey" FOREIGN KEY ("companionId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Area" ADD CONSTRAINT "Area_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicTemplate" ADD CONSTRAINT "AcademicTemplate_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicTemplate" ADD CONSTRAINT "AcademicTemplate_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateArea" ADD CONSTRAINT "TemplateArea_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "AcademicTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateArea" ADD CONSTRAINT "TemplateArea_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateSubject" ADD CONSTRAINT "TemplateSubject_templateAreaId_fkey" FOREIGN KEY ("templateAreaId") REFERENCES "TemplateArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateSubject" ADD CONSTRAINT "TemplateSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateDimension" ADD CONSTRAINT "TemplateDimension_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "AcademicTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateDimension" ADD CONSTRAINT "TemplateDimension_dimensionId_fkey" FOREIGN KEY ("dimensionId") REFERENCES "Dimension"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeTemplate" ADD CONSTRAINT "GradeTemplate_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeTemplate" ADD CONSTRAINT "GradeTemplate_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "AcademicTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeTemplate" ADD CONSTRAINT "GradeTemplate_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupSubjectException" ADD CONSTRAINT "GroupSubjectException_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupSubjectException" ADD CONSTRAINT "GroupSubjectException_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupSubjectException" ADD CONSTRAINT "GroupSubjectException_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicYear" ADD CONSTRAINT "AcademicYear_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicYear" ADD CONSTRAINT "AcademicYear_activatedById_fkey" FOREIGN KEY ("activatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicYear" ADD CONSTRAINT "AcademicYear_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicCalendar" ADD CONSTRAINT "AcademicCalendar_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Period" ADD CONSTRAINT "Period_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicTerm" ADD CONSTRAINT "AcademicTerm_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermReportCardSnapshot" ADD CONSTRAINT "TermReportCardSnapshot_academicTermId_fkey" FOREIGN KEY ("academicTermId") REFERENCES "AcademicTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermReportCardSnapshot" ADD CONSTRAINT "TermReportCardSnapshot_studentEnrollmentId_fkey" FOREIGN KEY ("studentEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermReportCardSnapshot" ADD CONSTRAINT "TermReportCardSnapshot_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermReopeningRecord" ADD CONSTRAINT "TermReopeningRecord_academicTermId_fkey" FOREIGN KEY ("academicTermId") REFERENCES "AcademicTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermReopeningRecord" ADD CONSTRAINT "TermReopeningRecord_reopenedById_fkey" FOREIGN KEY ("reopenedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradingPeriodConfig" ADD CONSTRAINT "GradingPeriodConfig_academicTermId_fkey" FOREIGN KEY ("academicTermId") REFERENCES "AcademicTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryPeriodConfig" ADD CONSTRAINT "RecoveryPeriodConfig_academicTermId_fkey" FOREIGN KEY ("academicTermId") REFERENCES "AcademicTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAssignment" ADD CONSTRAINT "TeacherAssignment_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAssignment" ADD CONSTRAINT "TeacherAssignment_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAssignment" ADD CONSTRAINT "TeacherAssignment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAssignment" ADD CONSTRAINT "TeacherAssignment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAssignment" ADD CONSTRAINT "TeacherAssignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceScale" ADD CONSTRAINT "PerformanceScale_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluativeActivity" ADD CONSTRAINT "EvaluativeActivity_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluativeActivity" ADD CONSTRAINT "EvaluativeActivity_teacherAssignmentId_fkey" FOREIGN KEY ("teacherAssignmentId") REFERENCES "TeacherAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluativeActivity" ADD CONSTRAINT "EvaluativeActivity_academicTermId_fkey" FOREIGN KEY ("academicTermId") REFERENCES "AcademicTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluativeActivity" ADD CONSTRAINT "EvaluativeActivity_evaluationPlanId_fkey" FOREIGN KEY ("evaluationPlanId") REFERENCES "EvaluationPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluativeActivity" ADD CONSTRAINT "EvaluativeActivity_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "EvaluationComponent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationPlan" ADD CONSTRAINT "EvaluationPlan_teacherAssignmentId_fkey" FOREIGN KEY ("teacherAssignmentId") REFERENCES "TeacherAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationPlan" ADD CONSTRAINT "EvaluationPlan_academicTermId_fkey" FOREIGN KEY ("academicTermId") REFERENCES "AcademicTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationComponent" ADD CONSTRAINT "EvaluationComponent_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationComponent" ADD CONSTRAINT "EvaluationComponent_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "EvaluationComponent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationPlanComponentWeight" ADD CONSTRAINT "EvaluationPlanComponentWeight_evaluationPlanId_fkey" FOREIGN KEY ("evaluationPlanId") REFERENCES "EvaluationPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationPlanComponentWeight" ADD CONSTRAINT "EvaluationPlanComponentWeight_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "EvaluationComponent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDocument" ADD CONSTRAINT "StudentDocument_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDocument" ADD CONSTRAINT "StudentDocument_validatedById_fkey" FOREIGN KEY ("validatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guardian" ADD CONSTRAINT "Guardian_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGuardian" ADD CONSTRAINT "StudentGuardian_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGuardian" ADD CONSTRAINT "StudentGuardian_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_enrolledById_fkey" FOREIGN KEY ("enrolledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_promotedFromId_fkey" FOREIGN KEY ("promotedFromId") REFERENCES "StudentEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentArea" ADD CONSTRAINT "EnrollmentArea_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentArea" ADD CONSTRAINT "EnrollmentArea_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentArea" ADD CONSTRAINT "EnrollmentArea_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentSubject" ADD CONSTRAINT "EnrollmentSubject_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentSubject" ADD CONSTRAINT "EnrollmentSubject_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentSubject" ADD CONSTRAINT "EnrollmentSubject_enrollmentAreaId_fkey" FOREIGN KEY ("enrollmentAreaId") REFERENCES "EnrollmentArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentSubject" ADD CONSTRAINT "EnrollmentSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentSubject" ADD CONSTRAINT "EnrollmentSubject_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentDimension" ADD CONSTRAINT "EnrollmentDimension_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentDimension" ADD CONSTRAINT "EnrollmentDimension_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentDimension" ADD CONSTRAINT "EnrollmentDimension_dimensionId_fkey" FOREIGN KEY ("dimensionId") REFERENCES "Dimension"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentEvent" ADD CONSTRAINT "EnrollmentEvent_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentEvent" ADD CONSTRAINT "EnrollmentEvent_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentEvent" ADD CONSTRAINT "EnrollmentEvent_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentEvent" ADD CONSTRAINT "EnrollmentEvent_academicActId_fkey" FOREIGN KEY ("academicActId") REFERENCES "AcademicAct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGrade" ADD CONSTRAINT "StudentGrade_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGrade" ADD CONSTRAINT "StudentGrade_studentEnrollmentId_fkey" FOREIGN KEY ("studentEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGrade" ADD CONSTRAINT "StudentGrade_evaluativeActivityId_fkey" FOREIGN KEY ("evaluativeActivityId") REFERENCES "EvaluativeActivity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodFinalGrade" ADD CONSTRAINT "PeriodFinalGrade_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodFinalGrade" ADD CONSTRAINT "PeriodFinalGrade_studentEnrollmentId_fkey" FOREIGN KEY ("studentEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodFinalGrade" ADD CONSTRAINT "PeriodFinalGrade_academicTermId_fkey" FOREIGN KEY ("academicTermId") REFERENCES "AcademicTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodFinalGrade" ADD CONSTRAINT "PeriodFinalGrade_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodFinalGrade" ADD CONSTRAINT "PeriodFinalGrade_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartialGrade" ADD CONSTRAINT "PartialGrade_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartialGrade" ADD CONSTRAINT "PartialGrade_studentEnrollmentId_fkey" FOREIGN KEY ("studentEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartialGrade" ADD CONSTRAINT "PartialGrade_teacherAssignmentId_fkey" FOREIGN KEY ("teacherAssignmentId") REFERENCES "TeacherAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartialGrade" ADD CONSTRAINT "PartialGrade_academicTermId_fkey" FOREIGN KEY ("academicTermId") REFERENCES "AcademicTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalComponent" ADD CONSTRAINT "FinalComponent_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalComponent" ADD CONSTRAINT "FinalComponent_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalComponentGrade" ADD CONSTRAINT "FinalComponentGrade_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalComponentGrade" ADD CONSTRAINT "FinalComponentGrade_studentEnrollmentId_fkey" FOREIGN KEY ("studentEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalComponentGrade" ADD CONSTRAINT "FinalComponentGrade_teacherAssignmentId_fkey" FOREIGN KEY ("teacherAssignmentId") REFERENCES "TeacherAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalComponentGrade" ADD CONSTRAINT "FinalComponentGrade_finalComponentId_fkey" FOREIGN KEY ("finalComponentId") REFERENCES "FinalComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreventiveCutConfig" ADD CONSTRAINT "PreventiveCutConfig_academicTermId_fkey" FOREIGN KEY ("academicTermId") REFERENCES "AcademicTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreventiveAlert" ADD CONSTRAINT "PreventiveAlert_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreventiveAlert" ADD CONSTRAINT "PreventiveAlert_teacherAssignmentId_fkey" FOREIGN KEY ("teacherAssignmentId") REFERENCES "TeacherAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreventiveAlert" ADD CONSTRAINT "PreventiveAlert_studentEnrollmentId_fkey" FOREIGN KEY ("studentEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreventiveAlert" ADD CONSTRAINT "PreventiveAlert_academicTermId_fkey" FOREIGN KEY ("academicTermId") REFERENCES "AcademicTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_teacherAssignmentId_fkey" FOREIGN KEY ("teacherAssignmentId") REFERENCES "TeacherAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_studentEnrollmentId_fkey" FOREIGN KEY ("studentEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutoringAttendance" ADD CONSTRAINT "TutoringAttendance_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutoringAttendance" ADD CONSTRAINT "TutoringAttendance_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutoringAttendance" ADD CONSTRAINT "TutoringAttendance_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutoringAttendance" ADD CONSTRAINT "TutoringAttendance_studentEnrollmentId_fkey" FOREIGN KEY ("studentEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentObservation" ADD CONSTRAINT "StudentObservation_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentObservation" ADD CONSTRAINT "StudentObservation_studentEnrollmentId_fkey" FOREIGN KEY ("studentEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentObservation" ADD CONSTRAINT "StudentObservation_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActaRecord" ADD CONSTRAINT "ActaRecord_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "StudentObservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObserverCommitment" ADD CONSTRAINT "ObserverCommitment_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObserverCommitment" ADD CONSTRAINT "ObserverCommitment_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "StudentObservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObserverCommitment" ADD CONSTRAINT "ObserverCommitment_studentEnrollmentId_fkey" FOREIGN KEY ("studentEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObserverCommitment" ADD CONSTRAINT "ObserverCommitment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObserverCommitment" ADD CONSTRAINT "ObserverCommitment_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianCitation" ADD CONSTRAINT "GuardianCitation_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianCitation" ADD CONSTRAINT "GuardianCitation_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "StudentObservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianCitation" ADD CONSTRAINT "GuardianCitation_studentEnrollmentId_fkey" FOREIGN KEY ("studentEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianCitation" ADD CONSTRAINT "GuardianCitation_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObserverReferral" ADD CONSTRAINT "ObserverReferral_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObserverReferral" ADD CONSTRAINT "ObserverReferral_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "StudentObservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObserverReferral" ADD CONSTRAINT "ObserverReferral_studentEnrollmentId_fkey" FOREIGN KEY ("studentEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObserverReferral" ADD CONSTRAINT "ObserverReferral_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObserverReferral" ADD CONSTRAINT "ObserverReferral_referredToUserId_fkey" FOREIGN KEY ("referredToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObserverReferral" ADD CONSTRAINT "ObserverReferral_respondedById_fkey" FOREIGN KEY ("respondedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObserverEvidence" ADD CONSTRAINT "ObserverEvidence_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "StudentObservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObserverEvidence" ADD CONSTRAINT "ObserverEvidence_actaRecordId_fkey" FOREIGN KEY ("actaRecordId") REFERENCES "ActaRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObserverEvidence" ADD CONSTRAINT "ObserverEvidence_citationId_fkey" FOREIGN KEY ("citationId") REFERENCES "GuardianCitation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObserverEvidence" ADD CONSTRAINT "ObserverEvidence_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedagogicalMeasure" ADD CONSTRAINT "PedagogicalMeasure_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedagogicalMeasure" ADD CONSTRAINT "PedagogicalMeasure_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "StudentObservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedagogicalMeasure" ADD CONSTRAINT "PedagogicalMeasure_studentEnrollmentId_fkey" FOREIGN KEY ("studentEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedagogicalMeasure" ADD CONSTRAINT "PedagogicalMeasure_appliedById_fkey" FOREIGN KEY ("appliedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageRecipient" ADD CONSTRAINT "MessageRecipient_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageAttachment" ADD CONSTRAINT "MessageAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GalleryImage" ADD CONSTRAINT "GalleryImage_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GalleryImage" ADD CONSTRAINT "GalleryImage_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryConfig" ADD CONSTRAINT "RecoveryConfig_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryConfig" ADD CONSTRAINT "RecoveryConfig_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodRecovery" ADD CONSTRAINT "PeriodRecovery_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodRecovery" ADD CONSTRAINT "PeriodRecovery_studentEnrollmentId_fkey" FOREIGN KEY ("studentEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodRecovery" ADD CONSTRAINT "PeriodRecovery_academicTermId_fkey" FOREIGN KEY ("academicTermId") REFERENCES "AcademicTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodRecovery" ADD CONSTRAINT "PeriodRecovery_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodRecovery" ADD CONSTRAINT "PeriodRecovery_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodRecovery" ADD CONSTRAINT "PeriodRecovery_evaluatedById_fkey" FOREIGN KEY ("evaluatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalRecoveryPlan" ADD CONSTRAINT "FinalRecoveryPlan_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalRecoveryPlan" ADD CONSTRAINT "FinalRecoveryPlan_studentEnrollmentId_fkey" FOREIGN KEY ("studentEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalRecoveryPlan" ADD CONSTRAINT "FinalRecoveryPlan_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalRecoveryPlan" ADD CONSTRAINT "FinalRecoveryPlan_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalRecoveryPlan" ADD CONSTRAINT "FinalRecoveryPlan_responsibleTeacherId_fkey" FOREIGN KEY ("responsibleTeacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalRecoveryPlan" ADD CONSTRAINT "FinalRecoveryPlan_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalRecoveryPlan" ADD CONSTRAINT "FinalRecoveryPlan_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicAct" ADD CONSTRAINT "AcademicAct_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicAct" ADD CONSTRAINT "AcademicAct_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicAct" ADD CONSTRAINT "AcademicAct_studentEnrollmentId_fkey" FOREIGN KEY ("studentEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicAct" ADD CONSTRAINT "AcademicAct_finalRecoveryPlanId_fkey" FOREIGN KEY ("finalRecoveryPlanId") REFERENCES "FinalRecoveryPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicAct" ADD CONSTRAINT "AcademicAct_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicAct" ADD CONSTRAINT "AcademicAct_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceLevelComplement" ADD CONSTRAINT "PerformanceLevelComplement_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceConfig" ADD CONSTRAINT "PerformanceConfig_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectPerformance" ADD CONSTRAINT "SubjectPerformance_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectPerformance" ADD CONSTRAINT "SubjectPerformance_teacherAssignmentId_fkey" FOREIGN KEY ("teacherAssignmentId") REFERENCES "TeacherAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectPerformance" ADD CONSTRAINT "SubjectPerformance_academicTermId_fkey" FOREIGN KEY ("academicTermId") REFERENCES "AcademicTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceManualEdit" ADD CONSTRAINT "PerformanceManualEdit_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceManualEdit" ADD CONSTRAINT "PerformanceManualEdit_studentEnrollmentId_fkey" FOREIGN KEY ("studentEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceManualEdit" ADD CONSTRAINT "PerformanceManualEdit_academicTermId_fkey" FOREIGN KEY ("academicTermId") REFERENCES "AcademicTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceManualEdit" ADD CONSTRAINT "PerformanceManualEdit_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceManualEdit" ADD CONSTRAINT "PerformanceManualEdit_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AchievementConfig" ADD CONSTRAINT "AchievementConfig_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObservationTemplate" ADD CONSTRAINT "ObservationTemplate_achievementConfigId_fkey" FOREIGN KEY ("achievementConfigId") REFERENCES "AchievementConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValueJudgmentTemplate" ADD CONSTRAINT "ValueJudgmentTemplate_achievementConfigId_fkey" FOREIGN KEY ("achievementConfigId") REFERENCES "AchievementConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_teacherAssignmentId_fkey" FOREIGN KEY ("teacherAssignmentId") REFERENCES "TeacherAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_academicTermId_fkey" FOREIGN KEY ("academicTermId") REFERENCES "AcademicTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttitudinalAchievement" ADD CONSTRAINT "AttitudinalAchievement_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttitudinalAchievement" ADD CONSTRAINT "AttitudinalAchievement_teacherAssignmentId_fkey" FOREIGN KEY ("teacherAssignmentId") REFERENCES "TeacherAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttitudinalAchievement" ADD CONSTRAINT "AttitudinalAchievement_academicTermId_fkey" FOREIGN KEY ("academicTermId") REFERENCES "AcademicTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttitudinalAchievement" ADD CONSTRAINT "AttitudinalAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAchievement" ADD CONSTRAINT "StudentAchievement_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAchievement" ADD CONSTRAINT "StudentAchievement_studentEnrollmentId_fkey" FOREIGN KEY ("studentEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAchievement" ADD CONSTRAINT "StudentAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAchievement" ADD CONSTRAINT "StudentAchievement_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AchievementBank" ADD CONSTRAINT "AchievementBank_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AchievementBank" ADD CONSTRAINT "AchievementBank_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AchievementBank" ADD CONSTRAINT "AchievementBank_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AchievementBank" ADD CONSTRAINT "AchievementBank_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AchievementBank" ADD CONSTRAINT "AchievementBank_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleBasePermission" ADD CONSTRAINT "RoleBasePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserExtraPermission" ADD CONSTRAINT "UserExtraPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserExtraPermission" ADD CONSTRAINT "UserExtraPermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserExtraPermission" ADD CONSTRAINT "UserExtraPermission_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserExtraPermission" ADD CONSTRAINT "UserExtraPermission_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionAuditLog" ADD CONSTRAINT "PermissionAuditLog_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionAuditLog" ADD CONSTRAINT "PermissionAuditLog_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionAuditLog" ADD CONSTRAINT "PermissionAuditLog_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionAuditLog" ADD CONSTRAINT "PermissionAuditLog_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectionProcess" ADD CONSTRAINT "ElectionProcess_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectionProcess" ADD CONSTRAINT "ElectionProcess_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectionProcess" ADD CONSTRAINT "ElectionProcess_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectionProcess" ADD CONSTRAINT "ElectionProcess_lockedById_fkey" FOREIGN KEY ("lockedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectionProcess" ADD CONSTRAINT "ElectionProcess_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Election" ADD CONSTRAINT "Election_electionProcessId_fkey" FOREIGN KEY ("electionProcessId") REFERENCES "ElectionProcess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Election" ADD CONSTRAINT "Election_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Election" ADD CONSTRAINT "Election_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectionResult" ADD CONSTRAINT "ElectionResult_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectionResult" ADD CONSTRAINT "ElectionResult_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectionAuditLog" ADD CONSTRAINT "ElectionAuditLog_processId_fkey" FOREIGN KEY ("processId") REFERENCES "ElectionProcess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentConcept" ADD CONSTRAINT "PaymentConcept_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "PaymentConcept"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPayment" ADD CONSTRAINT "StudentPayment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPayment" ADD CONSTRAINT "StudentPayment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "PaymentEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_studentPaymentId_fkey" FOREIGN KEY ("studentPaymentId") REFERENCES "StudentPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionalDocument" ADD CONSTRAINT "InstitutionalDocument_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionalDocument" ADD CONSTRAINT "InstitutionalDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagementLeader" ADD CONSTRAINT "ManagementLeader_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagementLeader" ADD CONSTRAINT "ManagementLeader_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagementLeader" ADD CONSTRAINT "ManagementLeader_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagementTask" ADD CONSTRAINT "ManagementTask_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagementTask" ADD CONSTRAINT "ManagementTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagementTask" ADD CONSTRAINT "ManagementTask_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "ManagementLeader"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssignment" ADD CONSTRAINT "TaskAssignment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ManagementTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssignment" ADD CONSTRAINT "TaskAssignment_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssignment" ADD CONSTRAINT "TaskAssignment_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionStorageUsage" ADD CONSTRAINT "InstitutionStorageUsage_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialThirdParty" ADD CONSTRAINT "FinancialThirdParty_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialCategory" ADD CONSTRAINT "FinancialCategory_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeConcept" ADD CONSTRAINT "ChargeConcept_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeConcept" ADD CONSTRAINT "ChargeConcept_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinancialCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialObligation" ADD CONSTRAINT "FinancialObligation_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialObligation" ADD CONSTRAINT "FinancialObligation_thirdPartyId_fkey" FOREIGN KEY ("thirdPartyId") REFERENCES "FinancialThirdParty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialObligation" ADD CONSTRAINT "FinancialObligation_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "ChargeConcept"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialPayment" ADD CONSTRAINT "FinancialPayment_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialPayment" ADD CONSTRAINT "FinancialPayment_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "FinancialObligation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialPayment" ADD CONSTRAINT "FinancialPayment_thirdPartyId_fkey" FOREIGN KEY ("thirdPartyId") REFERENCES "FinancialThirdParty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialPayment" ADD CONSTRAINT "FinancialPayment_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialPayment" ADD CONSTRAINT "FinancialPayment_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialExpense" ADD CONSTRAINT "FinancialExpense_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialExpense" ADD CONSTRAINT "FinancialExpense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinancialCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialExpense" ADD CONSTRAINT "FinancialExpense_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "FinancialThirdParty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialExpense" ADD CONSTRAINT "FinancialExpense_registeredById_fkey" FOREIGN KEY ("registeredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialExpense" ADD CONSTRAINT "FinancialExpense_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialExpense" ADD CONSTRAINT "FinancialExpense_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialInvoice" ADD CONSTRAINT "FinancialInvoice_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialInvoice" ADD CONSTRAINT "FinancialInvoice_thirdPartyId_fkey" FOREIGN KEY ("thirdPartyId") REFERENCES "FinancialThirdParty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialInvoice" ADD CONSTRAINT "FinancialInvoice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialInvoice" ADD CONSTRAINT "FinancialInvoice_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialInvoiceItem" ADD CONSTRAINT "FinancialInvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "FinancialInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialInvoiceItem" ADD CONSTRAINT "FinancialInvoiceItem_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "FinancialObligation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialSettings" ADD CONSTRAINT "FinancialSettings_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashRegisterClose" ADD CONSTRAINT "CashRegisterClose_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashRegisterClose" ADD CONSTRAINT "CashRegisterClose_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeBlock" ADD CONSTRAINT "TimeBlock_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeBlock" ADD CONSTRAINT "TimeBlock_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomRestriction" ADD CONSTRAINT "RoomRestriction_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomRestriction" ADD CONSTRAINT "RoomRestriction_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomRestriction" ADD CONSTRAINT "RoomRestriction_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleGradeConfig" ADD CONSTRAINT "ScheduleGradeConfig_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleGradeConfig" ADD CONSTRAINT "ScheduleGradeConfig_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleGradeConfig" ADD CONSTRAINT "ScheduleGradeConfig_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAvailability" ADD CONSTRAINT "TeacherAvailability_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAvailability" ADD CONSTRAINT "TeacherAvailability_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAvailability" ADD CONSTRAINT "TeacherAvailability_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleEntry" ADD CONSTRAINT "ScheduleEntry_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleEntry" ADD CONSTRAINT "ScheduleEntry_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleEntry" ADD CONSTRAINT "ScheduleEntry_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleEntry" ADD CONSTRAINT "ScheduleEntry_timeBlockId_fkey" FOREIGN KEY ("timeBlockId") REFERENCES "TimeBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleEntry" ADD CONSTRAINT "ScheduleEntry_teacherAssignmentId_fkey" FOREIGN KEY ("teacherAssignmentId") REFERENCES "TeacherAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleEntry" ADD CONSTRAINT "ScheduleEntry_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleGenerationContext" ADD CONSTRAINT "ScheduleGenerationContext_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleGenerationContext" ADD CONSTRAINT "ScheduleGenerationContext_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleGenerationContext" ADD CONSTRAINT "ScheduleGenerationContext_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCardConfig" ADD CONSTRAINT "ReportCardConfig_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionRoleCapability" ADD CONSTRAINT "InstitutionRoleCapability_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedagogicalSupportPlan" ADD CONSTRAINT "PedagogicalSupportPlan_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedagogicalSupportPlan" ADD CONSTRAINT "PedagogicalSupportPlan_studentEnrollmentId_fkey" FOREIGN KEY ("studentEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedagogicalSupportPlan" ADD CONSTRAINT "PedagogicalSupportPlan_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedagogicalSupportPlan" ADD CONSTRAINT "PedagogicalSupportPlan_academicTermId_fkey" FOREIGN KEY ("academicTermId") REFERENCES "AcademicTerm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedagogicalSupportPlan" ADD CONSTRAINT "PedagogicalSupportPlan_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedagogicalSupportPlan" ADD CONSTRAINT "PedagogicalSupportPlan_supportProfileId_fkey" FOREIGN KEY ("supportProfileId") REFERENCES "EducationalSupportProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EducationalSupportProfile" ADD CONSTRAINT "EducationalSupportProfile_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EducationalSupportProfile" ADD CONSTRAINT "EducationalSupportProfile_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportActivity" ADD CONSTRAINT "SupportActivity_supportPlanId_fkey" FOREIGN KEY ("supportPlanId") REFERENCES "PedagogicalSupportPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportProgressLog" ADD CONSTRAINT "SupportProgressLog_supportPlanId_fkey" FOREIGN KEY ("supportPlanId") REFERENCES "PedagogicalSupportPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportProgressLog" ADD CONSTRAINT "SupportProgressLog_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApdAuditLog" ADD CONSTRAINT "ApdAuditLog_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApdAuditLog" ADD CONSTRAINT "ApdAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceBoard" ADD CONSTRAINT "WorkspaceBoard_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceBoard" ADD CONSTRAINT "WorkspaceBoard_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceBoard" ADD CONSTRAINT "WorkspaceBoard_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceBoard" ADD CONSTRAINT "WorkspaceBoard_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceBoard" ADD CONSTRAINT "WorkspaceBoard_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceColumn" ADD CONSTRAINT "WorkspaceColumn_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "WorkspaceBoard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceItem" ADD CONSTRAINT "WorkspaceItem_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "WorkspaceBoard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceItem" ADD CONSTRAINT "WorkspaceItem_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "WorkspaceColumn"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceItem" ADD CONSTRAINT "WorkspaceItem_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Classroom" ADD CONSTRAINT "Classroom_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Classroom" ADD CONSTRAINT "Classroom_teacherAssignmentId_fkey" FOREIGN KEY ("teacherAssignmentId") REFERENCES "TeacherAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassroomSection" ADD CONSTRAINT "ClassroomSection_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassroomMaterial" ADD CONSTRAINT "ClassroomMaterial_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "ClassroomSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassroomAnnouncement" ADD CONSTRAINT "ClassroomAnnouncement_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassroomAnnouncement" ADD CONSTRAINT "ClassroomAnnouncement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassroomActivity" ADD CONSTRAINT "ClassroomActivity_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "ClassroomSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassroomActivity" ADD CONSTRAINT "ClassroomActivity_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityQuestion" ADD CONSTRAINT "ActivityQuestion_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "ClassroomActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivitySubmission" ADD CONSTRAINT "ActivitySubmission_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "ClassroomActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivitySubmission" ADD CONSTRAINT "ActivitySubmission_studentEnrollmentId_fkey" FOREIGN KEY ("studentEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivitySubmission" ADD CONSTRAINT "ActivitySubmission_gradedById_fkey" FOREIGN KEY ("gradedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionAnswer" ADD CONSTRAINT "QuestionAnswer_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "ActivitySubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionAnswer" ADD CONSTRAINT "QuestionAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ActivityQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumPost" ADD CONSTRAINT "ForumPost_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumPost" ADD CONSTRAINT "ForumPost_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "ClassroomActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumPost" ADD CONSTRAINT "ForumPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumPost" ADD CONSTRAINT "ForumPost_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ForumPost"("id") ON DELETE SET NULL ON UPDATE CASCADE;

