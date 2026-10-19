import { requestData } from './client';

export interface StorefrontPopup {
  enabled: boolean;
  title: string;
  body: string;
  image: string;
}

export const storefrontApi = {
  popup: () => requestData<StorefrontPopup>('/storefront/popup', { auth: false }),
};

export function validPopup(value: unknown): value is StorefrontPopup {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return item.enabled === true && typeof item.title === 'string' && item.title.length <= 90 &&
    typeof item.body === 'string' && item.body.length <= 800 &&
    typeof item.image === 'string' && item.image.length <= 500 &&
    /^(?:|\/(?:brand|uploads)\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*\.(?:webp|png|jpe?g))$/.test(item.image) &&
    Boolean(item.title.trim() || item.body.trim() || item.image);
}
