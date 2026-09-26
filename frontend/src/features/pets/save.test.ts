import { describe, expect, it, vi } from 'vitest';
import type { Pet } from '../../api/types';
import { savePetWithTags } from './save';

describe('savePetWithTags', () => {
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
