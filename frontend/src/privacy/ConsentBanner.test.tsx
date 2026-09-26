// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConsentBanner } from './ConsentBanner';
import { readConsent } from './consent';

describe('first-layer cookie choices', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    localStorage.clear();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(async () => root.render(<ConsentBanner />));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it.each([
    ['Accept Cookies', 'accepted'],
    ['Deny Cookies', 'denied'],
  ])('saves %s with one click and dismisses the banner', async (label, choice) => {
    const button = Array.from(container.querySelectorAll('button')).find(
      (item) => item.textContent?.trim() === label,
    );
    expect(button).toBeDefined();
    await act(async () => button?.click());
    expect(readConsent()).toMatchObject({ choice });
    expect(container.querySelector('.privacy-banner')).toBeNull();
  });

  it('shows only two English choices, with no settings or policy link', () => {
    const banner = container.querySelector('.privacy-banner');
    expect(banner?.getAttribute('lang')).toBe('en');
    expect(banner?.getAttribute('dir')).toBe('ltr');
    expect(container.querySelectorAll('button')).toHaveLength(2);
    expect(container.querySelector('a')).toBeNull();
  });
});
