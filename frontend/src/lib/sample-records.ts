/** Reserved server presentation markers are conservative fallbacks for older responses. */
export function isSampleProduct(item: { isSample?: boolean; slug: string }): boolean {
  return item.isSample === true || item.slug.startsWith('presentation-v1-');
}

export function isSampleReference(item: { isSample?: boolean; name: string }): boolean {
  return item.isSample === true || item.name.trim().endsWith('— نمونه نمایشی');
}

/** Presentation labels stay in source records; public headings use the actual item name. */
export function publicRecordName(item: { name: string; isSample?: boolean; slug?: string }): string {
  const marked = isSampleReference(item) || item.slug?.startsWith('presentation-v1-');
  return marked ? item.name.replace(/\s*—\s*نمونه نمایشی\s*$/u, '').trim() : item.name;
}
