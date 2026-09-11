export type FollowUpFilter = 'all' | 'due' | 'unscheduled' | 'active' | 'completed'

export interface FollowUpPlan {
  status: string
  followUpDate?: string | null
  supportStrategy?: string
  studentEnrollment?: { student?: { firstName?: string; secondName?: string; lastName?: string; secondLastName?: string; documentNumber?: string } }
}

// Follow-up is a school calendar date. Do not shift a date stored at UTC midnight
// to the previous day in Colombia when comparing or displaying it.
export function followUpState(plan: FollowUpPlan, today: string): 'due' | 'upcoming' | 'unscheduled' | 'closed' {
  if (plan.status !== 'ACTIVE') return 'closed'
  const day = plan.followUpDate?.slice(0, 10)
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return 'unscheduled'
  return day <= today ? 'due' : 'upcoming'
}

export function filterFollowUpPlans<T extends FollowUpPlan>(plans: T[], filter: FollowUpFilter, search: string, today: string): T[] {
  const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim()
  const needle = normalize(search)
  return plans.filter(plan => {
    const student = plan.studentEnrollment?.student
    const matchesSearch = normalize([student?.firstName, student?.secondName, student?.lastName, student?.secondLastName, student?.documentNumber, plan.supportStrategy].filter(Boolean).join(' ')).includes(needle)
    const matchesFilter = filter === 'all' || (filter === 'active' ? plan.status === 'ACTIVE' : filter === 'completed' ? plan.status === 'COMPLETED' : followUpState(plan, today) === filter)
    return matchesSearch && matchesFilter
  }).sort((a, b) => {
    const order = { due: 0, unscheduled: 1, upcoming: 2, closed: 3 }
    return order[followUpState(a, today)] - order[followUpState(b, today)] || (a.followUpDate || '').localeCompare(b.followUpDate || '')
  })
}
