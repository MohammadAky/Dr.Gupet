/** Explicit owner-approved presentation data operation; NEVER part of startup/deployment/seed. */
import { Prisma, PrismaClient } from '@prisma/client';
import {
  assertPresentationTarget,
  importPresentationData,
  PRESENTATION_PRODUCTS,
  PRESENTATION_PHARMACIES,
} from './catalog';

async function main() {
  const database =
    process.argv.find((arg) => arg.startsWith('--database='))?.slice('--database='.length) ?? '';
  const databaseUrl = process.env.DATABASE_URL ?? '';
  const target = assertPresentationTarget(
    databaseUrl,
    database,
    process.argv.includes('--allow-production'),
    process.argv.includes('--backup-confirmed'),
  );
  const apply = process.argv.includes('--apply');
  console.log(
    JSON.stringify({
      target,
      mode: apply ? 'apply' : 'dry-run',
      plannedMaximum: {
        products: PRESENTATION_PRODUCTS.length,
        medicines: 6,
        pharmacies: PRESENTATION_PHARMACIES.length,
      },
      clinics: 'preserved; no sample clinics',
      existingRecords: 'create-only; no overwrites; products cannot be purchased',
    }),
  );
  if (!apply) return;
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    const created = await prisma.$transaction(importPresentationData, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 30000,
    });
    console.log(JSON.stringify({ created }));
  } finally {
    await prisma.$disconnect();
  }
}
main().catch(() => {
  // Database exceptions may contain private connection strings: keep output sanitized.
  console.error(
    'Presentation import failed. Nothing is partially written. Check named target, active reference species and reserved identity conflicts.',
  );
  process.exitCode = 1;
});
