/**
 * Persian-aware slugify
 * Keeps Persian letters, replaces whitespace with -, removes punctuation, lowercases Latin
 */
export function slugify(input: string): string {
  if (!input) return '';

  // Normalize Arabic letters to Persian
  let slug = input
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[ە]/g, 'ه')
    .replace(/[ۀ]/g, 'ه')
    .replace(/[ؤ]/g, 'و')
    .replace(/[إأآ]/g, 'ا')
    .replace(/[ٱ]/g, 'ا');

  // Remove zero-width characters and tatweel
  slug = slug.replace(/[‌‍‎‏ـ]/g, '');

  // Replace punctuation and whitespace with single dash
  slug = slug
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '') // Remove punctuation except dash
    .replace(/[\s_]+/g, '-') // Replace spaces/underscores with dash
    .replace(/-+/g, '-') // Collapse multiple dashes
    .replace(/^-|-$/g, ''); // Trim leading/trailing dashes

  return slug;
}