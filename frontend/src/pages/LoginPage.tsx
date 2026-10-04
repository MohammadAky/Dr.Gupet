import { useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/endpoints';
import { Field } from '../components/Field';
import { ErrorState } from '../components/states';
import { phoneSchema } from '../lib/schemas';
import { sanitizeInternalRedirect } from '../lib/security';
import { storeOtpCooldown, storeOtpPhone } from '../auth/otp-flow';

/** Step 1 of login — POST /auth/otp/request (public, throttled 10/min). */
export function LoginPage() {
  const [phone, setPhone] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = sanitizeInternalRedirect(params.get('next'));
  const pending = useRef(false);
  const mounted = useRef(true);

  useLayoutEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const requestOtp = useMutation({
    mutationFn: (value: string) => api.requestOtp(value),
    onSuccess: (result, value) => {
      if (!mounted.current) return;
      storeOtpPhone(value);
      storeOtpCooldown(value, result.cooldownSeconds);
      const query = new URLSearchParams({ next });
      navigate(`/verify?${query.toString()}`, { state: { otpPhone: value } });
    },
    onSettled: () => { pending.current = false; },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending.current) return;
    const parsed = phoneSchema.safeParse(phone);
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message);
      return;
    }
    setFieldError(undefined);
    pending.current = true;
    requestOtp.mutate(parsed.data);
  }

  return (
    <section className="auth-page">
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
            value={phone}
            disabled={requestOtp.isPending}
            onChange={(event) => setPhone(event.target.value)}
          />
        </Field>

        <button className="auth-submit" type="submit" disabled={requestOtp.isPending}>
          {requestOtp.isPending ? 'ارسال کد…' : 'ارسال کد تأیید'}
        </button>
      </form>

      {requestOtp.error && <ErrorState error={requestOtp.error} />}
    </section>
  );
}
