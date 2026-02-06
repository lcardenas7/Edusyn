/**
 * DTOs de dominio para comunicación entre módulos.
 * Estos DTOs garantizan el desacoplamiento real entre dominios.
 * 
 * IMPORTANTE: Ningún módulo externo debe recibir modelos Prisma crudos.
 * Siempre usar estos DTOs para la comunicación inter-módulos.
 */

// ═══════════════════════════════════════════════════════════════════════════
// DTOs PARA ESTUDIANTES Y MATRÍCULAS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Información básica de un estudiante para reportes.
 */
export interface StudentForReport {
  id: string;
  firstName: string;
  lastName: string;
  documentType: string;
  documentNumber: string;
  birthDate: Date | null;
  gender: string | null;
}

/**
 * Información de grupo para reportes.
 */
export interface GroupForReport {
  id: string;
  name: string;
  gradeName: string;
  gradeId: string;
  campusName: string | null;
  campusId: string | null;
}

/**
 * Información de año académico para reportes.
 */
export interface AcademicYearForReport {
  id: string;
  year: number;
  name: string | null;
  institutionId: string;
  institutionName: string;
  institutionNit: string | null;
}

/**
 * Matrícula completa para reportes (boletines, certificados).
 */
export interface EnrollmentForReport {
  id: string;
  status: string;
  enrollmentType: string;
  student: StudentForReport;
  group: GroupForReport;
  academicYear: AcademicYearForReport;
}

/**
 * Matrícula simplificada para listados de grupo.
 */
export interface EnrollmentForGroupList {
  id: string;
  studentId: string;
  studentName: string;
  studentFirstName: string;
  studentLastName: string;
  documentNumber: string;
  status: string;
  groupId: string;
  groupName: string;
  gradeName: string;
}

/**
 * Matrícula para reportes MEN (SIMAT, estadísticas).
 */
export interface EnrollmentForMenReport {
  id: string;
  status: string;
  studentId: string;
  student: {
    firstName: string;
    lastName: string;
    documentType: string;
    documentNumber: string;
    birthDate: Date | null;
    gender: string | null;
  };
  group: {
    id: string;
    name: string;
    gradeName: string;
    campusName: string | null;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DTOs PARA ESTRUCTURA ACADÉMICA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Asignatura en snapshot de matrícula.
 */
export interface EnrollmentSubjectSnapshot {
  id: string;
  subjectId: string | null;
  subjectName: string;
  subjectCode: string | null;
  weightPercentage: number;
  teacherName: string | null;
}

/**
 * Área en snapshot de matrícula.
 */
export interface EnrollmentAreaSnapshot {
  id: string;
  areaName: string;
  areaCode: string | null;
  weightPercentage: number;
  calculationType: string;
  subjects: EnrollmentSubjectSnapshot[];
}

/**
 * Observación de estudiante para reportes.
 */
export interface StudentObservationForReport {
  id: string;
  date: Date;
  type: string;
  category: string | null;
  description: string;
  authorName: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// DTOs PARA TÉRMINOS Y ESCALAS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Término académico para reportes.
 */
export interface AcademicTermForReport {
  id: string;
  name: string;
  type: string;
  order: number;
  weightPercentage: number;
  startDate: Date | null;
  endDate: Date | null;
}

/**
 * Escala de desempeño para reportes.
 */
export interface PerformanceScaleForReport {
  id: string;
  level: string;
  minScore: number;
  maxScore: number;
  description: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// DTOs PARA ASIGNACIONES DE DOCENTES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Asignación de docente para reportes (con área).
 */
export interface TeacherAssignmentForReport {
  id: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string | null;
  areaId: string;
  areaName: string;
  areaCode: string | null;
  teacherName: string;
}

/**
 * Asignación de docente simplificada (sin área).
 */
export interface TeacherAssignmentSimple {
  id: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string | null;
  teacherName: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// DTOs PARA CONTEXTO ACADÉMICO (usado por páginas académicas)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Estudiante en contexto académico (para Grades, Attendance, etc.)
 */
export interface AcademicStudent {
  id: string;
  name: string;
  enrollmentId: string;
  documentNumber?: string;
}
