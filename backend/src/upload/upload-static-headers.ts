import type { Response } from 'express';

/** Only public raster uploads may be displayed by customer/admin origins on the same site. */
export function uploadStaticHeaders(response: Pick<Response, 'setHeader'>, filePath: string) {
  if (/\.(?:jpe?g|png|webp)$/i.test(filePath)) {
    response.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  }
}
