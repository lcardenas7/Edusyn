import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// ═══════════════════════════════════════════════════════════════════════════
// CATÁLOGO DE CAPABILITIES
// ═══════════════════════════════════════════════════════════════════════════

export interface CapabilityDefinition {
  key: string;
  name: string;
  description: string;
  module: 'TIMETABLE' | 'REPORTS';
}

export const CAPABILITY_CATALOG: CapabilityDefinition[] = [
  {
    key: 'VIEW_OWN_SCHEDULE',
    name: 'Ver su propio horario',
    description: 'Permite al docente ver únicamente su horario personal',
    module: 'TIMETABLE',
  },
  {
    key: 'VIEW_TUTOR_GROUP_SCHEDULE',
    name: 'Ver horario del grupo tutor',
    description: 'Permite al director de grupo ver el horario completo de su grupo',
    module: 'TIMETABLE',
  },
  {
    key: 'VIEW_OWN_COURSE_REPORTS',
    name: 'Reportes de sus cursos',
    description: 'Permite al docente ver reportes académicos de los cursos donde dicta clase',
    module: 'REPORTS',
  },
  {
    key: 'VIEW_TUTOR_GROUP_REPORTS',
    name: 'Reportes del grupo tutor',
    description: 'Permite al director de grupo ver reportes globales de su grupo (rendimiento, asistencia, alertas)',
    module: 'REPORTS',
  },
  {
    key: 'VIEW_STUDENT_OBSERVER',
    name: 'Observador de sus estudiantes',
    description: 'Permite al docente ver el observador de los estudiantes que atiende',
    module: 'REPORTS',
  },
  {
    key: 'VIEW_GROUP_ATTENDANCE',
    name: 'Asistencia del grupo tutor',
    description: 'Permite al director de grupo ver la asistencia completa de su grupo',
    module: 'REPORTS',
  },
  {
    key: 'VIEW_GLOBAL_STATS',
    name: 'Estadísticas institucionales',
    description: 'Permite ver estadísticas globales de toda la institución',
    module: 'REPORTS',
  },
];

// Valores por defecto: qué capabilities tiene cada rol
export const DEFAULT_CAPABILITIES: Record<string, string[]> = {
  DOCENTE: [
    'VIEW_OWN_SCHEDULE',
    'VIEW_OWN_COURSE_REPORTS',
    'VIEW_STUDENT_OBSERVER',
  ],
  DOCENTE_TUTOR: [
    'VIEW_OWN_SCHEDULE',
    'VIEW_TUTOR_GROUP_SCHEDULE',
    'VIEW_OWN_COURSE_REPORTS',
    'VIEW_TUTOR_GROUP_REPORTS',
    'VIEW_STUDENT_OBSERVER',
    'VIEW_GROUP_ATTENDANCE',
  ],
  COORDINADOR: [
    'VIEW_OWN_SCHEDULE',
    'VIEW_TUTOR_GROUP_SCHEDULE',
    'VIEW_OWN_COURSE_REPORTS',
    'VIEW_TUTOR_GROUP_REPORTS',
    'VIEW_STUDENT_OBSERVER',
    'VIEW_GROUP_ATTENDANCE',
    'VIEW_GLOBAL_STATS',
  ],
};

// Todos los roles configurables en la matriz
export const CONFIGURABLE_ROLES = ['DOCENTE', 'DOCENTE_TUTOR', 'COORDINADOR'];

@Injectable()
export class CapabilitiesService {
  constructor(private readonly prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // SEED: Inicializar capabilities por defecto para una institución
  // ═══════════════════════════════════════════════════════════════════════════

  async seedDefaults(institutionId: string): Promise<void> {
    const existing = await this.prisma.institutionRoleCapability.count({
      where: { institutionId },
    });

    // Solo sembrar si no hay registros
    if (existing > 0) return;

    const records: Array<{
      institutionId: string;
      role: string;
      capabilityKey: string;
      isEnabled: boolean;
    }> = [];

    for (const role of CONFIGURABLE_ROLES) {
      const defaults = DEFAULT_CAPABILITIES[role] || [];
      for (const cap of CAPABILITY_CATALOG) {
        records.push({
          institutionId,
          role,
          capabilityKey: cap.key,
          isEnabled: defaults.includes(cap.key),
        });
      }
    }

    await this.prisma.institutionRoleCapability.createMany({
      data: records,
      skipDuplicates: true,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LECTURA: Obtener la matriz de capabilities de una institución
  // ═══════════════════════════════════════════════════════════════════════════

  async getCapabilityMatrix(institutionId: string): Promise<{
    catalog: CapabilityDefinition[];
    roles: string[];
    matrix: Record<string, Record<string, boolean>>;
  }> {
    // Asegurar que existan los defaults
    await this.seedDefaults(institutionId);

    const capabilities = await this.prisma.institutionRoleCapability.findMany({
      where: { institutionId },
      orderBy: [{ role: 'asc' }, { capabilityKey: 'asc' }],
    });

    // Construir la matriz: { role: { capabilityKey: isEnabled } }
    const matrix: Record<string, Record<string, boolean>> = {};
    for (const role of CONFIGURABLE_ROLES) {
      matrix[role] = {};
      for (const cap of CAPABILITY_CATALOG) {
        matrix[role][cap.key] = false;
      }
    }

    for (const cap of capabilities) {
      if (matrix[cap.role]) {
        matrix[cap.role][cap.capabilityKey] = cap.isEnabled;
      }
    }

    return {
      catalog: CAPABILITY_CATALOG,
      roles: CONFIGURABLE_ROLES,
      matrix,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTUALIZACIÓN: Admin modifica la matriz
  // ═══════════════════════════════════════════════════════════════════════════

  async updateCapabilityMatrix(
    institutionId: string,
    updates: Array<{ role: string; capabilityKey: string; isEnabled: boolean }>,
  ): Promise<void> {
    // Asegurar que existan los defaults primero
    await this.seedDefaults(institutionId);

    await Promise.all(
      updates.map((u) =>
        this.prisma.institutionRoleCapability.upsert({
          where: {
            institutionId_role_capabilityKey: {
              institutionId,
              role: u.role,
              capabilityKey: u.capabilityKey,
            },
          },
          update: { isEnabled: u.isEnabled },
          create: {
            institutionId,
            role: u.role,
            capabilityKey: u.capabilityKey,
            isEnabled: u.isEnabled,
          },
        }),
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RESET: Restaurar valores por defecto
  // ═══════════════════════════════════════════════════════════════════════════

  async resetToDefaults(institutionId: string): Promise<void> {
    await this.prisma.institutionRoleCapability.deleteMany({
      where: { institutionId },
    });
    await this.seedDefaults(institutionId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VERIFICACIÓN: ¿El usuario tiene una capability?
  // ═══════════════════════════════════════════════════════════════════════════

  async userHasCapability(
    userId: string,
    institutionId: string,
    capabilityKey: string,
  ): Promise<boolean> {
    // 1. Obtener usuario con roles
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: { include: { role: true } },
      },
    });

    if (!user) return false;

    // 2. SuperAdmin y Admin Institucional tienen acceso total
    if (user.isSuperAdmin) return true;

    const roleNames = user.roles.map((r) => r.role.name);
    if (roleNames.includes('ADMIN_INSTITUTIONAL')) return true;

    // 3. Determinar los roles efectivos del usuario
    const effectiveRoles: string[] = [];

    if (roleNames.includes('COORDINADOR')) {
      effectiveRoles.push('COORDINADOR');
    }

    if (roleNames.includes('DOCENTE')) {
      effectiveRoles.push('DOCENTE');

      // ¿Es director de algún grupo en el año activo? → DOCENTE_TUTOR
      const directedGroups = await this.prisma.group.count({
        where: {
          directorId: userId,
          teacherAssignments: {
            some: {
              academicYear: {
                institutionId,
                status: 'ACTIVE',
              },
            },
          },
        },
      });

      if (directedGroups > 0) {
        effectiveRoles.push('DOCENTE_TUTOR');
      }
    }

    if (effectiveRoles.length === 0) return false;

    // 4. Asegurar que existan las capabilities
    await this.seedDefaults(institutionId);

    // 5. Verificar si alguno de sus roles efectivos tiene la capability habilitada
    const capability = await this.prisma.institutionRoleCapability.findFirst({
      where: {
        institutionId,
        role: { in: effectiveRoles },
        capabilityKey,
        isEnabled: true,
      },
    });

    return !!capability;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OBTENER TODAS LAS CAPABILITIES DEL USUARIO (para frontend)
  // ═══════════════════════════════════════════════════════════════════════════

  async getUserCapabilities(
    userId: string,
    institutionId: string,
  ): Promise<{
    capabilities: string[];
    effectiveRoles: string[];
    isTutor: boolean;
    tutorGroupIds: string[];
    teacherAssignmentGroupIds: string[];
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: { include: { role: true } },
      },
    });

    if (!user) {
      return {
        capabilities: [],
        effectiveRoles: [],
        isTutor: false,
        tutorGroupIds: [],
        teacherAssignmentGroupIds: [],
      };
    }

    // SuperAdmin y Admin tienen todo
    if (user.isSuperAdmin) {
      return {
        capabilities: CAPABILITY_CATALOG.map((c) => c.key),
        effectiveRoles: ['SUPERADMIN'],
        isTutor: false,
        tutorGroupIds: [],
        teacherAssignmentGroupIds: [],
      };
    }

    const roleNames = user.roles.map((r) => r.role.name);
    if (roleNames.includes('ADMIN_INSTITUTIONAL')) {
      return {
        capabilities: CAPABILITY_CATALOG.map((c) => c.key),
        effectiveRoles: ['ADMIN_INSTITUTIONAL'],
        isTutor: false,
        tutorGroupIds: [],
        teacherAssignmentGroupIds: [],
      };
    }

    // Determinar roles efectivos
    const effectiveRoles: string[] = [];

    if (roleNames.includes('COORDINADOR')) {
      effectiveRoles.push('COORDINADOR');
    }

    // Obtener grupos dirigidos (tutor) del año activo
    let tutorGroupIds: string[] = [];
    let teacherAssignmentGroupIds: string[] = [];

    if (roleNames.includes('DOCENTE')) {
      effectiveRoles.push('DOCENTE');

      // Grupos donde es director (año activo)
      const directedGroups = await this.prisma.group.findMany({
        where: {
          directorId: userId,
          teacherAssignments: {
            some: {
              academicYear: {
                institutionId,
                status: 'ACTIVE',
              },
            },
          },
        },
        select: { id: true },
      });

      tutorGroupIds = directedGroups.map((g) => g.id);
      if (tutorGroupIds.length > 0) {
        effectiveRoles.push('DOCENTE_TUTOR');
      }

      // Grupos donde tiene asignaciones de docencia (año activo)
      const assignments = await this.prisma.teacherAssignment.findMany({
        where: {
          teacherId: userId,
          academicYear: {
            institutionId,
            status: 'ACTIVE',
          },
        },
        select: { groupId: true },
      });

      teacherAssignmentGroupIds = [
        ...new Set(assignments.map((a) => a.groupId)),
      ];
    }

    if (effectiveRoles.length === 0) {
      return {
        capabilities: [],
        effectiveRoles,
        isTutor: false,
        tutorGroupIds: [],
        teacherAssignmentGroupIds: [],
      };
    }

    // Obtener capabilities habilitadas
    await this.seedDefaults(institutionId);

    const enabledCaps = await this.prisma.institutionRoleCapability.findMany({
      where: {
        institutionId,
        role: { in: effectiveRoles },
        isEnabled: true,
      },
      select: { capabilityKey: true },
    });

    const capabilities = [...new Set(enabledCaps.map((c) => c.capabilityKey))];

    return {
      capabilities,
      effectiveRoles,
      isTutor: tutorGroupIds.length > 0,
      tutorGroupIds,
      teacherAssignmentGroupIds,
    };
  }
}
