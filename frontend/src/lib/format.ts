/** Persian digit helpers and money formatting. Money is an integer in Toman (README §6.7). */

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

export function toFaDigits(value: string): string {
  return value.replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)] ?? d);
}

export function toEnDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

/** Groups an integer with thousands separators, keeping Latin digits (LTR-safe). */
export function groupDigits(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return Math.trunc(Math.abs(value))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** e.g. 1_250_000 → "۱٬۲۵۰٬۰۰۰ تومان" (using Persian thousands separator \u066C) */
export function formatToman(value: number): string {
  return `${toFaDigits(groupDigits(value)).replace(/,/g, '٬')} تومان`;
}

/** Persian grouping with Persian digits, without the unit (for table cells). */
export function formatAmount(value: number): string {
  return toFaDigits(groupDigits(value)).replace(/,/g, '٬');
}

/** 2000 → "۲ کیلوگرم", 500 → "۵۰۰ گرم" */
export function formatWeight(gram: number): string {
  if (gram >= 1000 && gram % 1000 === 0) {
    return `${toFaDigits(String(gram / 1000))} کیلوگرم`;
  }
  return `${toFaDigits(String(gram))} گرم`;
}
