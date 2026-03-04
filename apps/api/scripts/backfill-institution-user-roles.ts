/**
 * FASE 1.2 — Backfill InstitutionUserRole from UserRole + InstitutionUser
 * 
 * Logic:
 *   For each UserRole(userId, roleId):
 *     Find all InstitutionUser records for that userId
 *     For each InstitutionUser: upsert InstitutionUserRole(institutionUserId, roleId)
 * 
 * Safety:
 *   - Uses upsert (idempotent — safe to run multiple times)
 *   - Does NOT modify or delete any existing data
 *   - Logs all actions for audit
 *   - Dry-run mode by default
 * 
 * Usage:
 *   npx ts-node scripts/backfill-institution-user-roles.ts          # dry-run
 *   npx ts-node scripts/backfill-institution-user-roles.ts --apply  # real execution
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const isDryRun = !process.argv.includes('--apply');

async function main() {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`  BACKFILL InstitutionUserRole from UserRole + InstitutionUser`);
  console.log(`  Mode: ${isDryRun ? '🔍 DRY-RUN (no writes)' : '⚡ APPLY (real writes)'}`);
  console.log(`${'='.repeat(70)}\n`);

  // 1. Get all UserRoles with role name
  const userRoles = await prisma.userRole.findMany({
    include: { role: true },
  });
  console.log(`Found ${userRoles.length} UserRole records.`);

  // 2. Get all InstitutionUser records, indexed by userId
  const institutionUsers = await prisma.institutionUser.findMany();
  const iuByUserId = new Map<string, typeof institutionUsers>();
  for (const iu of institutionUsers) {
    const list = iuByUserId.get(iu.userId) || [];
    list.push(iu);
    iuByUserId.set(iu.userId, list);
  }
  console.log(`Found ${institutionUsers.length} InstitutionUser records across ${iuByUserId.size} users.\n`);

  // 3. Get existing InstitutionUserRole count (before)
  const existingCount = await prisma.institutionUserRole.count();
  console.log(`Existing InstitutionUserRole records: ${existingCount}\n`);

  let created = 0;
  let skippedExisting = 0;
  let skippedNoInstitution = 0;
  const errors: Array<{ userId: string; roleId: string; error: string }> = [];

  for (const ur of userRoles) {
    const userInstitutions = iuByUserId.get(ur.userId);

    if (!userInstitutions || userInstitutions.length === 0) {
      // User has a role but no institution (e.g., SuperAdmin without tenant)
      skippedNoInstitution++;
      console.log(`  SKIP: User ${ur.userId} has role "${ur.role.name}" but no InstitutionUser`);
      continue;
    }

    for (const iu of userInstitutions) {
      try {
        if (isDryRun) {
          // Check if it would be a duplicate
          const exists = await prisma.institutionUserRole.findUnique({
            where: {
              institutionUserId_roleId: {
                institutionUserId: iu.id,
                roleId: ur.roleId,
              },
            },
          });
          if (exists) {
            skippedExisting++;
          } else {
            created++;
            console.log(`  WOULD CREATE: InstitutionUser=${iu.id} (inst=${iu.institutionId}) + Role="${ur.role.name}"`);
          }
        } else {
          await prisma.institutionUserRole.upsert({
            where: {
              institutionUserId_roleId: {
                institutionUserId: iu.id,
                roleId: ur.roleId,
              },
            },
            create: {
              institutionUserId: iu.id,
              roleId: ur.roleId,
              assignedAt: ur.assignedAt,
            },
            update: {},  // No-op if exists
          });
          created++;
        }
      } catch (e: any) {
        errors.push({ userId: ur.userId, roleId: ur.roleId, error: e.message });
        console.error(`  ERROR: User=${ur.userId}, Role=${ur.roleId}: ${e.message}`);
      }
    }
  }

  // 4. Summary
  const finalCount = isDryRun ? existingCount + created : await prisma.institutionUserRole.count();

  console.log(`\n${'='.repeat(70)}`);
  console.log(`  SUMMARY`);
  console.log(`${'='.repeat(70)}`);
  console.log(`  UserRole records processed:    ${userRoles.length}`);
  console.log(`  ${isDryRun ? 'Would create' : 'Created'}:                    ${created}`);
  console.log(`  Skipped (already exists):      ${skippedExisting}`);
  console.log(`  Skipped (no institution):      ${skippedNoInstitution}`);
  console.log(`  Errors:                        ${errors.length}`);
  console.log(`  InstitutionUserRole before:    ${existingCount}`);
  console.log(`  InstitutionUserRole after:     ${finalCount}`);
  console.log(`${'='.repeat(70)}`);

  if (errors.length > 0) {
    console.log(`\n  ERRORS:`);
    for (const err of errors) {
      console.log(`    User=${err.userId}, Role=${err.roleId}: ${err.error}`);
    }
  }

  if (isDryRun) {
    console.log(`\n  ℹ️  This was a DRY-RUN. To apply, run with --apply`);
  }

  // 5. Validation check
  if (!isDryRun) {
    console.log(`\n  VALIDATION:`);
    const userRoleCount = await prisma.userRole.count();
    const iurCount = await prisma.institutionUserRole.count();
    console.log(`    UserRole count:              ${userRoleCount}`);
    console.log(`    InstitutionUserRole count:   ${iurCount}`);
    console.log(`    Expected: IUR >= UserRole (${iurCount >= userRoleCount ? '✅ PASS' : '❌ FAIL'})`);
  }
}

main()
  .catch((e) => {
    console.error('Fatal error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
