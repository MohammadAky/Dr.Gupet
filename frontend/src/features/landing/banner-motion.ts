/** Critically damped spring, retaining the velocity when a gesture is released. */
export function bannerSpring(position: number, target: number, velocity: number, seconds: number) {
  const response = 26;
  const delta = position - target;
  const coefficient = velocity + response * delta;
  const decay = Math.exp(-response * seconds);
  return {
    position: target + (delta + coefficient * seconds) * decay,
    velocity: (velocity - response * coefficient * seconds) * decay,
  };
}

export function bannerStep(distance: number, width: number, velocity: number): -1 | 0 | 1 {
  const projected = distance + (velocity / 1000) * 0.99 / (1 - 0.99);
  if (Math.abs(projected) < Math.max(40, width * 0.16) &&
    !(Math.abs(distance) >= 12 && Math.abs(velocity) >= 500)) return 0;
  const direction = Math.abs(velocity) >= 500 ? velocity : projected;
  return direction > 0 ? 1 : -1;
}
