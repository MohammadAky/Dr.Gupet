import { expect, it } from 'vitest';
import { deleteTomanSeparator, formatTomanEdit, formatTomanInput, rawTomanInput } from './toman-input';

it.each(['123000', '۱۲۳۰۰۰', '١٢٣٠٠٠', '123,000', '۱۲۳٬۰۰۰', '123 000'])('groups %s without changing its integer Toman value', value => {
  expect(formatTomanInput(value)).toBe('۱۲۳٬۰۰۰');
  expect(rawTomanInput(value)).toBe('123000');
  expect(Number(rawTomanInput(value))).toBe(123000);
});
it('preserves empty, zero, leading zeros and digits beyond safe-integer precision', () => {
  expect(formatTomanInput('')).toBe(''); expect(formatTomanInput('0')).toBe('۰');
  expect(rawTomanInput('000123')).toBe('000123');
  expect(formatTomanInput('9007199254740993')).toBe('۹٬۰۰۷٬۱۹۹٬۲۵۴٬۷۴۰٬۹۹۳');
  expect(rawTomanInput(formatTomanInput('9007199254740993'))).toBe('9007199254740993');
});
it.each(['-1000', '+1000', '12.5', '1e3', '۱۲٫۵'])('leaves invalid monetary syntax %s invalid instead of silently producing a different amount', value => {
  expect(formatTomanInput(value)).toBe(value);
  expect(/^\d+$/.test(rawTomanInput(value))).toBe(false);
});
it('maps insertion, middle selection and separator-side carets by digit position', () => {
  expect(formatTomanEdit('1234', 4)).toEqual({ raw: '1234', display: '۱٬۲۳۴', start: 5, end: 5 });
  expect(formatTomanEdit('۱۲٬۳۴۵', 3)).toEqual({ raw: '12345', display: '۱۲٬۳۴۵', start: 3, end: 3 });
  expect(formatTomanEdit('123456', 2, 5)).toEqual({ raw: '123456', display: '۱۲۳٬۴۵۶', start: 2, end: 6 });
});
it('deletes the neighboring digit when Backspace/Delete encounters a separator', () => {
  expect(deleteTomanSeparator('۱٬۲۳۴', 2, 'Backspace')).toEqual({ raw: '234', display: '۲۳۴', start: 0, end: 0 });
  expect(deleteTomanSeparator('۱٬۲۳۴', 1, 'Delete')).toEqual({ raw: '134', display: '۱۳۴', start: 1, end: 1 });
  expect(deleteTomanSeparator('۱٬۲۳۴', 5, 'Backspace')).toBeNull();
});
it('rejects ambiguous pasted comma/space decimal syntax while allowing proper thousands groups', () => {
  expect(rawTomanInput('1,5')).toBe('1,5'); expect(formatTomanInput('1,5')).toBe('1,5');
  expect(rawTomanInput('1,23')).toBe('1,23'); expect(rawTomanInput('1 23')).toBe('1 23');
  expect(rawTomanInput('1,234,567')).toBe('1234567');
});
