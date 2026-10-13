/** Reserved server presentation markers are conservative fallbacks for older responses. */
export function isSampleProduct(item: { isSample?: boolean; slug: string }): boolean {
  return item.isSample === true || item.slug.startsWith('presentation-v1-');
}

export function isSampleReference(item: { isSample?: boolean; name: string }): boolean {
  return item.isSample === true || item.name.trim().endsWith('— نمونه نمایشی');
}
