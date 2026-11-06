/**
 * A replacement creates another assignment, not another curriculum subject.
 * For live reports prefer the current assignment (grades/attendance are moved
 * to it on replacement). Keep the latest historical assignment when a subject
 * has ended altogether. Published snapshots are not modified by this helper.
 * Call with assignments for a single group and academic year.
 */
export function reportAssignmentsBySubject<T extends {
  id: string;
  subjectId: string;
  startDate?: Date;
  endDate?: Date | null;
}>(assignments: T[]): T[] {
  const bySubject = new Map<string, T>();
  const preferred = (a: T, b: T) => {
    if (!!a.endDate !== !!b.endDate) return !a.endDate;
    const delta = (a.startDate?.getTime() ?? 0) - (b.startDate?.getTime() ?? 0);
    return delta !== 0 ? delta > 0 : a.id.localeCompare(b.id) > 0;
  };
  for (const assignment of assignments) {
    const previous = bySubject.get(assignment.subjectId);
    if (!previous || preferred(assignment, previous)) {
      bySubject.set(assignment.subjectId, assignment);
    }
  }
  return [...bySubject.values()];
}
