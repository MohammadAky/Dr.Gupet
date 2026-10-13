import { SafeImage } from '../components/SafeImage';
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/endpoints';
import { useAuth } from '../auth/auth-provider';
import { Field } from '../components/Field';
import { ErrorState } from '../components/states';
import { otpCodeSchema, phoneSchema } from '../lib/schemas';
import { sanitizeInternalRedirect } from '../lib/security';
import { clearOtpPhone, readOtpCooldown, readOtpPhone, storeOtpCooldown } from '../auth/otp-flow';
import { focusFirstInvalid } from '../lib/form-validation';

/** Step 2 of login — POST /auth/otp/verify, then the session is restored via GET /users/me. */
export function VerifyOtpPage() {
  const [params] = useSearchParams();
  const location = useLocation();
  const routePhone = (location.state as { otpPhone?: unknown } | null)?.otpPhone;
  const phone = phoneSchema.safeParse(routePhone ?? readOtpPhone()).data ?? '';
  const next = sanitizeInternalRedirect(params.get('next'));
  const navigate = useNavigate();
  const { verifyOtp } = useAuth();

  const [code, setCode] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [cooldown, setCooldown] = useState(() => readOtpCooldown(phone));
  const pending = useRef(false);
  const submitted = useRef(false);
  const mounted = useRef(true);

  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => setCooldown(readOtpCooldown(phone)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown, phone]);

  const resend = useMutation({
    mutationFn: () => api.requestOtp(phone),
    onSuccess: (result) => {
      if (!mounted.current) return;
      storeOtpCooldown(phone, result.cooldownSeconds);
      setCooldown(readOtpCooldown(phone));
      setCode('');
      setFieldError(undefined);
      submitted.current = false;
    },
    onSettled: () => {
      pending.current = false;
    },
  });

  const login = useMutation({
    mutationFn: async (value: string) => verifyOtp(phone, value),
    onSuccess: () => {
      if (!mounted.current) return;
      clearOtpPhone();
      navigate(next, { replace: true });
    },
    onSettled: () => {
      pending.current = false;
    },
  });

  const busy = login.isPending || resend.isPending;

  if (!phone) return <Navigate to="/login" replace />;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending.current) return;
    submitted.current = true;
    const parsed = otpCodeSchema.safeParse(code);
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message);
      focusFirstInvalid(event.currentTarget as HTMLFormElement);
      return;
    }
    setFieldError(undefined);
    pending.current = true;
    login.mutate(parsed.data);
  }

  return (
    <section className="auth-page auth-verify">
      <Link to="/" className="auth-story__brand">
        <SafeImage src="/brand/logo.jpg" width={48} height={48} alt="دکتر گوپت" />
        <span>دکتر گوپت</span>
      </Link>
      <h1>کد تأیید</h1>
      <p>
        کد پیامک‌شده به <span dir="ltr">{phone}</span> را وارد کنید.
      </p>

      <form onSubmit={handleSubmit} noValidate aria-busy={busy}>
        <Field label="کد ۵ یا ۶ رقمی" htmlFor="otp" error={fieldError}>
          <input
            id="otp"
            name="otp"
            required
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            className="auth-code-input"
            dir="ltr"
            value={code}
            disabled={busy}
            onChange={(event) => {
              const value = event.target.value;
              setCode(value);
              login.reset();
              if (submitted.current) setFieldError(otpCodeSchema.safeParse(value).error?.issues[0]?.message);
            }}
          />
        </Field>
        <button className="auth-submit" type="submit" disabled={busy}>
          {login.isPending ? 'در حال ورود…' : 'ورود'}
        </button>
      </form>

      {login.error && <ErrorState error={login.error} />}

      <button
        className="auth-switch"
        type="button"
        disabled={cooldown > 0 || busy}
        onClick={() => {
          if (pending.current || cooldown > 0) return;
          login.reset();
          setFieldError(undefined);
          pending.current = true;
          resend.mutate();
        }}
      >
        {cooldown > 0 ? `ارسال مجدد کد (${cooldown} ثانیه)` : 'ارسال مجدد کد'}
      </button>
      {resend.error && <ErrorState error={resend.error} />}

      <button
        className="auth-switch"
        type="button"
        disabled={busy}
        onClick={() => {
          if (pending.current) return;
          clearOtpPhone();
          navigate(`/login?${new URLSearchParams({ next, mode: 'otp' }).toString()}`);
        }}
      >
        تغییر شماره
      </button>
    </section>
  );
}
