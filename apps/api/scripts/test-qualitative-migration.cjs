// Run only against an empty, disposable localhost PostgreSQL database.
// argv[2] is SQL generated from the schema before the qualitative columns.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { Client } = require('pg');
async function main() {
  const url = new URL(process.env.QA_DATABASE_URL || '');
  assert(['127.0.0.1', 'localhost'].includes(url.hostname), 'Only disposable localhost is allowed');
  const db = new Client({ connectionString: url.toString() });
  await db.connect();
  try {
    const existing = await db.query("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public'");
    assert.equal(existing.rows[0].n, 0, 'Refuse to modify a database that already contains tables');
    await db.query('BEGIN');
    await db.query(fs.readFileSync(process.argv[2], 'utf8'));
    await db.query(`INSERT INTO "Institution" (id,name,slug,"updatedAt") VALUES ('qa-i','QA migration','qa-migration',now())`);
    await db.query(`INSERT INTO "AcademicYear" (id,"institutionId",year,"updatedAt") VALUES ('qa-y','qa-i',2026,now())`);
    const migration = path.join(__dirname, '../prisma/migrations/20261106010000_qualitative_promotion_policies/migration.sql');
    await db.query(fs.readFileSync(migration, 'utf8'));
    const before = await db.query('SELECT * FROM "AcademicYear" WHERE id=$1', ['qa-y']);
    assert.equal(before.rows[0].status, 'ACTIVE');
    assert.deepEqual(before.rows[0].qualitativePromotionPolicies, []);
    assert.deepEqual(before.rows[0].qualitativePromotionDecisions, []);
    const first = await db.query(`UPDATE "AcademicYear" SET "qualitativePromotionPolicies"=$1::jsonb
      WHERE id=$2 AND "institutionId"=$3 AND "qualitativePromotionPolicies"=$4::jsonb`,
      [JSON.stringify([{ revision: 1 }]), 'qa-y', 'qa-i', '[]']);
    assert.equal(first.rowCount, 1);
    const stale = await db.query(`UPDATE "AcademicYear" SET "qualitativePromotionPolicies"=$1::jsonb
      WHERE id=$2 AND "institutionId"=$3 AND "qualitativePromotionPolicies"=$4::jsonb`,
      [JSON.stringify([{ revision: 2 }]), 'qa-y', 'qa-i', '[]']);
    assert.equal(stale.rowCount, 0);
    await db.query(`INSERT INTO "AcademicYear" (id,"institutionId",year,"updatedAt") VALUES ('qa-next','qa-i',2027,now())`);
    const next = await db.query('SELECT "qualitativePromotionPolicies", "qualitativePromotionDecisions" FROM "AcademicYear" WHERE id=$1', ['qa-next']);
    assert.deepEqual(next.rows[0].qualitativePromotionPolicies, []);
    assert.deepEqual(next.rows[0].qualitativePromotionDecisions, []);
    console.log('PASS: additive migration, existing year preserved, empty defaults, stale JSON write rejected, next year defaults.');
    await db.query('ROLLBACK');
  } finally { await db.end(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
