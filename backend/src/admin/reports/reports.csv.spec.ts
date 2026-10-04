import { toCsv } from './reports.service';

/**
 * Issue #09 — CSV export must neutralize spreadsheet formula injection.
 * Cells starting with `=`, `+`, `-`, `@` (also after leading whitespace)
 * are prefixed with a single quote so Excel/Sheets treat them as text.
 */
describe('toCsv — formula injection (issue #09)', () => {
  it('neutralizes leading formula characters', () => {
    const csv = toCsv(
      ['name', 'note'],
      [
        ['=cmd|calc', 'safe'],
        ['+1+1', 1],
        ['-2+3', 2],
        ['@SUM(A1)', 3],
      ],
    );
    const lines = csv.split('\n');
    expect(lines[1].startsWith("'=cmd|calc")).toBe(true);
    expect(lines[2].startsWith("'+1+1")).toBe(true);
    expect(lines[3].startsWith("'-2+3")).toBe(true);
    expect(lines[4].startsWith("'@SUM(A1)")).toBe(true);
  });

  it('neutralizes formulas hidden behind whitespace', () => {
    const csv = toCsv(['v'], [['  =1+1']]);
    expect(csv.split('\n')[1]).toContain("'  =1+1");
  });

  it('still escapes quotes/commas/newlines and leaves normal cells alone', () => {
    const csv = toCsv(['a', 'b'], [['x,y', 'he said "hi"'], ['plain', 42]]);
    const lines = csv.split('\n');
    expect(lines[1]).toBe('"x,y","he said ""hi"""');
    expect(lines[2]).toBe('plain,42');
    expect(csv.startsWith('a,b')).toBe(true);
  });
});
