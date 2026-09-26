import { useEffect, useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/endpoints';
import { useAuth } from '../auth/auth-provider';
import { Field } from '../components/Field';
import { ErrorState } from '../components/states';
import { sanitizeInternalRedirect } from '../lib/security';
import { OTP_RESEND_COOLDOWN_SECONDS } from '../lib/constants';
import { otpCodeSchema, phoneSchema } from '../lib/schemas';
import { sanitizeInternalRedirect } from '../lib/security';
import { clearOtpPhone, readOtpPhone } from '../auth/otp-flow';

/** Step 2 of login — POST /auth/otp/verify, then the session is restored via GET /users/me. */
export function VerifyOtpPage() {
  const [params] = useSearchParams();
<<<<<<< HEAD
  const phone = params.get('phone') ?? '';
=======
  const location = useLocation();
  const routePhone = (location.state as { otpPhone?: unknown } | null)?.otpPhone;
  const phone = phoneSchema.safeParse(routePhone ?? readOtpPhone()).data ?? '';
>>>>>>> frontend/design-system
  const next = sanitizeInternalRedirect(params.get('next'));
  const navigate = useNavigate();
  const { verifyOtp } = useAuth();

  const [code, setCode] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [cooldown, setCooldown] = useState(OTP_RESEND_COOLDOWN_SECONDS);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const resend = useMutation({
    mutationFn: () => api.requestOtp(phone),
    onSuccess: () => setCooldown(OTP_RESEND_COOLDOWN_SECONDS),
  });

  const login = useMutation({
    mutationFn: async (value: string) => verifyOtp(phone, value),
    onSuccess: () => {
      clearOtpPhone();
      navigate(next, { replace: true });
    },
  });

  if (!phone) return <Navigate to="/login" replace />;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = otpCodeSchema.safeParse(code);
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message);
      return;
    }
    setFieldError(undefined);
    login.mutate(parsed.data);
  }

  return (
    <section className="auth-page">
      <h1>کد تأیید</h1>
      <p>
        کد پیامک‌شده به <span dir="ltr">{phone}</span> را وارد کنید.
      </p>

      <form onSubmit={handleSubmit} noValidate>
        <Field label="کد ۵ رقمی" htmlFor="otp" error={fieldError}>
          <input
            id="otp"
            name="otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={5}
            dir="ltr"
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
        </Field>
        <button type="submit" disabled={login.isPending}>
          {login.isPending ? 'در حال ورود…' : 'ورود'}
        </button>
      </form>

      {login.error && <ErrorState error={login.error} />}

      <button
        type="button"
        disabled={cooldown > 0 || resend.isPending}
        onClick={() => resend.mutate()}
      >
        {cooldown > 0 ? `ارسال مجدد کد (${cooldown} ثانیه)` : 'ارسال مجدد کد'}
      </button>
      {resend.error && <ErrorState error={resend.error} />}

      <button
        type="button"
        onClick={() => {
          clearOtpPhone();
          navigate('/login');
        }}
      >
        تغییر شماره
      </button>
    </section>
  );
}
