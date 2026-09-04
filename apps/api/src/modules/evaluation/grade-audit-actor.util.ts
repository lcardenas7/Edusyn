import { GradeAuditActor } from './grade-audit.service';

/**
 * Extrae de la petición quién hace el cambio, para la auditoría forense.
 *
 * El rol se guarda tal y como venía en la sesión en ese momento: el rastro debe
 * poder decir con qué autoridad se actuó, aunque después esa persona cambie de
 * rol o cause baja.
 */
export function actorFromRequest(req: any): GradeAuditActor {
  const roles = req?.user?.roles;
  const role = Array.isArray(roles)
    ? roles
        .map((r: any) => (typeof r === 'string' ? r : r?.role?.name || r?.roleName || r?.name))
        .filter(Boolean)
        .join(', ')
    : undefined;
  return { userId: req?.user?.id, name: req?.user?.email, role: role || undefined };
}
