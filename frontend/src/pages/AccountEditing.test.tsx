// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { api } from '../api/endpoints';
import { shopApi } from '../api/endpoints-shop';
import type { Address, OrderDetail, Pet, UserProfile } from '../api/types';
import { AddressEditPage } from './AddressEditPage';
import { PetEditPage } from './PetEditPage';
import { ProfilePage } from './ProfilePage';
import { PetDetailPage } from './PetDetailPage';
import { OrderDetailPage } from './OrderDetailPage';
import {
  clearCheckoutIntent,
  readCheckoutIntent,
  writeCheckoutIntent,
} from '../features/checkout/intent';

const { applyProfile } = vi.hoisted(() => ({ applyProfile: vi.fn() }));
vi.mock('../auth/auth-provider', () => ({
  useAuth: () => ({ status: authUser ? 'authed' : 'guest', user: authUser, applyProfile }),
}));
vi.mock('../components/PasswordChange', () => ({ PasswordChange: () => null }));
vi.mock('../api/endpoints', () => ({
  api: {
    listAddresses: vi.fn(),
    updateAddress: vi.fn(),
    createAddress: vi.fn(),
    petTypes: vi.fn(),
    tags: vi.fn(),
    breeds: vi.fn(),
    getPet: vi.fn(),
    updatePet: vi.fn(),
    createPet: vi.fn(),
    setPetTags: vi.fn(),
    updateMe: vi.fn(),
    uploadImage: vi.fn(),
  },
}));
vi.mock('../api/endpoints-shop', () => ({
  shopApi: { order: vi.fn(), cancelOrder: vi.fn(), startPayment: vi.fn() },
}));

const profile: UserProfile = {
  id: 1,
  firstName: 'سارا',
  lastName: 'احمدی',
  phone: '09120000000',
  username: 'sara',
  avatar: null,
  role: 'USER',
  createdAt: '',
  updatedAt: '',
};
let authUser: UserProfile | null = profile;
const address: Address = {
  id: 10,
  userId: 1,
  title: 'خانه',
  receiverName: 'سارا',
  receiverPhone: '09120000000',
  province: 'خراسان رضوی',
  city: 'مشهد',
  fullAddress: 'خیابان نمونه پلاک ۱۰',
  postalCode: '1234567890',
  lat: null,
  lng: null,
  isDefault: true,
  createdAt: '',
  updatedAt: '',
};
const pet: Pet = {
  id: 5,
  userId: 1,
  name: 'باران',
  petTypeId: 1,
  breedId: 2,
  birthDate: '2020-01-01T00:00:00.000Z',
  gender: 'FEMALE',
  isNeutered: false,
  weightKg: 3,
  photo: '/uploads/pet.jpg',
  deletedAt: null,
  createdAt: '',
  updatedAt: '',
  petType: { id: 1, name: 'گربه', slug: 'cat' },
  breed: { id: 2, name: 'پرشین' },
  tags: [{ id: 3, name: 'مرغ', slug: 'chicken', type: 'ALLERGEN' }],
  lifeStage: 'ADULT',
};
const order: OrderDetail = {
  id: 7,
  orderNumber: 'ORDER-7',
  userId: 1,
  status: 'PENDING_PAYMENT',
  addressSnapshot: address,
  shippingMethod: null,
  trackingCode: null,
  shippedAt: null,
  deliveredAt: null,
  note: null,
  couponId: null,
  createdAt: '2026-10-01T12:00:00Z',
  updatedAt: '',
  items: [],
  payments: [],
  itemsTotal: 100000,
  discountAmount: 0,
  shippingCost: 0,
  finalAmount: 100000,
};

let root: Root;
let container: HTMLDivElement;
let client: QueryClient;
function CurrentPath() {
  return <output data-testid="path">{useLocation().pathname}</output>;
}
async function mount(path: string, element: ReactNode, route: string) {
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path={route} element={element} />
            <Route path="*" element={<p>بازگشت</p>} />
          </Routes>
          <CurrentPath />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
}
async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}
async function fill(id: string, value: string) {
  await act(async () => {
    const input = container.querySelector<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >(`#${id}`)!;
    const prototype =
      input instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : input instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(
      new Event(input instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }),
    );
  });
}
async function submit() {
  await act(async () => {
    container
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.resetAllMocks();
  authUser = profile;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  vi.mocked(api.listAddresses).mockResolvedValue([address]);
  vi.mocked(api.updateAddress).mockResolvedValue(address);
  vi.mocked(api.petTypes).mockResolvedValue([pet.petType]);
  vi.mocked(api.tags).mockImplementation(async (type) => (type === 'ALLERGEN' ? pet.tags : []));
  vi.mocked(api.breeds).mockResolvedValue([pet.breed!]);
  vi.mocked(api.getPet).mockResolvedValue(pet);
  vi.mocked(api.updatePet).mockResolvedValue(pet);
  vi.mocked(api.setPetTags).mockResolvedValue(pet);
  vi.mocked(api.updateMe).mockResolvedValue(profile);
  vi.mocked(shopApi.order).mockResolvedValue(order);
});
afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  container.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('blocks address editing after a failed GET and restores the form through retry', async () => {
  vi.mocked(api.listAddresses).mockRejectedValueOnce(new Error('دریافت نشانی ناموفق بود'));
  await mount('/addresses/10/edit', <AddressEditPage />, '/addresses/:id/edit');
  await flush();
  expect(container.querySelector('form')).toBeNull();
  expect(container.textContent).toContain('دریافت نشانی ناموفق بود');
  const retry = Array.from(container.querySelectorAll('button')).find(
    (node) => node.textContent === 'تلاش دوباره',
  )!;
  await act(async () => retry.click());
  await flush();
  expect(container.querySelector<HTMLInputElement>('#title')!.value).toBe('خانه');
  expect(api.updateAddress).not.toHaveBeenCalled();
});

it('sends explicit null when an existing postal code is cleared', async () => {
  await mount('/addresses/10/edit', <AddressEditPage />, '/addresses/:id/edit');
  await flush();
  await fill('postalCode', '');
  await submit();
  expect(api.updateAddress).toHaveBeenCalledWith(10, expect.objectContaining({ postalCode: null }));
});

it('rejects a whitespace-only address and normalizes Persian postal digits', async () => {
  await mount('/addresses/10/edit', <AddressEditPage />, '/addresses/:id/edit');
  await flush();
  await fill('fullAddress', '   ');
  await submit();
  expect(api.updateAddress).not.toHaveBeenCalled();
  expect(container.textContent).toContain('نشانی کامل را وارد کنید');
  await vi.waitFor(() => expect(document.activeElement?.id).toBe('fullAddress'));
  await act(async () => {
    const input = container.querySelector<HTMLTextAreaElement>('#fullAddress')!;
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(
      input,
      '  خیابان نمونه  ',
    );
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await fill('postalCode', '۱۲۳۴۵۶۷۸۹۰');
  expect(container.querySelector('#fullAddress')?.getAttribute('aria-invalid')).not.toBe('true');
  await submit();
  expect(api.updateAddress).toHaveBeenCalledWith(
    10,
    expect.objectContaining({ fullAddress: 'خیابان نمونه', postalCode: '1234567890' }),
  );
});

it('blocks pet saves while tag options failed instead of accidentally replacing existing tags', async () => {
  vi.mocked(api.tags).mockRejectedValue(new Error('برچسب‌ها دریافت نشدند'));
  await mount('/pets/5/edit', <PetEditPage />, '/pets/:id/edit');
  await flush();
  expect(container.querySelector('form')).toBeNull();
  expect(container.textContent).toContain('برای حفظ اطلاعات حیوان');
  expect(api.updatePet).not.toHaveBeenCalled();
  expect(api.setPetTags).not.toHaveBeenCalled();
});

it('waits for a pet upload before saving and sends the completed image URL', async () => {
  const upload = deferred<{ url: string }>();
  vi.mocked(api.uploadImage).mockReturnValue(upload.promise);
  await mount('/pets/5/edit', <PetEditPage />, '/pets/:id/edit');
  await flush();
  const input = container.querySelector<HTMLInputElement>('#petPhoto')!;
  await act(async () => {
    Object.defineProperty(input, 'files', {
      value: [new File(['photo'], 'cat.webp', { type: 'image/webp' })],
    });
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
  await submit();
  expect(api.updatePet).not.toHaveBeenCalled();
  await act(async () => upload.resolve({ url: '/uploads/new-cat.webp' }));
  await submit();
  expect(api.updatePet).toHaveBeenCalledWith(
    5,
    expect.objectContaining({ photo: '/uploads/new-cat.webp' }),
  );
});

it('clears optional pet fields and a saved birthday using explicit nulls', async () => {
  await mount('/pets/5/edit', <PetEditPage />, '/pets/:id/edit');
  await flush();
  await fill('breed', '');
  await fill('gender', '');
  await fill('weightKg', '');
  await fill('birthDate', '');
  await submit();
  expect(api.updatePet).toHaveBeenCalledWith(
    5,
    expect.objectContaining({ breedId: null, birthDate: null, gender: null, weightKg: null }),
  );
});

it('keeps submitted pet fields and tags locked during a slow save and restores them after failure', async () => {
  let reject!: (error: Error) => void;
  vi.mocked(api.updatePet).mockReturnValue(
    new Promise((_, fail) => {
      reject = fail;
    }),
  );
  await mount('/pets/5/edit', <PetEditPage />, '/pets/:id/edit');
  await flush();
  await fill('petName', 'نام تازه');
  await submit();
  await flush();
  for (const id of ['petName', 'petType', 'breed', 'birthDate', 'gender', 'weightKg', 'petPhoto']) {
    expect(container.querySelector<HTMLInputElement>(`#${id}`)!.disabled).toBe(true);
  }
  for (const checkbox of container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')) {
    expect(checkbox.disabled).toBe(true);
  }
  expect(api.updatePet).toHaveBeenCalledWith(5, expect.objectContaining({ name: 'نام تازه' }));
  await act(async () => reject(new Error('ذخیره حیوان ناموفق بود')));
  await flush();
  expect(container.querySelector<HTMLInputElement>('#petName')!.disabled).toBe(false);
  expect(container.querySelector<HTMLInputElement>('#petName')!.value).toBe('نام تازه');
  expect(api.setPetTags).not.toHaveBeenCalled();
  expect(container.querySelector('[role="alert"]')?.textContent).toContain(
    'ذخیره حیوان ناموفق بود',
  );
});

it('offers a Persian image picker and lets the same file be retried after an upload failure', async () => {
  vi.mocked(api.uploadImage)
    .mockRejectedValueOnce(new Error('بارگذاری ناموفق بود'))
    .mockResolvedValueOnce({ url: '/uploads/retried-avatar.webp' });
  await mount('/profile', <ProfilePage />, '/profile');
  await flush();
  const input = container.querySelector<HTMLInputElement>('#avatar')!;
  const picker = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
    (button) => button.textContent === 'انتخاب تصویر پروفایل',
  )!;
  const click = vi.spyOn(input, 'click');
  await act(async () => picker.click());
  expect(click).toHaveBeenCalledOnce();
  expect(input.hidden).toBe(true);
  expect(picker.getAttribute('aria-describedby')).toBe('avatar-hint');
  const file = new File(['photo'], 'avatar.webp', { type: 'image/webp' });
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));
  await flush();
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('بارگذاری ناموفق بود');
  expect(container.querySelector('.image-picker__filename')?.textContent).toBe('avatar.webp');
  expect(input.value).toBe('');
  expect(picker.disabled).toBe(false);
  await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));
  await flush();
  await submit();
  expect(api.uploadImage).toHaveBeenCalledTimes(2);
  expect(api.updateMe).toHaveBeenCalledWith(
    expect.objectContaining({ avatar: '/uploads/retried-avatar.webp' }),
  );
});

it('locks profile save during upload and persists intentionally cleared names', async () => {
  const upload = deferred<{ url: string }>();
  vi.mocked(api.uploadImage).mockReturnValue(upload.promise);
  await mount('/profile', <ProfilePage />, '/profile');
  await flush();
  await fill('firstName', '');
  await fill('lastName', '');
  const input = container.querySelector<HTMLInputElement>('#avatar')!;
  await act(async () => {
    Object.defineProperty(input, 'files', {
      value: [new File(['photo'], 'avatar.webp', { type: 'image/webp' })],
    });
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await submit();
  expect(api.updateMe).not.toHaveBeenCalled();
  expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
  await act(async () => upload.resolve({ url: '/uploads/new-avatar.webp' }));
  await submit();
  expect(api.updateMe).toHaveBeenCalledWith({
    firstName: '',
    lastName: '',
    avatar: '/uploads/new-avatar.webp',
  });
});

it('keeps the submitted profile draft stable during a slow save and unlocks it after failure', async () => {
  let reject!: (error: Error) => void;
  vi.mocked(api.updateMe).mockReturnValue(
    new Promise((_, fail) => {
      reject = fail;
    }),
  );
  await mount('/profile', <ProfilePage />, '/profile');
  await fill('firstName', 'نام تازه');
  await submit();
  await flush();
  expect(container.querySelector<HTMLInputElement>('#firstName')!.disabled).toBe(true);
  expect(container.querySelector<HTMLInputElement>('#lastName')!.disabled).toBe(true);
  expect(api.updateMe).toHaveBeenCalledWith(expect.objectContaining({ firstName: 'نام تازه' }));
  await act(async () => reject(new Error('ذخیره ناموفق بود')));
  await flush();
  expect(container.querySelector<HTMLInputElement>('#firstName')!.disabled).toBe(false);
  expect(container.querySelector<HTMLInputElement>('#firstName')!.value).toBe('نام تازه');
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('ذخیره ناموفق بود');
});

it('locks all submitted address fields until the save resolves', async () => {
  const pending = deferred<Address>();
  vi.mocked(api.updateAddress).mockReturnValue(pending.promise);
  await mount('/addresses/10/edit', <AddressEditPage />, '/addresses/:id/edit');
  await flush();
  await submit();
  await flush();
  for (const id of [
    'title',
    'receiverName',
    'receiverPhone',
    'province',
    'city',
    'fullAddress',
    'postalCode',
  ]) {
    expect(container.querySelector<HTMLInputElement>(`#${id}`)!.disabled).toBe(true);
  }
  await act(async () => pending.resolve(address));
  await flush();
  expect(container.querySelector('output')?.textContent).toBe('/addresses');
});

it.each([
  ['/pets/not-a-number', '/pets/:id', <PetDetailPage />],
  ['/orders/0', '/orders/:id', <OrderDetailPage />],
])('shows a useful error and backlink for invalid detail URL %s', async (path, route, element) => {
  await mount(path as string, element as ReactNode, route as string);
  await flush();
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('معتبر نیست');
  expect(api.getPet).not.toHaveBeenCalled();
  expect(shopApi.order).not.toHaveBeenCalled();
});

it('shows the saved pet image on the detail route', async () => {
  await mount('/pets/5', <PetDetailPage />, '/pets/:id');
  await flush();
  expect(container.querySelector<HTMLImageElement>('img[alt="باران"]')?.src).toContain(
    '/uploads/pet.jpg',
  );
});

it('requires cancel confirmation and locks payment while cancellation is in progress', async () => {
  const pending = deferred<OrderDetail>();
  vi.mocked(shopApi.cancelOrder).mockReturnValue(pending.promise);
  await mount('/orders/7', <OrderDetailPage />, '/orders/:id');
  await flush();
  const cancel = Array.from(container.querySelectorAll('button')).find(
    (node) => node.textContent === 'لغو سفارش',
  )!;
  const pay = Array.from(container.querySelectorAll('button')).find(
    (node) => node.textContent === 'پرداخت',
  )!;
  await act(async () => cancel.click());
  expect(shopApi.cancelOrder).not.toHaveBeenCalled();
  await act(async () =>
    [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')]
      .find((button) => button.textContent === 'انصراف')!
      .click(),
  );
  expect(shopApi.cancelOrder).not.toHaveBeenCalled();
  await act(async () => cancel.click());
  await act(async () => {
    [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')]
      .find((button) => button.textContent === 'لغو این سفارش')!
      .click();
    pay.click();
    cancel.click();
  });
  expect(shopApi.cancelOrder).toHaveBeenCalledExactlyOnceWith(7);
  expect(shopApi.startPayment).not.toHaveBeenCalled();
  expect(pay.disabled).toBe(true);
  await act(async () => pending.resolve({ ...order, status: 'CANCELED' }));
});

it('keeps an order cancellation open on failure and closes only after a successful retry', async () => {
  let rejectFirst!: (error: Error) => void;
  const retry = deferred<OrderDetail>();
  vi.mocked(shopApi.cancelOrder)
    .mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectFirst = reject;
      }),
    )
    .mockReturnValueOnce(retry.promise);
  await mount('/orders/7', <OrderDetailPage />, '/orders/:id');
  await flush();
  const cancel = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
    (node) => node.textContent === 'لغو سفارش',
  )!;
  const confirm = () =>
    [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(
      (node) => node.textContent === 'لغو این سفارش',
    )!;
  await act(async () => cancel.click());
  await act(async () => {
    confirm().click();
    confirm().click();
  });
  expect(shopApi.cancelOrder).toHaveBeenCalledTimes(1);
  expect(confirm().disabled).toBe(true);
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain('ORDER-7');
  await act(async () => rejectFirst(new Error('لغو انجام نشد')));
  await flush();
  expect(document.querySelector('[role="dialog"] [role="alert"]')?.textContent).toBe(
    'لغو انجام نشد',
  );
  expect(confirm().disabled).toBe(false);
  await act(async () => confirm().click());
  const canceled = { ...order, status: 'CANCELED' as const };
  vi.mocked(shopApi.order).mockResolvedValue(canceled);
  await act(async () => retry.resolve(canceled));
  await flush();
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(container.textContent).toContain('سفارش لغو شد.');
  expect(shopApi.cancelOrder).toHaveBeenCalledTimes(2);
});

it('returns a saved address to checkout without losing the in-memory draft or trusting foreign redirects', async () => {
  clearCheckoutIntent();
  writeCheckoutIntent(1, { couponCode: 'SAVE', note: 'تحویل عصر' });
  vi.mocked(api.createAddress).mockResolvedValue({ ...address, id: 99 });
  await mount('/addresses/new?next=%2Fcheckout', <AddressEditPage />, '/addresses/new');
  await flush();
  for (const [key, value] of Object.entries({
    title: 'خانه',
    receiverName: 'سارا',
    receiverPhone: '09120000000',
    province: 'خراسان',
    city: 'مشهد',
    fullAddress: 'خیابان نمونه',
  }))
    await fill(key, value);
  await submit();
  await flush();
  expect(container.querySelector('output')?.textContent).toBe('/checkout');
  expect(readCheckoutIntent(1)).toEqual({ couponCode: 'SAVE', note: 'تحویل عصر', addressId: 99 });
  clearCheckoutIntent();
});

it.each([
  ['/addresses/10/edit', '/addresses/:id/edit', <AddressEditPage />, 'updateAddress'],
  ['/pets/5/edit', '/pets/:id/edit', <PetEditPage />, 'updatePet'],
  ['/profile', '/profile', <ProfilePage />, 'updateMe'],
])('prevents same-tick duplicate saves on %s', async (path, route, element, method) => {
  const mutation = api[method as 'updateAddress' | 'updatePet' | 'updateMe'];
  vi.mocked(mutation).mockReturnValue(new Promise<never>(() => {}));
  await mount(path as string, element as ReactNode, route as string);
  await flush();
  if (method === 'updatePet') await flush();
  await act(async () => {
    const form = container.querySelector('form')!;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  expect(mutation).toHaveBeenCalledTimes(1);
});

it('does not navigate or invalidate another session when an old address save completes', async () => {
  const pending = deferred<Address>();
  vi.mocked(api.updateAddress).mockReturnValue(pending.promise);
  await mount('/addresses/10/edit', <AddressEditPage />, '/addresses/:id/edit');
  await flush();
  await submit();
  authUser = null;
  await mount('/addresses/10/edit', <AddressEditPage />, '/addresses/:id/edit');
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  await act(async () => pending.resolve(address));
  expect(invalidate).not.toHaveBeenCalled();
  expect(container.querySelector('output')?.textContent).toBe('/addresses/10/edit');
  expect(container.querySelector('form')).toBeNull();
});

it('does not send the second pet-tag write if the account changes during pet creation', async () => {
  const pending = deferred<Pet>();
  vi.mocked(api.createPet).mockReturnValue(pending.promise);
  await mount('/pets/new', <PetEditPage />, '/pets/new');
  await flush();
  await fill('petName', 'باران');
  await fill('petType', '1');
  await flush();
  await submit();
  expect(api.createPet).toHaveBeenCalledTimes(1);
  authUser = null;
  await mount('/pets/new', <PetEditPage />, '/pets/new');
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  await act(async () => pending.resolve(pet));
  expect(api.setPetTags).not.toHaveBeenCalled();
  expect(invalidate).not.toHaveBeenCalled();
  expect(container.querySelector('output')?.textContent).toBe('/pets/new');
});

it('resets profile drafts and ignores an upload from a previous account', async () => {
  const pending = deferred<{ url: string }>();
  vi.mocked(api.uploadImage).mockReturnValue(pending.promise);
  await mount('/profile', <ProfilePage />, '/profile');
  await flush();
  await fill('firstName', 'اطلاعات حساب قبلی');
  await act(async () => {
    const input = container.querySelector<HTMLInputElement>('#avatar')!;
    Object.defineProperty(input, 'files', {
      value: [new File(['photo'], 'old.webp', { type: 'image/webp' })],
    });
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  authUser = { ...profile, id: 2, firstName: 'حساب تازه', avatar: null };
  await mount('/profile', <ProfilePage />, '/profile');
  await act(async () => pending.resolve({ url: '/uploads/old-account.webp' }));
  expect(container.querySelector<HTMLInputElement>('#firstName')?.value).toBe('حساب تازه');
  expect(container.querySelector('img')).toBeNull();
  expect(applyProfile).not.toHaveBeenCalled();
});

it('ignores a delayed payment result after logout without writing a pending marker', async () => {
  const pending = deferred<{ paymentUrl: string }>();
  vi.mocked(shopApi.startPayment).mockReturnValue(pending.promise);
  await mount('/orders/7', <OrderDetailPage />, '/orders/:id');
  await flush();
  const pay = [...container.querySelectorAll('button')].find(
    (node) => node.textContent === 'پرداخت',
  )!;
  await act(async () => pay.click());
  authUser = null;
  await mount('/orders/7', <OrderDetailPage />, '/orders/:id');
  const store = vi.spyOn(Storage.prototype, 'setItem');
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  await act(async () =>
    pending.resolve({ paymentUrl: 'https://www.zarinpal.com/pg/StartPay/123' }),
  );
  expect(store).not.toHaveBeenCalled();
  expect(invalidate).not.toHaveBeenCalled();
  expect(container.querySelector('output')?.textContent).toBe('/orders/7');
});
