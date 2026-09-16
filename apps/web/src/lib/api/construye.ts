/**
 * Edusyn Construye: equipos, versiones inmutables y bitácora de proyectos F1.
 *
 * Importa desde aquí (`lib/api/construye`) y no desde `lib/api`: la fachada arrastra la
 * superficie completa de API al chunk de quien la usa. Ver docs/PLAN_R1_CODE_SPLITTING.md.
 */

import { api } from './client'

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

export interface ConstruyeTeamBrief {
  problem: string
  audience: string
  subject: string
  grade: '8.º' | '9.º' | '10.º' | '11.º'
  features: string
  style: string
}

export interface ConstruyeTeamMember {
  id: string
  role: ConstruyeMemberRole
  studentEnrollment: { id: string; student: { firstName: string; lastName: string } }
}

export interface ConstruyeTeamDetail {
  team: { id: string; name: string; projectId: string; brief: ConstruyeTeamBrief | null; briefUpdatedAt: string | null }
  members: ConstruyeTeamMember[]
  versions: ConstruyeVersion[]
  journal: ConstruyeJournalEntry[]
}

export interface ConstruyeProject {
  id: string
  classroomId: string
  classroomActivityId: string | null
  title: string
  instructions: string | null
  status: string
  startDate: string | null
  dueDate: string | null
  createdAt: string
}

export interface ConstruyeDashboardTeam {
  id: string
  name: string
  brief: ConstruyeTeamBrief | null
  briefUpdatedAt: string | null
  members: ConstruyeTeamMember[]
  latestVersion: ConstruyeVersion | null
  recentMilestones: ConstruyeJournalEntry[]
  needsAttention: boolean
}

export const construyeApi = {
  listClassroomProjects: (classroomId: string) =>
    api.get<ConstruyeProject[]>(`/construye/classrooms/${classroomId}/projects`),
  createProject: (data: { classroomId: string; title: string; instructions?: string; dueDate?: string; classroomActivityId?: string }) =>
    api.post<ConstruyeProject>(`/construye/projects`, data),
  createTeam: (projectId: string, data: { name: string; members: { studentEnrollmentId: string; role?: ConstruyeMemberRole }[] }) =>
    api.post<{ id: string; name: string; projectId: string }>(`/construye/projects/${projectId}/teams`, data),
  dashboard: (projectId: string) => api.get<ConstruyeDashboardTeam[]>(`/construye/projects/${projectId}/dashboard`),
  myTeam: (projectId: string) => api.get<ConstruyeTeamDetail>(`/construye/projects/${projectId}/my-team`),
  teamDetail: (teamId: string) => api.get<ConstruyeTeamDetail>(`/construye/teams/${teamId}`),
  updateBrief: (teamId: string, brief: ConstruyeTeamBrief) =>
    api.patch<{ team: ConstruyeTeamDetail['team']; journalEntry: ConstruyeJournalEntry | null }>(`/construye/teams/${teamId}/brief`, { brief }),
  createVersion: (teamId: string, data: { manifest: ConstruyeManifest; label?: string }) =>
    api.post<ConstruyeVersion>(`/construye/teams/${teamId}/versions`, data),
  addJournalEntry: (teamId: string, data: { type: string; summary: string; detail?: Record<string, unknown> }) =>
    api.post<ConstruyeJournalEntry>(`/construye/teams/${teamId}/journal`, data),
}
