/** Responsive derivatives exist only for these versioned original campaign assets. */
export function landingImageSet(source: string | undefined, appOrigin?: string): string | undefined {
  if (!source) return undefined;
  if (appOrigin && /^https?:\/\//i.test(source)) {
    try {
      const url = new URL(source);
      if (url.origin !== appOrigin || url.search || url.hash || url.username || url.password) return undefined;
      source = url.pathname;
    } catch { return undefined; }
  }
  const mobile = /^\/brand\/landing-(family|meal|treat)-mobile\.webp$/.exec(source);
  if (mobile) return `/brand/landing-${mobile[1]}-mobile-480.webp 480w, /brand/landing-${mobile[1]}-mobile-720.webp 720w`;
  const desktop = /^\/brand\/landing-(family|meal|treat)-1600\.webp$/.exec(source);
  if (desktop) return `/brand/landing-${desktop[1]}-640.webp 640w, ${source} 1600w`;
  return undefined;
}
