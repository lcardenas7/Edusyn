/**
 * Backfill de gamificación: otorga XP (e insignias) por el trabajo YA realizado
 * antes de que existiera la capa LearningIdentity.
 *
 * Es IDEMPOTENTE: usa exactamente las mismas idempotencyKey que los caminos en vivo
 * (lesson.service / classroom.service), así que se puede correr varias veces y
 * conviviendo con la generación en vivo sin duplicar XP.
 *
 * Fuentes (mismas reglas que producción):
 *   1. Lección completada  → +50 XP        key: lesson:<lessonId>:complete:<enr>
 *   2. Acierto en lección  → +points        key: lesson:<lessonId>:slide:<slide>:correct:<enr>
 *   3. Quiz auto-calificado→ +norm(30)      key: quiz:activity:<act>:enrollment:<enr>
 *   4. Actividad calificada→ +norm(30)      key: grade:activity:<act>:enrollment:<enr>
 * (3 y 4 normalizan score/maxScore a un presupuesto de 30 XP — igual que en vivo.)
 *
 * Uso:
 *   DATABASE_URL=... npx ts-node scripts/backfill-gamification-xp.ts [--dry-run]
 */
import { PrismaClient } from '@prisma/client';
import { LearningIdentityService } from '../src/modules/gamification/learning-identity.service';

const prisma = new PrismaClient();
const svc = new LearningIdentityService(prisma as any);
const DRY = process.argv.includes('--dry-run');

let events = 0;
let xp = 0;
let badges = 0;
const students = new Set<string>();

async function grant(p: Parameters<LearningIdentityService['grantXp']>[0]) {
  students.add(p.studentId);
  if (DRY) { events++; xp += p.amount; return; }
  const r = await svc.grantXp(p);
  if (r.granted) { events++; xp += r.awarded; badges += r.newBadges.length; }
}

async function main() {
  console.log(DRY ? '=== DRY RUN (no escribe) ===' : '=== BACKFILL (escribiendo) ===');

  // 1 + 2. Lecciones completadas (bonus + aciertos por slide)
  const progresses = await prisma.lessonProgress.findMany({
    where: { status: 'COMPLETED' },
    include: {
      lesson: { select: { id: true, title: true, activity: { select: { classroom: { select: { teacherAssignment: { select: { subject: { select: { name: true } } } } } } } } } },
      studentEnrollment: { select: { id: true, studentId: true, institutionId: true } },
    },
  });
  console.log(`Lecciones completadas: ${progresses.length}`);
  for (const p of progresses) {
    const enr = p.studentEnrollment;
    const lessonSkill = p.lesson.activity?.classroom?.teacherAssignment?.subject?.name ?? null;
    const answers = (p.answers as Record<string, any>) || {};
    for (const [slideId, a] of Object.entries(answers)) {
      const pts = Number(a?.points ?? 0);
      if (a?.isCorrect && pts > 0) {
        await grant({
          institutionId: enr.institutionId, studentId: enr.studentId, studentEnrollmentId: enr.id,
          source: 'LESSON_ACTIVITY', amount: pts, skill: lessonSkill, reason: `Acierto en lección: ${p.lesson.title}`,
          idempotencyKey: `lesson:${p.lessonId}:slide:${slideId}:correct:${enr.id}`,
        });
      }
    }
    await grant({
      institutionId: enr.institutionId, studentId: enr.studentId, studentEnrollmentId: enr.id,
      source: 'LESSON_COMPLETE', amount: 50, skill: lessonSkill, reason: `Lección completada: ${p.lesson.title}`,
      idempotencyKey: `lesson:${p.lessonId}:complete:${enr.id}`,
    });
  }

  // 3 + 4. Entregas calificadas (quiz auto-calificado / actividad calificada a mano)
  const subs = await prisma.activitySubmission.findMany({
    where: { status: { in: ['AUTO_GRADED', 'GRADED'] } },
    orderBy: { createdAt: 'asc' }, // primer intento gana (igual que en vivo)
    include: {
      activity: { select: { id: true, title: true, maxScore: true, classroom: { select: { teacherAssignment: { select: { subject: { select: { name: true } } } } } } } },
      studentEnrollment: { select: { id: true, studentId: true, institutionId: true } },
    },
  });
  console.log(`Entregas calificadas: ${subs.length}`);
  for (const s of subs) {
    const enr = s.studentEnrollment;
    const maxScore = s.activity.maxScore ? Number(s.activity.maxScore) : null;
    const score = s.score ? Number(s.score) : 0;
    if (!maxScore || maxScore <= 0 || score <= 0) continue;
    const amount = Math.round(Math.min(score / maxScore, 1) * 30);
    if (amount <= 0) continue;
    const skill = s.activity.classroom?.teacherAssignment?.subject?.name ?? null;
    // Misma clave que el camino en vivo según cómo se calificó.
    const isAuto = s.status === 'AUTO_GRADED';
    await grant({
      institutionId: enr.institutionId, studentId: enr.studentId, studentEnrollmentId: enr.id,
      source: 'QUIZ_GRADED', amount, skill,
      reason: isAuto ? `Quiz: ${s.activity.title}` : `Actividad calificada: ${s.activity.title}`,
      idempotencyKey: isAuto
        ? `quiz:activity:${s.activityId}:enrollment:${enr.id}`
        : `grade:activity:${s.activityId}:enrollment:${enr.id}`,
    });
  }

  console.log('\n=== RESUMEN ===');
  console.log(`Estudiantes afectados: ${students.size}`);
  console.log(`Eventos de XP ${DRY ? 'a conceder' : 'concedidos'}: ${events}`);
  console.log(`XP total ${DRY ? 'a conceder' : 'concedido'}: ${xp}`);
  if (!DRY) console.log(`Insignias otorgadas: ${badges}`);
}

main().catch(e => { console.error('ERROR:', e?.message || e); process.exit(1); }).finally(() => prisma.$disconnect());
