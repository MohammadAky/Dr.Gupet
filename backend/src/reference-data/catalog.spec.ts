import {
  assertLocalReferenceTarget,
  assertReferenceOperatorTarget,
  planReferenceData,
  REFERENCE_SPECIES,
  REFERENCE_TAGS,
  referenceBreedIdentity,
} from './catalog';
describe('reference-only local repair plan', () => {
  it('offers common breeds and explicit unknown/domestic selections without alias duplicates', () => {
    expect(REFERENCE_SPECIES[0].breeds.length).toBeGreaterThanOrEqual(50);
    expect(REFERENCE_SPECIES[1].breeds.length).toBeGreaterThanOrEqual(35);
    expect(REFERENCE_SPECIES[2].breeds.length).toBeGreaterThanOrEqual(12);
    for (const species of REFERENCE_SPECIES) {
      expect(species.breeds).toContain('نامشخص');
      expect(
        new Set(species.breeds.map((name) => referenceBreedIdentity(species.slug, name))).size,
      ).toBe(species.breeds.length);
    }
    expect(REFERENCE_SPECIES[0].breeds).toContain('دورگه / میکس');
    expect(REFERENCE_SPECIES[1].breeds).toContain('خانگی کوتاه‌مو');
  });
  it('reuses spacing and known aliases without renaming existing breeds or creating duplicates', () => {
    const plan = planReferenceData({
      petTypes: [
        { id: 2, name: 'سگ', slug: 'سگ', isActive: true },
        { id: 3, name: 'گربه', slug: 'گربه', isActive: true },
      ],
      breeds: [
        { petTypeId: 2, name: 'لابرادور رتریور', isActive: true },
        { petTypeId: 2, name: 'شیت زو', isActive: true },
        { petTypeId: 2, name: 'هاسکی سیبری', isActive: true },
        { petTypeId: 3, name: 'مین کون', isActive: true },
        { petTypeId: 3, name: 'خانگی کوتاه مو', isActive: true },
      ],
      tags: [],
    });
    expect(plan.conflicts).toHaveLength(0);
    expect(
      plan.breeds.some((row) =>
        ['لابرادور', 'شیتزو', 'هاسکی', 'مین‌کوون', 'خانگی کوتاه‌مو'].includes(row.name),
      ),
    ).toBe(false);
  });
  it('refuses duplicate or disabled existing aliases rather than inserting or merging them', () => {
    const plan = planReferenceData({
      petTypes: [{ id: 2, name: 'سگ', slug: 'dog', isActive: true }],
      breeds: [
        { petTypeId: 2, name: 'لابرادور', isActive: true },
        { petTypeId: 2, name: 'لابرادور رتریور', isActive: true },
        { petTypeId: 2, name: 'هاسکی سیبری', isActive: false },
      ],
      tags: [],
    });
    expect(plan.conflicts).toHaveLength(2);
    expect(plan.breeds.some((row) => ['لابرادور', 'هاسکی'].includes(row.name))).toBe(false);
  });
  it('reuses the existing Persian species and tag identities rather than creating duplicates', () => {
    const plan = planReferenceData({
      petTypes: [{ id: 3, name: 'سگ', slug: 'سگ', isActive: true }],
      breeds: [],
      tags: [{ name: 'مرغ', slug: 'مرغ', type: 'ALLERGEN' }],
    });
    expect(plan.petTypes.map((row) => row.slug)).toEqual(['cat', 'bird']);
    expect(plan.breeds.find((row) => row.name === 'لابرادور')?.petTypeSlug).toBe('سگ');
    expect(plan.tags.some((row) => row.slug === 'chicken')).toBe(false);
    expect(plan.conflicts).toHaveLength(0);
  });
  it('fills missing species, correctly scoped breeds, and both tag types without demo entities', () => {
    const plan = planReferenceData({
      petTypes: [{ id: 1, name: 'سگ', slug: 'dog', isActive: true }],
      breeds: [],
      tags: [],
    });
    expect(plan.petTypes.map((row) => row.slug)).toEqual(['cat', 'bird']);
    expect(plan.breeds.find((row) => row.name === 'پرشین')?.petTypeSlug).toBe('cat');
    expect(plan.breeds.find((row) => row.name === 'عروس هلندی')?.petTypeSlug).toBe('bird');
    expect(plan.tags.filter((row) => row.type === 'ALLERGEN')).toHaveLength(9);
    expect(plan.tags.filter((row) => row.type === 'DIET')).toHaveLength(8);
  });
  it('has no insertions after the same vocabulary already exists', () => {
    const state = {
      petTypes: REFERENCE_SPECIES.map((row, index) => ({ ...row, id: index + 1, isActive: true })),
      breeds: REFERENCE_SPECIES.flatMap((row, index) =>
        row.breeds.map((name) => ({ name, petTypeId: index + 1, isActive: true })),
      ),
      tags: REFERENCE_TAGS,
    };
    expect(planReferenceData(state)).toEqual({
      petTypes: [],
      breeds: [],
      tags: [],
      conflicts: [],
      malformedBreeds: [],
    });
  });
  it('reports conflicting/disabled references instead of silently replacing their semantics', () => {
    const plan = planReferenceData({
      petTypes: [{ id: 1, name: 'سگ', slug: 'dog', isActive: false }],
      breeds: [],
      tags: [{ name: 'مرغ', slug: 'chicken', type: 'DIET' }],
    });
    expect(plan.conflicts).toHaveLength(2);
  });
  it.each([
    ['mysql://operator@remote.example/local', 'local', 'development'],
    ['mysql://operator@localhost/production', 'production', 'production'],
    ['mysql://operator@localhost/other', 'local', 'test'],
    ['file:./dev.db', 'dev.db', 'development'],
    ['mysql://operator@localhost/local', 'local', undefined],
  ])('refuses an unsafe or unconfirmed target', (url, name, environment) => {
    expect(() => assertLocalReferenceTarget(url!, name!, environment)).toThrow();
  });
  it('accepts only a confirmed local MySQL database in a nonproduction environment', () => {
    expect(
      assertLocalReferenceTarget(
        'mysql://operator@127.0.0.1:3307/local_review',
        'local_review',
        'test',
      ),
    ).toEqual({ host: '127.0.0.1', database: 'local_review' });
  });
  it('keeps the default operator confined to the exact local nonproduction target', () => {
    expect(
      assertReferenceOperatorTarget(
        'mysql://operator@localhost/review',
        'review',
        'test',
        false,
        false,
      ),
    ).toEqual({ host: 'localhost', database: 'review', production: false });
    expect(() =>
      assertReferenceOperatorTarget(
        'mysql://operator@mysql/live',
        'live',
        'production',
        false,
        true,
      ),
    ).toThrow();
  });
  it.each([
    ['mysql://operator@mysql/live', 'live', 'production', true, false],
    ['mysql://operator@mysql/live', 'other', 'production', true, true],
    ['mysql://operator@mysql/live', '', 'production', true, true],
    ['mysql://operator@mysql/live', 'live', 'test', true, true],
    ['file:./live.db', 'live.db', 'production', true, true],
  ] as const)(
    'rejects incompletely authorized production reference target',
    (url, database, environment, production, backup) => {
      expect(() =>
        assertReferenceOperatorTarget(url, database, environment, production, backup),
      ).toThrow();
    },
  );
  it('permits only explicit production, named database, and completed backup confirmation', () => {
    expect(
      assertReferenceOperatorTarget(
        'mysql://operator@mysql/live',
        'live',
        'production',
        true,
        true,
      ),
    ).toEqual({ host: 'mysql', database: 'live', production: true });
  });
});
