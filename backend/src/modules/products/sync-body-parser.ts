import { json, type RequestHandler } from 'express';
/** Apply before Nest registers its default parser; every other route keeps 100KiB. */
export function productSyncJson(): RequestHandler {
  const parser = json({ limit: '1mb' });
  // Nest detects globally installed parsers by function name. A route-scoped
  // wrapper must not make it skip its normal parser on every other route.
  return function productSyncBodyParser(req, res, next) {
    parser(req, res, next);
  };
}
