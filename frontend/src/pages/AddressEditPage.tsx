import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, type CreateAddressInput } from '../api/endpoints';
import { queryKeys } from '../api/query-keys';
import { Field } from '../components/Field';
import { ErrorState, LoadingState } from '../components/states';
import { addressSchema } from '../lib/schemas';
import { errorText } from '../lib/labels';
import { AccountFrame, AccountNav } from '../components/AccountNav';
import { useAuth } from '../auth/auth-provider';
import { toEnDigits } from '../lib/format';
import { focusFirstInvalid, validationErrors } from '../lib/form-validation';
import { writeCheckoutIntent } from '../features/checkout/intent';

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
  const { status, user } = useAuth();
  const { id } = useParams();
  if (status === 'loading') return <AccountFrame title="آدرس"><LoadingState /></AccountFrame>;
  if (status !== 'authed' || !user) return <p>برای مدیریت آدرس‌ها وارد حساب شوید.</p>;
  return <AddressEditSession key={`${user.id}:${id ?? 'new'}`} />;
}

function AddressEditSession() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const returnTo = params.get('next') === '/checkout' ? '/checkout' : '/addresses';
  const { id } = useParams();
  const editingId = id ? Number(id) : null;
  const invalidId = editingId !== null && (!Number.isSafeInteger(editingId) || editingId < 1);
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

  const addresses = useQuery({
    queryKey: queryKeys.addresses,
    queryFn: async ({ signal }) => {
      const result = await api.listAddresses();
      if (signal.aborted || !active.current)
        throw new DOMException('Inactive session', 'AbortError');
      return result;
    },
    enabled: !invalidId,
  });
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
  const submitted = useRef(false);

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
      editingId
        ? api.updateAddress(editingId, { ...payload, postalCode: payload.postalCode ?? null })
        : api.createAddress(payload),
    onSuccess: (address) => {
      if (!active.current) return;
      void queryClient.invalidateQueries({ queryKey: queryKeys.addresses });
      if (returnTo === '/checkout' && user) writeCheckoutIntent(user.id, { addressId: address.id });
      navigate(returnTo);
    },
    onError: (error) => {
      if (active.current) setFailure(errorText(error));
    },
    onSettled: () => {
      if (active.current) writing.current = false;
    },
  });

  if (editingId && addresses.isLoading) return <section className="account-page"><AccountNav /><h1>ویرایش آدرس</h1><LoadingState /></section>;
  if (editingId && !invalidId && !existing && !addresses.isLoading && !addresses.error) {
    return (
      <section className="account-page">
        <AccountNav />
        <h1>آدرس</h1>
        <p>آدرس موردنظر یافت نشد.</p>
        <Link to="/addresses">بازگشت</Link>
      </section>
    );
  }

  function set<K extends keyof FormState>(key: K, value: string) {
    const next = { ...form, [key]: value };
    setForm(next);
    if (submitted.current) {
      const parsed = addressSchema.safeParse({ ...next, postalCode: toEnDigits(next.postalCode.trim()) });
      setErrors(parsed.success ? {} : validationErrors(parsed.error.issues));
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!active.current || writing.current || invalidId || (editingId !== null && !existing))
      return;
    setFailure(null);
    submitted.current = true;

    const parsed = addressSchema.safeParse({
      ...form,
      postalCode: toEnDigits(form.postalCode.trim()),
    });
    if (!parsed.success) {
      setErrors(validationErrors(parsed.error.issues));
      focusFirstInvalid(event.currentTarget as HTMLFormElement);
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
    writing.current = true;
    save.mutate(payload);
  }

  if (invalidId)
    return (
      <section className="account-page">
        <AccountNav />
        <h1>آدرس</h1>
        <p role="alert">آدرس موردنظر معتبر نیست.</p>
        <Link to="/addresses">بازگشت به آدرس‌ها</Link>
      </section>
    );
  if (addresses.error)
    return (
      <section className="account-page">
        <AccountNav />
        <h1>{editingId ? 'ویرایش آدرس' : 'آدرس جدید'}</h1>
        <ErrorState error={addresses.error} onRetry={() => void addresses.refetch()} />
        <Link to="/addresses">بازگشت به آدرس‌ها</Link>
      </section>
    );

  return (
    <section className="account-page account-edit-page">
      <AccountNav />
      <header className="account-heading">
        <div>
          <h1>{editingId ? 'ویرایش آدرس' : 'آدرس جدید'}</h1>
          <p>نشانی و اطلاعات گیرنده را دقیق وارد کنید تا ارسال آسان‌تر شود.</p>
        </div>
        <Link className="account-secondary-link" to={returnTo}>
          {returnTo === '/checkout' ? 'بازگشت به تسویه' : 'بازگشت به آدرس‌ها'}
        </Link>
      </header>

      <form className="account-form" onSubmit={submit} noValidate aria-busy={save.isPending}>
        <Field label="عنوان (مثلاً خانه)" htmlFor="title" error={errors.title}>
          <input
            id="title"
            disabled={save.isPending}
            value={form.title}
            onChange={(event) => set('title', event.target.value)}
          />
        </Field>
        <Field label="نام گیرنده" htmlFor="receiverName" error={errors.receiverName}>
          <input
            id="receiverName"
            disabled={save.isPending}
            autoComplete="name"
            value={form.receiverName}
            onChange={(event) => set('receiverName', event.target.value)}
          />
        </Field>
        <Field label="تلفن گیرنده" htmlFor="receiverPhone" error={errors.receiverPhone}>
          <input
            id="receiverPhone"
            disabled={save.isPending}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            dir="ltr"
            value={form.receiverPhone}
            onChange={(event) => set('receiverPhone', event.target.value)}
          />
        </Field>
        <Field label="استان" htmlFor="province" error={errors.province}>
          <input
            id="province"
            disabled={save.isPending}
            autoComplete="address-level1"
            value={form.province}
            onChange={(event) => set('province', event.target.value)}
          />
        </Field>
        <Field label="شهر" htmlFor="city" error={errors.city}>
          <input
            id="city"
            disabled={save.isPending}
            autoComplete="address-level2"
            value={form.city}
            onChange={(event) => set('city', event.target.value)}
          />
        </Field>
        <Field label="نشانی کامل" htmlFor="fullAddress" error={errors.fullAddress}>
          <textarea
            id="fullAddress"
            disabled={save.isPending}
            autoComplete="street-address"
            rows={3}
            value={form.fullAddress}
            onChange={(event) => set('fullAddress', event.target.value)}
          />
        </Field>
        <Field label="کد پستی (اختیاری)" htmlFor="postalCode" error={errors.postalCode}>
          <input
            id="postalCode"
            disabled={save.isPending}
            inputMode="numeric"
            autoComplete="postal-code"
            dir="ltr"
            value={form.postalCode}
            onChange={(event) => set('postalCode', event.target.value)}
          />
        </Field>

        <button className="account-submit" type="submit" disabled={save.isPending}>
          {save.isPending ? 'در حال ذخیره…' : 'ذخیره آدرس'}
        </button>
      </form>

      {failure && <ErrorState error={failure} />}
      <p className="account-form-cancel">
        <Link to={returnTo}>انصراف</Link>
      </p>
    </section>
  );
}
