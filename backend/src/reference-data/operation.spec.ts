import { applyReferenceData } from './operation';
import { REFERENCE_SPECIES, REFERENCE_TAGS } from './catalog';

const breedCount = REFERENCE_SPECIES.reduce((total, species) => total + species.breeds.length, 0);

function referenceTransaction(
  petTypes: { id: number; name: string; slug: string; isActive: boolean }[],
) {
  const breeds: { name: string; petTypeId: number; isActive: boolean }[] = [];
  const tags: { name: string; slug: string; type: string }[] = [];
  const tx: any = {
    petType: {
      findMany: jest.fn(async () => petTypes),
      findUniqueOrThrow: jest.fn(async ({ where }: any) => {
        const row = petTypes.find((item) => item.slug === where.slug);
        if (!row) throw new Error('Unknown exact database slug');
        return row;
      }),
      create: jest.fn(async ({ data }: any) => {
        const row = { ...data, id: petTypes.length + 10, isActive: true };
        petTypes.push(row);
        return row;
      }),
    },
    breed: {
      findMany: jest.fn(async () => breeds),
      create: jest.fn(async ({ data }: any) => {
        breeds.push({ ...data, isActive: true });
        return data;
      }),
    },
    tag: {
      findMany: jest.fn(async () => tags),
      create: jest.fn(async ({ data }: any) => {
        tags.push(data);
        return data;
      }),
    },
  };
  return { tx, petTypes, breeds, tags };
}

describe('Reference create-only transaction preserves Persian database identities', () => {
  it('fills the reference vocabulary for existing IDs 2/3/4 using exact Persian slugs without duplicate species', async () => {
    const original = [
      { id: 2, name: 'سگ', slug: 'سگ', isActive: true },
      { id: 3, name: 'گربه', slug: 'گربه', isActive: true },
      { id: 4, name: 'پرنده', slug: 'پرنده', isActive: true },
    ];
    const state = referenceTransaction(original.map((row) => ({ ...row })));
    expect(await applyReferenceData(state.tx)).toEqual({
      species: 0,
      breeds: breedCount,
      tags: REFERENCE_TAGS.length,
    });
    expect(state.petTypes).toEqual(original);
    expect(state.tx.petType.create).not.toHaveBeenCalled();
    expect(
      new Set(state.tx.petType.findUniqueOrThrow.mock.calls.map(([arg]: any) => arg.where.slug)),
    ).toEqual(new Set(['سگ', 'گربه', 'پرنده']));
    for (const [index, species] of REFERENCE_SPECIES.entries()) {
      expect(
        state.breeds.filter((row) => row.petTypeId === index + 2).map((row) => row.name),
      ).toEqual([...species.breeds]);
    }
    expect(await applyReferenceData(state.tx)).toEqual({ species: 0, breeds: 0, tags: 0 });
    expect(state.tx.breed.create).toHaveBeenCalledTimes(breedCount);
    expect(state.tx.tag.create).toHaveBeenCalledTimes(REFERENCE_TAGS.length);
  });

  it('creates only missing cat/bird references alongside an existing Persian dog identity', async () => {
    const state = referenceTransaction([{ id: 2, name: 'سگ', slug: 'سگ', isActive: true }]);
    expect(await applyReferenceData(state.tx)).toEqual({
      species: 2,
      breeds: breedCount,
      tags: REFERENCE_TAGS.length,
    });
    expect(state.petTypes[0]).toEqual({ id: 2, name: 'سگ', slug: 'سگ', isActive: true });
    expect(state.tx.petType.create.mock.calls.map(([arg]: any) => arg.data.slug)).toEqual([
      'cat',
      'bird',
    ]);
    expect(state.breeds.filter((row) => row.petTypeId === 2)).toHaveLength(
      REFERENCE_SPECIES[0].breeds.length,
    );
  });

  it('refuses duplicate semantic species before any write', async () => {
    const state = referenceTransaction([
      { id: 2, name: 'سگ', slug: 'سگ', isActive: true },
      { id: 8, name: 'سگ', slug: 'dog', isActive: true },
    ]);
    await expect(applyReferenceData(state.tx)).rejects.toThrow();
    expect(state.tx.petType.create).not.toHaveBeenCalled();
    expect(state.tx.breed.create).not.toHaveBeenCalled();
    expect(state.tx.tag.create).not.toHaveBeenCalled();
  });
});
