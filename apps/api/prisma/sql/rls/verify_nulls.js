const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const tables = [
    'StudentEnrollment', 'TeacherAssignment',
    'EnrollmentArea', 'EnrollmentSubject', 'EnrollmentDimension', 'EnrollmentEvent',
    'StudentGrade', 'PeriodFinalGrade', 'PartialGrade', 'FinalComponentGrade',
    'PreventiveAlert', 'AttendanceRecord', 'StudentObservation',
    'ObserverCommitment', 'GuardianCitation', 'ObserverReferral', 'PedagogicalMeasure',
    'PeriodRecovery', 'FinalRecoveryPlan', 'PerformanceManualEdit', 'StudentAchievement',
    'EvaluativeActivity', 'SubjectPerformance', 'Achievement', 'AttitudinalAchievement',
    'RoomRestriction'
  ];

  let allGood = true;
  for (const t of tables) {
    const r = await p.$queryRawUnsafe(`SELECT COUNT(*) as c FROM "${t}" WHERE "institutionId" IS NULL`);
    const n = Number(r[0].c);
    if (n > 0) {
      console.log(`WARNING ${t}: ${n} NULLs`);
      allGood = false;
    } else {
      console.log(`OK ${t}`);
    }
  }

  if (allGood) {
    console.log('\nAll 26 tables have institutionId populated. Safe to make required.');
  }

  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
