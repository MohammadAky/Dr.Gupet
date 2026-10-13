import { describe, expect, it, vi } from 'vitest';
import type { Pet } from '../../api/types';
import { savePetWithTags } from './save';

describe('savePetWithTags', () => {
  it('does not continue with a tag request after the active account changes', async () => {
    const pet = { id: 42 } as Pet;
    let active = true;
    const petApi = {
      createPet: vi.fn().mockImplementation(async () => {
        active = false;
        return pet;
      }),
      updatePet: vi.fn(),
      setPetTags: vi.fn(),
    };
    const remember = vi.fn();
    await expect(
      savePetWithTags(
        petApi,
        null,
        { name: 'باران', petTypeId: 1 },
        { allergenTagIds: [], dietTagIds: [] },
        remember,
        undefined,
        () => active,
      ),
    ).rejects.toThrow('نشست کاربری تغییر کرده');
    expect(remember).not.toHaveBeenCalled();
    expect(petApi.setPetTags).not.toHaveBeenCalled();
  });
  it('keeps create inputs unchanged but sends explicit nullable fields when editing', async () => {
    const pet = { id: 42 } as Pet;
    const input = { name: 'باران', petTypeId: 1 };
    const update = { ...input, breedId: null, birthDate: null, gender: null, weightKg: null, photo: null };
    const tags = { allergenTagIds: [], dietTagIds: [] };
    const petApi = {
      createPet: vi.fn().mockResolvedValue(pet),
      updatePet: vi.fn().mockResolvedValue(pet),
      setPetTags: vi.fn().mockResolvedValue(pet),
    };
    await savePetWithTags(petApi, null, input, tags, () => {}, update);
    expect(petApi.createPet).toHaveBeenCalledExactlyOnceWith(input);
    await savePetWithTags(petApi, 42, input, tags, () => {}, update);
    expect(petApi.updatePet).toHaveBeenCalledExactlyOnceWith(42, update);
  });
  it('retains the created ID and updates that pet when a tag write is retried', async () => {
    const pet = { id: 42 } as Pet;
    const input = { name: 'مکس', petTypeId: 1 };
    const tags = { allergenTagIds: [2], dietTagIds: [3] };
    const createPet = vi.fn().mockResolvedValue(pet);
    const updatePet = vi.fn().mockResolvedValue(pet);
    const setPetTags = vi
      .fn()
      .mockRejectedValueOnce(new Error('tag write failed'))
      .mockResolvedValue(pet);
    const petApi = { createPet, updatePet, setPetTags };
    let retainedId: number | null = null;
    const rememberCreatedId = (id: number) => {
      retainedId = id;
    };

    const first = await savePetWithTags(petApi, retainedId, input, tags, rememberCreatedId);
    expect(first).toMatchObject({ pet, tagsSaved: false });
    expect(retainedId).toBe(42);

    const second = await savePetWithTags(petApi, retainedId, input, tags, rememberCreatedId);
    expect(second).toEqual({ pet, tagsSaved: true });
    expect(createPet).toHaveBeenCalledTimes(1);
    expect(updatePet).toHaveBeenCalledExactlyOnceWith(42, input);
    expect(setPetTags).toHaveBeenCalledTimes(2);
    expect(setPetTags).toHaveBeenLastCalledWith(42, tags);
  });
});
