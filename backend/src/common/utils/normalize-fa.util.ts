/**
 * Normalize Persian/Farsi text
 * - Convert Arabic ي to Persian ی
 * - Convert Arabic ك to Persian ک
 * - Remove zero-width characters and tatweel
 */
export function normalizeFa(input: string): string {
  if (!input) return '';

  return input
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[‌‍‎‏]/g, '') // Zero-width characters
    .replace(/[ـ]/g, ''); // Tatweel/kashida
}