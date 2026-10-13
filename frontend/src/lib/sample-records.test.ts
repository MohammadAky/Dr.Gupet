import { expect, it } from 'vitest';
import { isSampleProduct, isSampleReference, publicRecordName } from './sample-records';

it('removes only the reserved presentation suffix from public copy without altering source data', () => {
  const item = Object.freeze({ name: 'غذای سگ — نمونه نمایشی', slug: 'presentation-v1-dog-food', isSample: true });
  expect(publicRecordName(item)).toBe('غذای سگ');
  expect(item.name).toBe('غذای سگ — نمونه نمایشی');
  expect(isSampleProduct(item)).toBe(true);
  expect(isSampleReference(item)).toBe(true);
});
it('preserves ordinary names and reserved server guards for older responses', () => {
  expect(publicRecordName({ name: 'داروخانه سپید' })).toBe('داروخانه سپید');
  expect(isSampleProduct({ slug: 'presentation-v1-cat-food' })).toBe(true);
  expect(publicRecordName({ name: 'داروخانه سپید — نمونه نمایشی' })).toBe('داروخانه سپید');
});
