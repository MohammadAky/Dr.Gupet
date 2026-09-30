import { SetMetadata } from '@nestjs/common';

export const SKIP_TRANSFORM_KEY = 'skipTransform';

/**
 * Marks a handler to bypass the global TransformResponseInterceptor
 * (used for non-envelope payloads such as CSV exports).
 */
export const RawResponse = () => SetMetadata(SKIP_TRANSFORM_KEY, true);
