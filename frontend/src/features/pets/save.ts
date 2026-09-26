import type { CreatePetInput, SetPetTagsInput } from '../../api/endpoints';
import type { Pet } from '../../api/types';

interface PetSaveApi {
  createPet: (input: CreatePetInput) => Promise<Pet>;
  updatePet: (id: number, input: CreatePetInput) => Promise<Pet>;
  setPetTags: (id: number, tags: SetPetTagsInput) => Promise<Pet>;
}

export type PetSaveResult =
  { pet: Pet; tagsSaved: true } | { pet: Pet; tagsSaved: false; tagError: unknown };

/** Retain a newly created ID before the separate tag write, so a retry updates the same pet. */
export async function savePetWithTags(
  petApi: PetSaveApi,
  petId: number | null,
  input: CreatePetInput,
  tags: SetPetTagsInput,
  rememberCreatedId: (id: number) => void,
): Promise<PetSaveResult> {
  const pet = petId === null ? await petApi.createPet(input) : await petApi.updatePet(petId, input);
  if (petId === null) rememberCreatedId(pet.id);

  try {
    await petApi.setPetTags(pet.id, tags);
    return { pet, tagsSaved: true };
  } catch (tagError) {
    return { pet, tagsSaved: false, tagError };
  }
}
