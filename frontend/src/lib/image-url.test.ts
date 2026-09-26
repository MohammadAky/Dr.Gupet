import { describe, expect, it } from 'vitest';
import { safeImageUrl } from './image-url';

const app = 'http://localhost:5173';
const api = 'http://localhost:3000/api/v1';

describe('safeImageUrl', () => {
  it('accepts and resolves app and backend-hosted images', () => {
    expect(safeImageUrl('/brand/logo.jpg', app, api)).toBe('http://localhost:5173/brand/logo.jpg');
    expect(safeImageUrl('/uploads/pet.jpg', app, api)).toBe(
      'http://localhost:3000/uploads/pet.jpg',
    );
    expect(safeImageUrl('http://localhost:3000/uploads/pet.jpg', app, api)).toBe(
      'http://localhost:3000/uploads/pet.jpg',
    );
    expect(safeImageUrl('http://localhost:5173/brand/logo.jpg', app, api)).toBe(
      'http://localhost:5173/brand/logo.jpg',
    );
  });

  it('keeps local blob previews but rejects foreign blob origins', () => {
    expect(safeImageUrl('blob:http://localhost:5173/abc', app, api)).toBe(
      'blob:http://localhost:5173/abc',
    );
    expect(safeImageUrl('blob:https://other.example/abc', app, api)).toBeNull();
  });

  it.each([
    'https://tracker.example/pixel.png',
    '//tracker.example/pixel.png',
    'https://localhost:3000.evil.example/uploads/pet.jpg',
    'http://localhost:3000@tracker.example/uploads/pet.jpg',
    'data:image/svg+xml,<svg></svg>',
    'javascript:alert(1)',
    '/\\tracker.example/pixel.png',
    'images/relative-to-route.jpg',
    null,
    17,
  ])('rejects non-project image %s', (value) => {
    expect(safeImageUrl(value, app, api)).toBeNull();
  });
});
