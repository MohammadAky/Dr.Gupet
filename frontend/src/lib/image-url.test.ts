import { describe, expect, it } from 'vitest';
import { safeImageUrl } from './image-url';

const app = 'http://localhost:5173';
const api = 'http://localhost:3000/api/v1';

describe('safeImageUrl', () => {
  it('supports the accepted same-origin production API base without allowing protocol-relative hosts', () => {
    expect(safeImageUrl('/uploads/pet.jpg', 'https://drgupet.ir', '/api/v1')).toBe('https://drgupet.ir/uploads/pet.jpg');
    expect(safeImageUrl('/brand/logo.webp', 'https://drgupet.ir', '/api/v1')).toBe('https://drgupet.ir/brand/logo.webp');
    expect(safeImageUrl('/uploads/pet.jpg', app, '//foreign.example/api/v1')).toBeNull();
    expect(safeImageUrl('/uploads/pet.jpg', app, '/\\foreign.example/api/v1')).toBeNull();
  });
  it('accepts and resolves app and backend-hosted images', () => {
    expect(safeImageUrl('/brand/logo.webp', app, api)).toBe('http://localhost:5173/brand/logo.webp');
    expect(safeImageUrl('/uploads/pet.jpg', app, api)).toBe(
      'http://localhost:3000/uploads/pet.jpg',
    );
    expect(safeImageUrl('http://localhost:3000/uploads/pet.jpg', app, api)).toBe(
      'http://localhost:3000/uploads/pet.jpg',
    );
    expect(safeImageUrl('http://localhost:5173/brand/logo.webp', app, api)).toBe(
      'http://localhost:5173/brand/logo.webp',
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
