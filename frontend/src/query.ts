import { QueryClient } from '@tanstack/react-query';
import { isApiError } from './lib/errors';

/**
 * Retry policy: never retry client errors (4xx) — they are deterministic
 * (validation, ownership 404, coupon failures) — and keep 5xx/network retries short.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (isApiError(error)) return error.statusCode >= 500 && failureCount < 2;
          return failureCount < 2;
        },
      },
      mutations: { retry: false },
    },
  });
}
