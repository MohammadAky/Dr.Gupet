export const PRESENTATION_PREFIX = 'presentation-v1-';
export const PRESENTATION_LABEL = 'نمونه نمایشی';
export function isPresentationName(name: string): boolean {
  return name.endsWith(`— ${PRESENTATION_LABEL}`);
}
