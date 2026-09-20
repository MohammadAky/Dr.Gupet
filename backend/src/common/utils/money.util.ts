/**
 * Money utilities for Iranian Toman (stored as Int)
 * Payment gateways may require Rial
 */

const RIAL_PER_TOMAN = 10;

/**
 * Convert Toman to Rial
 */
export function tomanToRial(toman: number): number {
  return Math.round(toman * RIAL_PER_TOMAN);
}

/**
 * Convert Rial to Toman
 */
export function rialToToman(rial: number): number {
  return Math.round(rial / RIAL_PER_TOMAN);
}