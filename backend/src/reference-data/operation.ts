import { Prisma } from '@prisma/client';
import { planReferenceData } from './catalog';

export async function readReferenceState(tx: Prisma.TransactionClient) {
  return {
    petTypes: await tx.petType.findMany(),
    breeds: await tx.breed.findMany(),
    tags: await tx.tag.findMany(),
  };
}

/** Execute only inside the caller's Serializable transaction. Preserve database IDs and slugs. */
export async function applyReferenceData(tx: Prisma.TransactionClient) {
  const current = planReferenceData(await readReferenceState(tx));
  if (current.conflicts.length) throw new Error('Reference state changed; nothing written.');
  for (const species of current.petTypes) await tx.petType.create({ data: species });
  for (const breed of current.breeds) {
    // The planner carries the existing database slug, including Persian aliases.
    const species = await tx.petType.findUniqueOrThrow({ where: { slug: breed.petTypeSlug } });
    await tx.breed.create({ data: { name: breed.name, petTypeId: species.id } });
  }
  for (const tag of current.tags) await tx.tag.create({ data: tag });
  const verified = planReferenceData(await readReferenceState(tx));
  if (
    verified.conflicts.length ||
    verified.petTypes.length ||
    verified.breeds.length ||
    verified.tags.length
  )
    throw new Error('Reference consistency failed; transaction rolled back.');
  return {
    species: current.petTypes.length,
    breeds: current.breeds.length,
    tags: current.tags.length,
  };
}
