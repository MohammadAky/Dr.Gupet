import { describe, expect, it, vi } from 'vitest';
import { createSingleFlight } from './single-flight';

describe('createSingleFlight', () => {
  it('collapses concurrent callers into one execution', async () => {
    let resolve!: (value: string) => void;
    const fn = vi.fn(
      () =>
        new Promise<string>((r) => {
          resolve = r;
        }),
    );

    const flight = createSingleFlight(fn);
    const a = flight();
    const b = flight();
    const c = flight();

    expect(fn).toHaveBeenCalledTimes(1);
    resolve('done');
    expect(await Promise.all([a, b, c])).toEqual(['done', 'done', 'done']);
  });

  it('allows a new execution after the first one settles', async () => {
    const fn = vi.fn().mockResolvedValue('x');
    const flight = createSingleFlight(fn);

    await flight();
    await flight();
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
