/**
 * Edusyn Construye: equipos, versiones inmutables y bitácora de proyectos F1.
 *
 * Usa el cliente HTTP compartido de `lib/api.ts` (mismo token e institución que el resto).
 */

import api from '../api'

export type ConstruyeFilePath = 'index.html' | 'styles.css' | 'app.js'
export interface ConstruyeManifestFile { path: ConstruyeFilePath; content: string }
export interface ConstruyeManifest { files: ConstruyeManifestFile[] }

export interface ConstruyeVersion {
  id: string
  number: number
  label: string | null
  manifest: ConstruyeManifest
  createdAt: string
}

export interface ConstruyeJournalEntry {
  id: string
  type: string
  summary: string
  detail?: unknown
  createdAt: string
}

export type ConstruyeMemberRole = 'RESEARCH' | 'DESIGN' | 'DEVELOPMENT' | 'TESTING' | 'COORDINATION'

/** Recorrido pedagógico del equipo (ver construye.service.ts). `problem` = qué ocurre y
 * `features` = qué tendrá la versión 1; los demás campos pueden faltar en briefs antiguos. */
export interface ConstruyeTeamBrief {
  problem: string
  affected: string
  whyItMatters: string
  solution: string
  audience: string
  screens: string
  subject: string
  grade: '8.º' | '9.º' | '10.º' | '11.º'
  style: string
  features: string
  later: string
  successCheck: string
  sharePitch: string
  reflection: string
}

export interface ConstruyeBuildGate {
  canSaveFirstVersion: boolean
  unlockedByTeacher: boolean
  hasVersions: boolean
  missing: ('problem' | 'features' | 'successCheck')[]
}

export interface ConstruyeVersionEvidence { attempted: string; tested: string; learned: string; explained?: string; peerFeedback?: string }

export type ConstruyeSessionNote =
  | { kind: 'GOAL'; goal: string }
  | { kind: 'EXIT'; met: 'yes' | 'partly' | 'no'; blocker: string; next: string }

export interface ConstruyeTeamSignal { level: 'green' | 'yellow' | 'red'; reason: string }

export interface ConstruyeTeamMember {
  id: string
  role: ConstruyeMemberRole
  studentEnrollment: { id: string; student: { firstName: string; lastName: string } }
}

/** Página web o aplicación para el celular: lo elige el docente al crear el proyecto. */
export type ConstruyeProjectKind = 'WEB' | 'APP'

/** Borrador del código guardado automáticamente (no es una versión). */
export interface ConstruyeCodeDraft { manifest: ConstruyeManifest | null; revision: number; updatedAt: string | null; by: string | null }

export interface ConstruyeTeamDetail {
  team: {
    id: string; name: string; projectId: string; brief: Partial<ConstruyeTeamBrief> | null; briefUpdatedAt: string | null
    /** Ausentes en una API anterior al guardado automático del código. */
    codeDraft?: ConstruyeManifest | null
    codeDraftRevision?: number
    codeDraftUpdatedAt?: string | null
  }
  /** Ausente en una API anterior al selector web/aplicación. */
  project?: { id: string; title: string; kind: ConstruyeProjectKind } | null
  members: ConstruyeTeamMember[]
  versions: ConstruyeVersion[]
  journal: ConstruyeJournalEntry[]
  /** Ausente en respuestas de una API anterior al recorrido. */
  buildGate?: ConstruyeBuildGate
}

export interface ConstruyeProject {
  id: string
  classroomId: string
  classroomActivityId: string | null
  title: string
  /** Ausente en una API anterior: se trata como página web. */
  kind?: ConstruyeProjectKind
  instructions: string | null
  status: string
  startDate: string | null
  dueDate: string | null
  createdAt: string
}

export interface ConstruyeDashboardTeam {
  id: string
  name: string
  brief: Partial<ConstruyeTeamBrief> | null
  briefUpdatedAt: string | null
  members: ConstruyeTeamMember[]
  buildGate?: ConstruyeBuildGate
  /** Semáforo del docente (ausente en una API anterior). */
  signal?: ConstruyeTeamSignal
  latestVersion: ConstruyeVersion | null
  recentMilestones: ConstruyeJournalEntry[]
  needsAttention: boolean
}

export const construyeApi = {
  listClassroomProjects: (classroomId: string) =>
    api.get<ConstruyeProject[]>(`/construye/classrooms/${classroomId}/projects`),
  createProject: (data: { classroomId: string; title: string; kind?: ConstruyeProjectKind; instructions?: string; dueDate?: string; classroomActivityId?: string }) =>
    api.post<ConstruyeProject>(`/construye/projects`, data),
  updateProject: (projectId: string, data: { kind?: ConstruyeProjectKind; title?: string }) =>
    api.patch<ConstruyeProject>(`/construye/projects/${projectId}`, data),
  createTeam: (projectId: string, data: { name: string; members: { studentEnrollmentId: string; role?: ConstruyeMemberRole }[] }) =>
    api.post<{ id: string; name: string; projectId: string }>(`/construye/projects/${projectId}/teams`, data),
  dashboard: (projectId: string) => api.get<ConstruyeDashboardTeam[]>(`/construye/projects/${projectId}/dashboard`),
  myTeam: (projectId: string) => api.get<ConstruyeTeamDetail>(`/construye/projects/${projectId}/my-team`),
  teamDetail: (teamId: string) => api.get<ConstruyeTeamDetail>(`/construye/teams/${teamId}`),
  /** Con `fields`, el servidor escribe solo esos campos y conserva el resto (guardado automático entre compañeros). */
  updateBrief: (teamId: string, brief: ConstruyeTeamBrief, fields?: (keyof ConstruyeTeamBrief)[]) =>
    api.patch<{ team: ConstruyeTeamDetail['team']; journalEntry: ConstruyeJournalEntry | null }>(`/construye/teams/${teamId}/brief`, fields ? { brief, fields } : { brief }),
  /** Guardado automático del código. Si otro integrante guardó antes, responde 409 con su borrador. */
  saveCodeDraft: (teamId: string, data: { manifest: ConstruyeManifest; baseRevision: number }) =>
    api.put<{ revision: number; updatedAt: string }>(`/construye/teams/${teamId}/code-draft`, data),
  createVersion: (teamId: string, data: { manifest: ConstruyeManifest; label?: string; evidence?: ConstruyeVersionEvidence }) =>
    api.post<ConstruyeVersion>(`/construye/teams/${teamId}/versions`, data),
  unlockBuild: (teamId: string, data: { reason?: string } = {}) =>
    api.post<ConstruyeJournalEntry>(`/construye/teams/${teamId}/build-unlock`, data),
  addJournalEntry: (teamId: string, data: { type: string; summary: string; detail?: Record<string, unknown> }) =>
    api.post<ConstruyeJournalEntry>(`/construye/teams/${teamId}/journal`, data),
}

// ─── Publicar la app (enlace/QR/instalable) y su uso ─────────────────────────────────────────

export type ConstruyePublicationStatus = 'PENDING' | 'PUBLISHED' | 'REJECTED' | 'UNPUBLISHED'

/** Uso anónimo de la app publicada, sin contar los dispositivos del equipo (ver app-usage.ts). */
export interface ConstruyeAppUsage {
  devices: number
  teamDevices: number
  installs: number
  activeToday: number
  activeWeek: number
  opens: number
  minutes: number
  returnedNextDay: { eligible: number; returned: number }
  returnedWeek: { eligible: number; returned: number }
  sources: { qr: number; link: number; team: number; direct: number }
  daily: { day: string; active: number; newDevices: number }[]
  suspicious: boolean
  lastUseAt: string | null
}

export interface ConstruyePublication {
  id: string
  teamId: string
  status: ConstruyePublicationStatus
  /** En línea ahora mismo (publicada y sin vencer). */
  live: boolean
  title: string
  kind: ConstruyeProjectKind
  /** Enlace público; null si el servicio de apps no está configurado. */
  url: string | null
  versionNumber: number | null
  pendingVersionNumber: number | null
  requestedAt: string | null
  reviewedAt: string | null
  reviewNote: string | null
  publishedAt: string | null
  expiresAt: string | null
  stats: ConstruyeAppUsage | null
}

export const construyePublicationApi = {
  forTeam: (teamId: string) =>
    api.get<{ publication: ConstruyePublication | null; appsConfigured: boolean }>(`/construye/teams/${teamId}/publication`),
  request: (teamId: string, data: { title?: string; versionId?: string } = {}) =>
    api.post<ConstruyePublication>(`/construye/teams/${teamId}/publication`, data),
  forProject: (projectId: string) => api.get<ConstruyePublication[]>(`/construye/projects/${projectId}/publications`),
  approve: (publicationId: string, data: { expiresAt?: string | null } = {}) =>
    api.post<ConstruyePublication>(`/construye/publications/${publicationId}/approve`, data),
  reject: (publicationId: string, data: { note?: string } = {}) =>
    api.post<ConstruyePublication>(`/construye/publications/${publicationId}/reject`, data),
  unpublish: (publicationId: string) => api.post<ConstruyePublication>(`/construye/publications/${publicationId}/unpublish`, {}),
}
