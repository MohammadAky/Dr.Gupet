import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/endpoints';
import { Field } from '../components/Field';
import { ErrorState } from '../components/states';
import { DEV_OTP_CODE } from '../lib/constants';
import { phoneSchema } from '../lib/schemas';

/** Step 1 of login — POST /auth/otp/request (public, throttled 10/min). */
export function LoginPage() {
  const [phone, setPhone] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = params.get('next') ?? '/';

  const requestOtp = useMutation({
    mutationFn: (value: string) => api.requestOtp(value),
    onSuccess: (_result, value) => {
      const query = new URLSearchParams({ phone: value, next });
      navigate(`/verify?${query.toString()}`);
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = phoneSchema.safeParse(phone);
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message);
      return;
    }
    setFieldError(undefined);
    requestOtp.mutate(parsed.data);
  }

  return (
    <section>
      <h1>ورود با شماره موبایل</h1>
      <p>کد یک‌بارمصرف به شمارهٔ شما پیامک می‌شود (نیازی به رمز عبور نیست).</p>

      <form onSubmit={handleSubmit} noValidate>
        <Field label="شماره موبایل" htmlFor="phone" error={fieldError}>
          <input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            dir="ltr"
            placeholder="09123456789"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </Field>

        <button type="submit" disabled={requestOtp.isPending}>
          {requestOtp.isPending ? 'ارسال کد…' : 'ارسال کد تأیید'}
        </button>
      </form>

      {requestOtp.error && <ErrorState error={requestOtp.error} />}
      {DEV_OTP_CODE && (
        <p className="dev-hint" dir="ltr">
          DEV OTP: {DEV_OTP_CODE}
        </p>
      )}
      <p>
        با ورود، <Link to="/">قوانین استفاده</Link> را می‌پذیرید.
      </p>
    </section>
  );
}
