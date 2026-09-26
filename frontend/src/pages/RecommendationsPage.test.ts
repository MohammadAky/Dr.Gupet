import { describe, expect, it } from 'vitest';
import { queryKeys } from '../api/query-keys';
import { parseRecommendationPage } from './RecommendationsPage';

describe('recommendations paging', () => {
  it('uses valid URL pages and defaults malformed, fractional, or out-of-range values to page one', () => {
    expect(parseRecommendationPage(new URLSearchParams('page=3'))).toBe(3);
    for (const raw of ['0', '-2', '1.5', 'foo', '999999999999999999999']) {
      expect(parseRecommendationPage(new URLSearchParams(`page=${raw}`))).toBe(1);
    }
  });

  it('keeps each page in a separate recommendation cache entry', () => {
    expect(queryKeys.recommendations(7, 1)).not.toEqual(queryKeys.recommendations(7, 2));
  });
});
