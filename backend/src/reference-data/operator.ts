/** Standalone approved reference vocabulary importer. Never imported by application startup. */
import { Prisma, PrismaClient } from '@prisma/client';
import { assertReferenceOperatorTarget, planReferenceData } from './catalog';
import { applyReferenceData, readReferenceState } from './operation';

async function main() {
  const database =
    process.argv.find((arg) => arg.startsWith('--database='))?.slice('--database='.length) ?? '';
  const databaseUrl = process.env.DATABASE_URL ?? '';
  const target = assertReferenceOperatorTarget(
    databaseUrl,
    database,
    process.env.NODE_ENV,
    process.argv.includes('--allow-production'),
    process.argv.includes('--backup-confirmed'),
  );
  const apply = process.argv.includes('--apply');
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    const plan = planReferenceData(await readReferenceState(prisma));
    console.log(JSON.stringify({ target, mode: apply ? 'apply' : 'dry-run', plan }, null, 2));
    if (!apply) return;
    if (plan.conflicts.length) throw new Error('Reference identity conflicts require review.');
    const created = await prisma.$transaction(applyReferenceData, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 30000,
    });
    console.log(JSON.stringify({ created }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(() => {
  // Driver errors can contain private connection details. Do not print them.
  console.error(
    'Reference-only operation failed. Nothing partially written; check named target, backup and identity conflicts.',
  );
  process.exitCode = 1;
});
