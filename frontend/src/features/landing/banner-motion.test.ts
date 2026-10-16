import { expect, it } from 'vitest';
import { bannerSpring, bannerStep } from './banner-motion';

it('projects fast gestures and follows a strong reversal instead of requiring only a long drag', () => {
  expect(bannerStep(-20, 360, 0)).toBe(0);
  expect(bannerStep(-130, 360, 0)).toBe(-1);
  expect(bannerStep(130, 360, 0)).toBe(1);
  expect(bannerStep(-15, 360, -600)).toBe(-1);
  expect(bannerStep(-130, 360, 900)).toBe(1);
});
it('starts from the actual position/velocity and settles toward the target without a jump', () => {
  expect(bannerSpring(-130, -360, -200, 0)).toEqual({ position: -130, velocity: -200 });
  const middle = bannerSpring(-130, -360, -200, 0.1);
  expect(middle.position).toBeLessThan(-130);
  expect(middle.position).toBeGreaterThan(-360);
  expect(bannerSpring(-130, -360, -200, 0.5).position).toBeCloseTo(-360, 1);
});
