import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, type CreateAddressInput } from '../api/endpoints';
import { queryKeys } from '../api/query-keys';
import { Field } from '../components/Field';
import { ErrorState, LoadingState } from '../components/states';
import { addressSchema } from '../lib/schemas';
import { errorText } from '../lib/labels';

interface FormState {
  title: string;
  receiverName: string;
  receiverPhone: string;
  province: string;
  city: string;
  fullAddress: string;
  postalCode: string;
}

const EMPTY: FormState = {
  title: '',
  receiverName: '',
  receiverPhone: '',
  province: '',
  city: '',
  fullAddress: '',
  postalCode: '',
};

/** Create / edit an address (there is no GET /addresses/:id — we read from the list). */
export function AddressEditPage() {
  const { id } = useParams();
  const editingId = id ? Number(id) : null;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const addresses = useQuery({ queryKey: queryKeys.addresses, queryFn: () => api.listAddresses() });
  const existing = editingId
    ? addresses.data?.find((address) => address.id === editingId)
    : undefined;

  const [form, setForm] = useState<FormState>(() =>
    existing
      ? {
          title: existing.title,
          receiverName: existing.receiverName,
          receiverPhone: existing.receiverPhone,
          province: existing.province,
          city: existing.city,
          fullAddress: existing.fullAddress,
          postalCode: existing.postalCode ?? '',
        }
      : EMPTY,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const initialized = useRef(false);

  // The list request resolves after the first render — fill the form exactly once.
  useEffect(() => {
    if (!existing || initialized.current) return;
    initialized.current = true;
    setForm({
      title: existing.title,
      receiverName: existing.receiverName,
      receiverPhone: existing.receiverPhone,
      province: existing.province,
      city: existing.city,
      fullAddress: existing.fullAddress,
      postalCode: existing.postalCode ?? '',
    });
  }, [existing]);

  const save = useMutation({
    mutationFn: (payload: CreateAddressInput) =>
      editingId ? api.updateAddress(editingId, payload) : api.createAddress(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.addresses });
      navigate('/addresses');
    },
    onError: (error) => setFailure(errorText(error)),
  });

  if (editingId && addresses.isLoading) return <LoadingState />;
  if (editingId && !existing && !addresses.isLoading && !addresses.error) {
    return (
      <section>
        <h1>آدرس</h1>
        <p>آدرس موردنظر یافت نشد.</p>
        <Link to="/addresses">بازگشت</Link>
      </section>
    );
  }

  function set<K extends keyof FormState>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setFailure(null);

    const parsed = addressSchema.safeParse(form);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? '');
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }

    setErrors({});
    const payload: CreateAddressInput = {
      title: parsed.data.title,
      receiverName: parsed.data.receiverName,
      receiverPhone: parsed.data.receiverPhone,
      province: parsed.data.province,
      city: parsed.data.city,
      fullAddress: parsed.data.fullAddress,
      postalCode: parsed.data.postalCode ? parsed.data.postalCode : undefined,
    };
    save.mutate(payload);
  }

  return (
    <section>
      <h1>{editingId ? 'ویرایش آدرس' : 'آدرس جدید'}</h1>

      <form onSubmit={submit} noValidate>
        <Field label="عنوان (مثلاً خانه)" htmlFor="title" error={errors.title}>
          <input
            id="title"
            value={form.title}
            onChange={(event) => set('title', event.target.value)}
          />
        </Field>
        <Field label="نام گیرنده" htmlFor="receiverName" error={errors.receiverName}>
          <input
            id="receiverName"
            value={form.receiverName}
            onChange={(event) => set('receiverName', event.target.value)}
          />
        </Field>
        <Field label="تلفن گیرنده" htmlFor="receiverPhone" error={errors.receiverPhone}>
          <input
            id="receiverPhone"
            dir="ltr"
            value={form.receiverPhone}
            onChange={(event) => set('receiverPhone', event.target.value)}
          />
        </Field>
        <Field label="استان" htmlFor="province" error={errors.province}>
          <input
            id="province"
            value={form.province}
            onChange={(event) => set('province', event.target.value)}
          />
        </Field>
        <Field label="شهر" htmlFor="city" error={errors.city}>
          <input
            id="city"
            value={form.city}
            onChange={(event) => set('city', event.target.value)}
          />
        </Field>
        <Field label="نشانی کامل" htmlFor="fullAddress" error={errors.fullAddress}>
          <textarea
            id="fullAddress"
            value={form.fullAddress}
            onChange={(event) => set('fullAddress', event.target.value)}
          />
        </Field>
        <Field label="کد پستی (اختیاری)" htmlFor="postalCode" error={errors.postalCode}>
          <input
            id="postalCode"
            dir="ltr"
            value={form.postalCode}
            onChange={(event) => set('postalCode', event.target.value)}
          />
        </Field>

        <button type="submit" disabled={save.isPending}>
          {save.isPending ? 'در حال ذخیره…' : 'ذخیره آدرس'}
        </button>
      </form>

      {failure && <ErrorState error={failure} />}
      <Link to="/addresses">انصراف</Link>
    </section>
  );
}
