/** Owner-requested minimum for the initial landing indicator, never for route changes. */
export const LANDING_BOOTSTRAP_MINIMUM_MS = 1200;

export function bootstrapPreviewDelay(pathname: string, startedAt: number, now: number): number {
  if (pathname !== '/' || !Number.isFinite(startedAt) || startedAt < 0 ||
      !Number.isFinite(now) || now < startedAt) return 0;
  return Math.max(0, LANDING_BOOTSTRAP_MINIMUM_MS - (now - startedAt));
}

/** Called once by the document entry, outside React's StrictMode lifecycle. */
export function mountAfterBootstrapPreview(pathname: string, startedAt: number, mount: () => void): () => void {
  const delay = bootstrapPreviewDelay(pathname, startedAt, performance.now());
  if (delay === 0) {
    mount();
    return () => {};
  }
  let timer: ReturnType<typeof setTimeout> | undefined = setTimeout(() => {
    timer = undefined;
    mount();
  }, delay);
  return () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
}
