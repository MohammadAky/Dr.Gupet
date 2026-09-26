import { requestData } from './client';
import type {
  Address,
  AuthResult,
  Breed,
  HealthResult,
  OtpRequestResult,
  Pet,
  PetType,
  Tag,
  TokenPair,
  UploadResult,
  UserProfile,
} from './types';
import type { TagType } from './types';

/** Inputs mirror the backend DTOs (class-validator rules are duplicated in lib/schemas.ts). */
export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  avatar?: string;
}

export interface CreateAddressInput {
  title: string;
  receiverName: string;
  receiverPhone: string;
  province: string;
  city: string;
  fullAddress: string;
  postalCode?: string;
  lat?: number;
  lng?: number;
}

export type UpdateAddressInput = Partial<CreateAddressInput>;

export interface CreatePetInput {
  name: string;
  petTypeId: number;
  breedId?: number;
  birthDate?: string;
  gender?: 'MALE' | 'FEMALE';
  isNeutered?: boolean;
  weightKg?: number;
  photo?: string;
}

export type UpdatePetInput = Partial<CreatePetInput>;

export interface SetPetTagsInput {
  allergenTagIds: number[];
  dietTagIds: number[];
}

/** Session, profile, addresses, upload, reference data and pets. */
export const api = {
  health: () => requestData<HealthResult>('/health', { auth: false }),

  requestOtp: (phone: string) =>
    requestData<OtpRequestResult>('/auth/otp/request', {
      method: 'POST',
      body: { phone },
      auth: false,
    }),

  verifyOtp: (phone: string, code: string) =>
    requestData<AuthResult>('/auth/otp/verify', {
      method: 'POST',
      body: { phone, code },
      auth: false,
    }),

  refresh: (refreshToken: string) =>
    requestData<TokenPair>('/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
      auth: false,
    }),

  logout: (refreshToken: string) =>
    requestData<{ ok: true }>('/auth/logout', { method: 'POST', body: { refreshToken } }),

  me: () => requestData<UserProfile>('/users/me'),

  updateMe: (body: UpdateProfileInput) =>
    requestData<UserProfile>('/users/me', { method: 'PATCH', body }),

  listAddresses: () => requestData<Address[]>('/addresses'),

  createAddress: (body: CreateAddressInput) =>
    requestData<Address>('/addresses', { method: 'POST', body }),

  updateAddress: (id: number, body: UpdateAddressInput) =>
    requestData<Address>(`/addresses/${id}`, { method: 'PATCH', body }),

  setDefaultAddress: (id: number) =>
    requestData<Address>(`/addresses/${id}/default`, { method: 'PATCH' }),

  deleteAddress: (id: number) => requestData<void>(`/addresses/${id}`, { method: 'DELETE' }),

  uploadImage: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return requestData<UploadResult>('/upload/image', { method: 'POST', formData });
  },

  petTypes: () => requestData<PetType[]>('/pet-types'),

  breeds: (petTypeId: number) => requestData<Breed[]>(`/pet-types/${petTypeId}/breeds`),

  tags: (type?: TagType) => requestData<Tag[]>('/tags', { query: { type } }),

  listPets: () => requestData<Pet[]>('/pets'),

  getPet: (id: number) => requestData<Pet>(`/pets/${id}`),

  createPet: (body: CreatePetInput) => requestData<Pet>('/pets', { method: 'POST', body }),

  updatePet: (id: number, body: UpdatePetInput) =>
    requestData<Pet>(`/pets/${id}`, { method: 'PATCH', body }),

  setPetTags: (id: number, body: SetPetTagsInput) =>
    requestData<Pet>(`/pets/${id}/tags`, { method: 'PUT', body }),

  deletePet: (id: number) => requestData<void>(`/pets/${id}`, { method: 'DELETE' }),
};
