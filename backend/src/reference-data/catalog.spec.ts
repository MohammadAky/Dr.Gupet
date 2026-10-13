import {
  assertLocalReferenceTarget,
  assertReferenceOperatorTarget,
  planReferenceData,
  REFERENCE_SPECIES,
  REFERENCE_TAGS,
} from './catalog';
describe('reference-only local repair plan', () => {
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
