import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, type CreatePetInput, type SetPetTagsInput } from '../api/endpoints';
import { queryKeys } from '../api/query-keys';
import { Field } from '../components/Field';
import { ErrorState, LoadingState } from '../components/states';
import { toEnDigits } from '../lib/format';
import { todayIso } from '../lib/jalali';
import { petSchema, validateUploadFile } from '../lib/schemas';
import { errorText } from '../lib/labels';
import { API_BASE_URL } from '../lib/env';
import { safeImageUrl } from '../lib/image-url';
import { savePetWithTags } from '../features/pets/save';

interface FormState {
  name: string;
  petTypeId: number;
  breedId: number | null;
  birthDate: string;
  gender: '' | 'MALE' | 'FEMALE';
  isNeutered: boolean;
  weightKg: string;
  photo: string | null;
}

const EMPTY_FORM: FormState = {
  name: '',
  petTypeId: 0,
  breedId: null,
  birthDate: '',
  gender: '',
  isNeutered: false,
  weightKg: '',
  photo: null,
};

/** Create / edit a pet (F4): type→breed cascade, Jalali-safe dates, tags replace. */
export function PetEditPage() {
  const { id } = useParams();
  const editingId = id ? Number(id) : null;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [allergenIds, setAllergenIds] = useState<number[]>([]);
  const [dietIds, setDietIds] = useState<number[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [partialPetId, setPartialPetId] = useState<number | null>(null);
  const photoUrl = safeImageUrl(form.photo, window.location.origin, API_BASE_URL);
  const initialized = useRef(false);
  const createdPetId = useRef<number | null>(null);

  const petTypes = useQuery({ queryKey: queryKeys.petTypes, queryFn: () => api.petTypes() });
  const allergenTags = useQuery({
    queryKey: queryKeys.tags('ALLERGEN'),
    queryFn: () => api.tags('ALLERGEN'),
  });
  const dietTags = useQuery({ queryKey: queryKeys.tags('DIET'), queryFn: () => api.tags('DIET') });
  const breeds = useQuery({
    queryKey: queryKeys.breeds(form.petTypeId),
    queryFn: () => api.breeds(form.petTypeId),
    enabled: form.petTypeId > 0,
  });
  const existing = useQuery({
    queryKey: queryKeys.pet(editingId ?? -1),
    queryFn: () => api.getPet(editingId as number),
    enabled: editingId !== null,
  });

  useEffect(() => {
    const pet = existing.data;
    if (!pet || initialized.current) return;
    initialized.current = true;
    setForm({
      name: pet.name,
      petTypeId: pet.petTypeId,
      breedId: pet.breedId,
      birthDate: pet.birthDate ? pet.birthDate.slice(0, 10) : '',
      gender: pet.gender ?? '',
      isNeutered: pet.isNeutered,
      weightKg: pet.weightKg === null ? '' : String(pet.weightKg),
      photo: pet.photo,
    });
    setAllergenIds(pet.tags.filter((tag) => tag.type === 'ALLERGEN').map((tag) => tag.id));
    setDietIds(pet.tags.filter((tag) => tag.type === 'DIET').map((tag) => tag.id));
  }, [existing.data]);

  const save = useMutation({
    mutationFn: ({ input, tags }: { input: CreatePetInput; tags: SetPetTagsInput }) =>
      savePetWithTags(api, editingId ?? createdPetId.current, input, tags, (createdId) => {
        createdPetId.current = createdId;
      }),
    onSuccess: (result) => {
      const { pet } = result;
      void queryClient.invalidateQueries({ queryKey: queryKeys.pets });
      void queryClient.invalidateQueries({ queryKey: queryKeys.pet(pet.id) });
      if (!result.tagsSaved) {
        setPartialPetId(pet.id);
        setFailure(
          `اطلاعات حیوان ذخیره شد، اما برچسب‌ها ذخیره نشدند. دوباره ذخیره کنید؛ حیوان تازه‌ای ساخته نمی‌شود. ${errorText(result.tagError)}`,
        );
        return;
      }
      navigate(`/pets/${pet.id}`);
    },
    onError: (error) =>
      setFailure(
        partialPetId === null
          ? errorText(error)
          : `حیوان قبلاً ثبت شده است؛ ذخیرهٔ دوباره ناموفق بود. ${errorText(error)}`,
      ),
  });

  const upload = useMutation({
    mutationFn: (file: File) => api.uploadImage(file),
    onSuccess: (result) => setForm((current) => ({ ...current, photo: result.url })),
    onError: (error) => setFailure(errorText(error)),
  });

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function pickFile(file: File | undefined) {
    if (!file) return;
    const problem = validateUploadFile(file);
    if (problem) {
      setFailure(problem);
      return;
    }
    setFailure(null);
    upload.mutate(file);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setFailure(null);

    const pre: Record<string, string> = {};
    const weightRaw = form.weightKg.trim();
    if (weightRaw && !Number.isFinite(Number(toEnDigits(weightRaw)))) {
      pre.weightKg = 'وزن را به عدد وارد کنید';
    }
    setErrors(pre);
    if (Object.keys(pre).length > 0) return;

    const parsed = petSchema.safeParse({
      name: form.name.trim(),
      petTypeId: form.petTypeId,
      breedId: form.breedId,
      birthDate: form.birthDate,
      gender: form.gender === '' ? undefined : form.gender,
      isNeutered: form.isNeutered,
      weightKg: weightRaw ? Number(toEnDigits(weightRaw)) : null,
      photo: form.photo,
    });

    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? '');
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }

    save.mutate({
      input: {
        name: parsed.data.name,
        petTypeId: parsed.data.petTypeId,
        breedId: parsed.data.breedId ?? undefined,
        birthDate: parsed.data.birthDate || undefined,
        gender: parsed.data.gender ?? undefined,
        isNeutered: parsed.data.isNeutered,
        weightKg: parsed.data.weightKg ?? undefined,
        photo: parsed.data.photo ?? undefined,
      },
      tags: { allergenTagIds: allergenIds, dietTagIds: dietIds },
    });
  }

  if (editingId && existing.isLoading) return <LoadingState />;
  if (editingId && existing.error) return <ErrorState error={existing.error} />;

  return (
    <section>
      <h1>{editingId ? 'ویرایش حیوان' : 'ثبت حیوان جدید'}</h1>

      <form onSubmit={submit} noValidate>
        <Field label="نام" htmlFor="petName" error={errors.name}>
          <input
            id="petName"
            value={form.name}
            onChange={(event) => set('name', event.target.value)}
          />
        </Field>

        <Field label="نوع حیوان" htmlFor="petType" error={errors.petTypeId}>
          <select
            id="petType"
            value={form.petTypeId || ''}
            onChange={(event) => {
              const value = event.target.value ? Number(event.target.value) : 0;
              setForm((current) => ({ ...current, petTypeId: value, breedId: null }));
            }}
          >
            <option value="">انتخاب کنید</option>
            {petTypes.data?.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="نژاد (اختیاری)" htmlFor="breed" error={errors.breedId}>
          <select
            id="breed"
            value={form.breedId ?? ''}
            disabled={form.petTypeId < 1}
            onChange={(event) =>
              set('breedId', event.target.value ? Number(event.target.value) : null)
            }
          >
            <option value="">نامشخص</option>
            {breeds.data?.map((breed) => (
              <option key={breed.id} value={breed.id}>
                {breed.name}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="تاریخ تولد"
          htmlFor="birthDate"
          error={errors.birthDate}
          hint="تقویم میلادی؛ نمایش شمسی است"
        >
          <input
            id="birthDate"
            type="date"
            max={todayIso()}
            value={form.birthDate}
            onChange={(event) => set('birthDate', event.target.value)}
          />
        </Field>

        <Field label="جنسیت" htmlFor="gender">
          <select
            id="gender"
            value={form.gender}
            onChange={(event) => set('gender', event.target.value as '' | 'MALE' | 'FEMALE')}
          >
            <option value="">نامشخص</option>
            <option value="MALE">نر</option>
            <option value="FEMALE">ماده</option>
          </select>
        </Field>

        <Field label="وزن (کیلوگرم)" htmlFor="weightKg" error={errors.weightKg}>
          <input
            id="weightKg"
            dir="ltr"
            inputMode="decimal"
            value={form.weightKg}
            onChange={(event) => set('weightKg', event.target.value)}
          />
        </Field>

        <label>
          <input
            type="checkbox"
            checked={form.isNeutered}
            onChange={(event) => set('isNeutered', event.target.checked)}
          />
          عقیم‌شده
        </label>

        <Field label="تصویر" htmlFor="petPhoto" hint="JPEG، PNG یا WebP — حداکثر ۵ مگابایت">
          <input
            id="petPhoto"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => pickFile(event.target.files?.[0])}
          />
        </Field>
        {photoUrl && (
          <img
            src={photoUrl}
            alt={form.name || 'تصویر حیوان'}
            width={96}
            height={96}
            referrerPolicy="no-referrer"
          />
        )}

        <fieldset>
          <legend>برچسب‌های آلرژن</legend>
          {allergenTags.data?.map((tag) => (
            <label key={tag.id}>
              <input
                type="checkbox"
                checked={allergenIds.includes(tag.id)}
                onChange={() =>
                  setAllergenIds((current) =>
                    current.includes(tag.id)
                      ? current.filter((value) => value !== tag.id)
                      : [...current, tag.id],
                  )
                }
              />
              {tag.name}
            </label>
          ))}
        </fieldset>

        <fieldset>
          <legend>نیازهای غذایی</legend>
          {dietTags.data?.map((tag) => (
            <label key={tag.id}>
              <input
                type="checkbox"
                checked={dietIds.includes(tag.id)}
                onChange={() =>
                  setDietIds((current) =>
                    current.includes(tag.id)
                      ? current.filter((value) => value !== tag.id)
                      : [...current, tag.id],
                  )
                }
              />
              {tag.name}
            </label>
          ))}
        </fieldset>

        <button type="submit" disabled={save.isPending}>
          {save.isPending
            ? 'در حال ذخیره…'
            : partialPetId === null
              ? 'ذخیره'
              : 'تلاش دوباره برای ذخیره'}
        </button>
      </form>

      {failure && <ErrorState error={failure} />}
      {partialPetId !== null && <Link to={`/pets/${partialPetId}`}>دیدن حیوان ثبت‌شده</Link>}
      <Link to={editingId ? `/pets/${editingId}` : '/pets'}>انصراف</Link>
    </section>
  );
}
