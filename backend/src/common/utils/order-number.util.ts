import * as crypto from 'crypto';

/**
 * Generate order number in format PT-YYMMDD-XXXXXX
 * XX are 6 random uppercase alphanumeric characters
 */
export function generateOrderNumber(): string {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let random = '';
  for (let i = 0; i < 6; i++) {
    random += chars[crypto.randomInt(chars.length)];
  }

  return `PT-${year}${month}${day}-${random}`;
}