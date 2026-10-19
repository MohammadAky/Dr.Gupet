// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { shopApi } from '../api/endpoints-shop';
import { api } from '../api/endpoints';
import { DirectoryPage } from './DirectoryPage';
import { MedicinesPage } from '../pages/MedicinesPage';

vi.mock('../api/endpoints-shop', () => ({ shopApi: { clinics: vi.fn(), pharmacies: vi.fn(), medicines: vi.fn() } }));
vi.mock('../api/endpoints', () => ({ api: { petTypes: vi.fn() } }));
const empty = { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } };
let phone = false;
let resize: (() => void) | undefined;
let root: Root;
let host: HTMLDivElement;
let client: QueryClient;
beforeEach(() => {
  phone = false; resize = undefined;
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.mocked(shopApi.clinics).mockResolvedValue(empty);
  vi.mocked(shopApi.pharmacies).mockResolvedValue(empty);
  vi.mocked(shopApi.medicines).mockResolvedValue(empty);
  vi.mocked(api.petTypes).mockResolvedValue([{ id: 1, name: 'گربه', slug: 'cat' }, { id: 2, name: 'سگ', slug: 'dog' }]);
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: phone, addEventListener: (_: string, listener: () => void) => { resize = listener; }, removeEventListener: vi.fn() })));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); client.clear(); vi.resetAllMocks(); vi.unstubAllGlobals(); });
function Location() { return <output data-location>{useLocation().search}</output>; }
async function show(kind: 'clinics' | 'pharmacies' | 'medicines', query = '') {
  await act(async () => root.render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[`/${kind}${query}`]}>
    {kind === 'medicines' ? <MedicinesPage /> : <DirectoryPage kind={kind} />}<Location />
  </MemoryRouter></QueryClientProvider>));
}
function button(name: string | RegExp, scope: ParentNode = document) {
  const found = Array.from(scope.querySelectorAll('button')).find(node => typeof name === 'string' ? node.textContent === name : name.test(node.textContent ?? ''));
  if (!found) throw new Error(`Missing button: ${name}`);
  return found;
}
function input(label: string) {
  const field = Array.from(document.querySelectorAll('label')).find(node => node.textContent === label);
  const control = field && document.getElementById(field.htmlFor);
  if (!(control instanceof HTMLInputElement)) throw new Error(`Missing input: ${label}`);
  return control;
}
async function click(node: HTMLElement) { await act(async () => node.click()); }
async function type(node: HTMLInputElement, value: string) {
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(node, value); node.dispatchEvent(new Event('input', { bubbles: true })); });
}
async function submit(node: HTMLElement) { await act(async () => node.closest('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))); }

it('opens one desktop location section, retains typed values and submits only supported venue filters', async () => {
  await show('clinics', '?page=2');
  await vi.waitFor(() => expect(shopApi.clinics).toHaveBeenCalled());
  expect(document.querySelectorAll('[role="region"]:not([hidden])')).toHaveLength(0);
  await click(button('استان'));
  await type(input('استان'), 'تهران');
  await click(button('شهر'));
  expect(input('استان').closest('[role="region"]')?.hasAttribute('hidden')).toBe(true);
  const city = input('شهر'); await type(city, 'شهر تازه'); await submit(city);
  await vi.waitFor(() => expect(shopApi.clinics).toHaveBeenLastCalledWith({ province: 'تهران', city: 'شهر تازه', is24h: undefined, page: 1 }));
  expect(input('شهر')).toBe(city);
  await click(button(/پاک‌کردن فیلترها/));
  await vi.waitFor(() => expect(document.querySelector('[data-location]')?.textContent).toBe(''));
});

it('opens the pharmacy mobile drawer from a chip and preserves false duty through submit and dismissal', async () => {
  phone = true; await show('pharmacies', '?onDuty=false&page=3');
  await vi.waitFor(() => expect(shopApi.pharmacies).toHaveBeenCalled());
  expect(document.querySelector('aside')).toBeNull();
  const chip = button('وضعیت کشیک · غیرکشیک'); chip.focus(); await click(chip);
  const dialog = document.querySelector('[role="dialog"]')!;
  expect(dialog.querySelector('[role="combobox"][aria-label="وضعیت کشیک"]')).not.toBeNull();
  await click(button('نمایش نتایج', dialog));
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(document.activeElement).toBe(chip);
  expect(shopApi.pharmacies).toHaveBeenLastCalledWith({ city: undefined, province: undefined, is24h: undefined, page: 1, onDuty: false });
  await click(chip);
  await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(document.querySelector('[data-location]')?.textContent).toBe('?onDuty=false');
});

it('retains medicine search, species and prescription URL filters without invented stock or prices', async () => {
  await show('medicines', '?q=دارو&petTypeId=1&requiresPrescription=1&page=4');
  await vi.waitFor(() => expect(shopApi.medicines).toHaveBeenCalledWith({ q: 'دارو', petTypeId: 1, requiresPrescription: true, page: 4 }));
  await click(button(/جستجوی دارو/));
  const search = input('نام دارو یا مادهٔ مؤثره'); await type(search, 'داروی تازه'); await submit(search);
  await vi.waitFor(() => expect(shopApi.medicines).toHaveBeenCalledWith({ q: 'داروی تازه', petTypeId: 1, requiresPrescription: true, page: 1 }));
  expect(host.textContent).not.toContain('محدودهٔ قیمت'); expect(host.textContent).not.toContain('فقط موجود');
  await click(button(/پاک‌کردن فیلترها/));
  await vi.waitFor(() => expect(shopApi.medicines).toHaveBeenCalledWith({ q: undefined, petTypeId: undefined, requiresPrescription: undefined, page: 1 }));
});

it('uses one responsive form and cleans up the drawer lock when returning to desktop', async () => {
  phone = true; await show('clinics'); await click(button('استان'));
  expect(document.body.style.overflow).toBe('hidden'); phone = false;
  await act(async () => resize?.());
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(document.body.style.overflow).not.toBe('hidden');
  expect(document.querySelector('aside[aria-label="فیلتر کلینیک‌ها"]')).not.toBeNull();
  expect(document.querySelectorAll('form')).toHaveLength(1);
});
