import '../styles/content-pages.css';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  api,
  type CreatePetInput,
  type SetPetTagsInput,
  type UpdatePetInput,
} from '../api/endpoints';
import { queryKeys } from '../api/query-keys';
import { Field } from '../components/Field';
import { ImagePicker } from '../components/ImagePicker';
import { ErrorState, LoadingState } from '../components/states';
import { toEnDigits } from '../lib/format';
import { todayIso } from '../lib/jalali';
import { JalaliDateInput } from '../components/JalaliDateInput';
import { petSchema, validateUploadFile } from '../lib/schemas';
import { errorText } from '../lib/labels';
import { API_BASE_URL } from '../lib/env';
import { safeImageUrl } from '../lib/image-url';
import { savePetWithTags } from '../features/pets/save';
import { AccountFrame, AccountNav } from '../components/AccountNav';
import { useAuth } from '../auth/auth-provider';
import { SafeImage } from '../components/SafeImage';
import { focusFirstInvalid, validationErrors } from '../lib/form-validation';

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
  const { status, user } = useAuth();
  const { id } = useParams();
  if (status === 'loading')
    return (
      <AccountFrame title="پروفایل حیوان">
        <LoadingState layout="form" />
      </AccountFrame>
    );
  if (status !== 'authed' || !user) return <p>برای مدیریت حیوانات خود وارد حساب شوید.</p>;
  return <PetEditSession key={`${user.id}:${id ?? 'new'}`} />;
}

function PetEditSession() {
  const { id } = useParams();
  const editingId = id ? Number(id) : null;
  const validEditingId = editingId !== null && Number.isSafeInteger(editingId) && editingId > 0;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const active = useRef(true);
  const writing = useRef(false);
  useLayoutEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [allergenIds, setAllergenIds] = useState<number[]>([]);
  const [dietIds, setDietIds] = useState<number[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [partialPetId, setPartialPetId] = useState<number | null>(null);
  const photoUrl = safeImageUrl(form.photo, window.location.origin, API_BASE_URL);
  const initialized = useRef(false);
  const createdPetId = useRef<number | null>(null);
  const submitted = useRef(false);

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
    queryFn: async ({ signal }) => {
      const result = await api.getPet(editingId as number);
      if (signal.aborted || !active.current)
        throw new DOMException('Inactive session', 'AbortError');
      return result;
    },
    enabled: validEditingId,
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
    mutationFn: ({
      input,
      update,
      tags,
    }: {
      input: CreatePetInput;
      update: UpdatePetInput;
      tags: SetPetTagsInput;
    }) =>
      savePetWithTags(
        api,
        editingId ?? createdPetId.current,
        input,
        tags,
        (createdId) => {
          createdPetId.current = createdId;
        },
        update,
        () => active.current,
      ),
    onSuccess: (result) => {
      if (!active.current) return;
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
    onError: (error) => {
      if (!active.current) return;
      setFailure(
        partialPetId === null
          ? errorText(error)
          : `حیوان قبلاً ثبت شده است؛ ذخیرهٔ دوباره ناموفق بود. ${errorText(error)}`,
      );
    },
    onSettled: () => {
      if (active.current) writing.current = false;
    },
  });

  const upload = useMutation({
    mutationFn: (file: File) => api.uploadImage(file),
    onSuccess: (result) => {
      if (active.current) setForm((current) => ({ ...current, photo: result.url }));
    },
    onError: (error) => {
      if (active.current) setFailure(errorText(error));
    },
  });

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    const next = { ...form, [key]: value, ...(key === 'petTypeId' ? { breedId: null } : {}) };
    setForm(next);
    if (submitted.current) setErrors(validate(next));
  }

  function validate(value: FormState) {
    const weightRaw = value.weightKg.trim();
    const parsed = petSchema.safeParse({
      ...value,
      name: value.name.trim(),
      gender: value.gender || undefined,
      weightKg: weightRaw ? Number(toEnDigits(weightRaw)) : null,
    });
    const next = parsed.success ? {} : validationErrors(parsed.error.issues);
    if (weightRaw && !Number.isFinite(Number(toEnDigits(weightRaw))))
      next.weightKg = 'وزن را به عدد وارد کنید';
    return next;
  }

  function pickFile(file: File | undefined) {
    if (!active.current || !file || upload.isPending || writing.current) return;
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
    if (
      !active.current ||
      writing.current ||
      upload.isPending ||
      petTypes.isPending ||
      allergenTags.isPending ||
      dietTags.isPending ||
      petTypes.error ||
      allergenTags.error ||
      dietTags.error ||
      breeds.isError ||
      (form.petTypeId > 0 && breeds.isPending)
    )
      return;
    setFailure(null);
    submitted.current = true;

    const pre: Record<string, string> = {};
    const weightRaw = form.weightKg.trim();
    if (weightRaw && !Number.isFinite(Number(toEnDigits(weightRaw)))) {
      pre.weightKg = 'وزن را به عدد وارد کنید';
    }
    setErrors(pre);
    if (Object.keys(pre).length > 0) {
      focusFirstInvalid(event.currentTarget as HTMLFormElement);
      return;
    }

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
      focusFirstInvalid(event.currentTarget as HTMLFormElement);
      return;
    }

    writing.current = true;
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
      update: {
        name: parsed.data.name,
        petTypeId: parsed.data.petTypeId,
        breedId: parsed.data.breedId ?? null,
        birthDate: parsed.data.birthDate || null,
        gender: parsed.data.gender ?? null,
        isNeutered: parsed.data.isNeutered,
        weightKg: parsed.data.weightKg ?? null,
        photo: parsed.data.photo ?? null,
      },
      tags: { allergenTagIds: allergenIds, dietTagIds: dietIds },
    });
  }

  if (editingId && existing.isLoading)
    return (
      <section className="account-page">
        <AccountNav />
        <h1>ویرایش حیوان</h1>
        <LoadingState layout="form" />
      </section>
    );
  if (id !== undefined && !validEditingId)
    return (
      <section className="account-page">
        <AccountNav />
        <h1>پروفایل حیوان</h1>
        <p role="alert">شناسهٔ حیوان معتبر نیست.</p>
        <Link to="/pets">بازگشت به حیوانات من</Link>
      </section>
    );
  if (editingId && existing.error)
    return (
      <section className="account-page">
        <AccountNav />
        <h1>ویرایش حیوان</h1>
        <ErrorState error={existing.error} onRetry={() => void existing.refetch()} />
      </section>
    );
  const dependencyError = petTypes.error ?? allergenTags.error ?? dietTags.error ?? breeds.error;
  if (dependencyError)
    return (
      <section className="account-page">
        <AccountNav />
        <h1>{editingId ? 'ویرایش حیوان' : 'ثبت حیوان جدید'}</h1>
        <ErrorState
          error={dependencyError}
          onRetry={() => {
            if (petTypes.error) void petTypes.refetch();
            if (allergenTags.error) void allergenTags.refetch();
            if (dietTags.error) void dietTags.refetch();
            if (breeds.error) void breeds.refetch();
          }}
        />
        <p>اطلاعات انتخابی کامل دریافت نشد. برای حفظ اطلاعات حیوان، ابتدا دوباره تلاش کنید.</p>
        <Link to="/pets">بازگشت به حیوانات من</Link>
      </section>
    );
  if (petTypes.isPending || allergenTags.isPending || dietTags.isPending)
    return (
      <section className="account-page">
        <AccountNav />
        <h1>{editingId ? 'ویرایش حیوان' : 'ثبت حیوان جدید'}</h1>
        <LoadingState layout="form" />
      </section>
    );

  return (
    <section className="account-page account-edit-page">
      <AccountNav />
      <header className="account-heading">
        <div>
          <h1>{editingId ? 'ویرایش حیوان' : 'ثبت حیوان جدید'}</h1>
          <p>کمی بیشتر از همراهتان بگویید تا انتخاب‌های مناسب‌تری داشته باشید.</p>
        </div>
        <Link className="account-secondary-link" to="/pets">
          حیوانات من
        </Link>
      </header>

      <form
        className="account-form"
        onSubmit={submit}
        noValidate
        aria-busy={save.isPending || upload.isPending}
      >
        <Field label="نام" htmlFor="petName" error={errors.name}>
          <input
            id="petName"
            disabled={save.isPending}
            value={form.name}
            onChange={(event) => set('name', event.target.value)}
          />
        </Field>

        <Field label="نوع حیوان" htmlFor="petType" error={errors.petTypeId}>
          <select
            id="petType"
            disabled={save.isPending}
            value={form.petTypeId || ''}
            onChange={(event) => {
              const value = event.target.value ? Number(event.target.value) : 0;
              set('petTypeId', value);
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
            disabled={save.isPending || form.petTypeId < 1 || breeds.isPending}
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
          label="تاریخ تولد (شمسی)"
          htmlFor="birthDate"
          error={errors.birthDate}
          hint="تاریخ را از تقویم شمسی انتخاب کنید؛ تاریخ آینده مجاز نیست."
        >
          <JalaliDateInput
            id="birthDate"
            disabled={save.isPending}
            max={todayIso()}
            value={form.birthDate}
            onChange={(value) => set('birthDate', value)}
          />
        </Field>

        <Field label="جنسیت" htmlFor="gender">
          <select
            id="gender"
            disabled={save.isPending}
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
            disabled={save.isPending}
            dir="ltr"
            inputMode="decimal"
            value={form.weightKg}
            onChange={(event) => set('weightKg', event.target.value)}
          />
        </Field>

        <label className="account-check">
          <input
            type="checkbox"
            disabled={save.isPending}
            checked={form.isNeutered}
            onChange={(event) => set('isNeutered', event.target.checked)}
          />
          عقیم‌شده
        </label>

        <Field label="تصویر" htmlFor="petPhoto" hint="JPEG، PNG یا WebP، حداکثر ۵ مگابایت">
          <ImagePicker
            id="petPhoto"
            label="انتخاب تصویر حیوان"
            disabled={upload.isPending || save.isPending}
            onSelect={pickFile}
          />
        </Field>
        {upload.isPending && (
          <p className="account-form-status" role="status">
            در حال بارگذاری تصویر… پس از پایان، اطلاعات را ذخیره کنید.
          </p>
        )}
        {photoUrl && (
          <SafeImage
            className="account-pet-photo"
            src={photoUrl}
            alt={form.name || 'تصویر حیوان'}
            width={96}
            height={96}
            referrerPolicy="no-referrer"
          />
        )}

        <fieldset className="account-tag-options">
          <legend>حساسیت‌های غذایی ثبت‌شده</legend>
          {allergenTags.data?.map((tag) => (
            <label key={tag.id}>
              <input
                type="checkbox"
                disabled={save.isPending}
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
          {allergenTags.data?.length === 0 && (
            <p className="account-subtle">هنوز گزینه‌ای برای حساسیت غذایی ثبت نشده است.</p>
          )}
        </fieldset>

        <fieldset className="account-tag-options">
          <legend>نیازهای غذایی</legend>
          {dietTags.data?.map((tag) => (
            <label key={tag.id}>
              <input
                type="checkbox"
                disabled={save.isPending}
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
          {dietTags.data?.length === 0 && (
            <p className="account-subtle">برچسب نیاز غذایی در دسترس نیست.</p>
          )}
        </fieldset>

        <button
          className="account-submit"
          type="submit"
          disabled={save.isPending || upload.isPending || (form.petTypeId > 0 && breeds.isPending)}
        >
          {save.isPending
            ? 'در حال ذخیره…'
            : partialPetId === null
              ? 'ذخیره'
              : 'تلاش دوباره برای ذخیره'}
        </button>
      </form>

      {failure && <ErrorState error={failure} />}
      {partialPetId !== null && <Link to={`/pets/${partialPetId}`}>دیدن حیوان ثبت‌شده</Link>}
      <p className="account-form-cancel">
        <Link to={editingId ? `/pets/${editingId}` : '/pets'}>انصراف</Link>
      </p>
    </section>
  );
}
