/** Admin-created references may keep Persian slugs; preserve their database identity. */
export function normalizeReferenceName(value: string) {
  return value.trim().replaceAll('ي', 'ی').replaceAll('ك', 'ک').toLocaleLowerCase('fa-IR');
}

export function canonicalSpeciesSlug(slug: string, name?: string): 'dog' | 'cat' | 'bird' | null {
  const aliases = { dog: ['dog', 'سگ'], cat: ['cat', 'گربه'], bird: ['bird', 'پرنده'] } as const;
  for (const [canonical, values] of Object.entries(aliases)) {
    if (
      values.some(
        (alias) =>
          normalizeReferenceName(slug) === alias ||
          (name !== undefined && normalizeReferenceName(name) === alias),
      )
    ) {
      return canonical as 'dog' | 'cat' | 'bird';
    }
  }
  return null;
}
