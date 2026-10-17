import { AppException } from '../../common/filters/all-exceptions.filter';
export const PRODUCT_EXPORT_COLUMNS = [
  'productId',
  'variantId',
  'sku',
  'name',
  'slug',
  'brandId',
  'categoryId',
  'petTypeId',
  'price',
  'stock',
  'weightGram',
  'compareAtPrice',
  'isActive',
  'ingredientsText',
  'description',
  'expectedStock',
  'expectedUpdatedAt',
] as const;
export type ExportColumn = (typeof PRODUCT_EXPORT_COLUMNS)[number];
export const PRODUCT_CSV_ENCODING = 'drgupet-text-v1';
export function exportColumns(value?: string): ExportColumn[] {
  const columns = value ? value.split(',') : [...PRODUCT_EXPORT_COLUMNS];
  if (
    !columns.length ||
    columns.some((c) => !PRODUCT_EXPORT_COLUMNS.includes(c as ExportColumn)) ||
    new Set(columns).size !== columns.length
  )
    throw new AppException('VALIDATION_ERROR', 'ستون‌های خروجی معتبر نیستند', 400);
  return columns as ExportColumn[];
}
export function csvCell(value: unknown): string {
  let text = value == null ? '' : String(value);
  // Prefix genuine apostrophes too; the explicit encoding marker makes reversal unambiguous.
  if (/^[\s\uFEFF]*[=+@-]/.test(text) || text.startsWith("'") || /^[\t\r\n]/.test(text))
    text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
export function productExportCsv(
  rows: Array<Record<ExportColumn, unknown>>,
  columns: ExportColumn[],
): string {
  return (
    '\uFEFF' +
    [
      'csvEncoding,' + columns.join(','),
      ...rows.map((row) =>
        [csvCell(PRODUCT_CSV_ENCODING), ...columns.map((c) => csvCell(row[c]))].join(','),
      ),
    ].join('\r\n') +
    '\r\n'
  );
}
