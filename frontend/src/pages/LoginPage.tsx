import '../styles/content-pages.css';
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/endpoints';
import { Field } from '../components/Field';
import { ErrorState } from '../components/states';
import { otpCodeSchema, phoneSchema } from '../lib/schemas';
import { sanitizeInternalRedirect } from '../lib/security';
import { storeOtpCooldown, storeOtpPhone } from '../auth/otp-flow';
import { useAuth } from '../auth/auth-provider';
import { PasswordInput } from '../components/PasswordInput';
import { PasswordStrength } from '../components/PasswordStrength';
import { focusFirstInvalid } from '../lib/form-validation';
import {
  normalizeUsername,
  passwordError,
  usernameError,
  usernameHint,
} from '../lib/password';

export function LoginPage() {
  const [params] = useSearchParams();
  const [mode, setMode] = useState<'password' | 'register' | 'forgot' | 'otp'>(() =>
    params.get('mode') === 'register' ? 'register' : params.get('mode') === 'forgot' ? 'forgot'
      : params.get('mode') === 'otp' ? 'otp' : 'password',
  );
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  return (
    <section className="auth-shell">
      <div className="auth-page">
        <h1>
          {mode === 'register'
            ? 'ساخت حساب کاربری'
            : mode === 'forgot'
              ? 'بازیابی رمز عبور'
              : 'ورود به حساب'}
        </h1>
        <div className="auth-methods" role="group" aria-label="روش ورود">
          <button
            type="button"
            aria-pressed={mode !== 'otp'}
            disabled={busy}
            onClick={() => setMode('password')}
          >
            نام کاربری و رمز
          </button>
          <button
            type="button"
            aria-pressed={mode === 'otp'}
            disabled={busy}
            onClick={() => setMode('otp')}
          >
            کد پیامکی
          </button>
        </div>
        {notice && <p role="status">{notice}</p>}
        {mode === 'otp' ? (
          <OtpLogin onBusy={setBusy} />
        ) : (
          <PasswordLogin
            key={mode}
            register={mode === 'register'}
            forgot={mode === 'forgot'}
            onBusy={setBusy}
            onLogin={() => {
              setMode('password');
              setNotice('رمز عبور ذخیره شد. با رمز جدید وارد شوید.');
            }}
          />
        )}
        {mode !== 'otp' && (
          <button
            className="auth-switch"
            type="button"
            disabled={busy}
            onClick={() => setMode(mode === 'password' ? 'register' : 'password')}
          >
            {mode === 'password' ? 'حساب ندارید؟ ثبت‌نام' : 'بازگشت به ورود'}
          </button>
        )}
        {mode === 'password' && (
          <button
            type="button"
            className="auth-switch"
            disabled={busy}
            onClick={() => setMode('forgot')}
          >
            رمز عبور را فراموش کرده‌اید؟
          </button>
        )}
        <p className="auth-back">
          <Link to="/">
            بازگشت به سایت <span aria-hidden="true">←</span>
          </Link>
        </p>
      </div>
    </section>
  );
}

function PasswordLogin({
  register,
  forgot,
  onBusy,
  onLogin,
}: {
  register: boolean;
  forgot: boolean;
  onBusy(value: boolean): void;
  onLogin(): void;
}) {
  const { loginPassword, registerPassword } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [codeStep, setCodeStep] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(Date.now);
  const [notice, setNotice] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const submitted = useRef(false);
  const mounted = useRef(true);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = sanitizeInternalRedirect(params.get('next'));
  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    const timer = window.setInterval(() => {
      const timestamp = Date.now();
      setNow(timestamp);
      if (timestamp >= cooldownUntil) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownUntil]);
  const remaining = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));

  const values = { username, phone, password, confirm, code, firstName, lastName };
  function validate(input: typeof values) {
    return {
      username: usernameError(input.username),
      phone: register || forgot ? phoneSchema.safeParse(input.phone).error?.issues[0]?.message : undefined,
      password: register || (forgot && codeStep)
        ? passwordError(input.password)
        : !forgot && !input.password ? 'رمز عبور را وارد کنید.' : undefined,
      confirm: (register || (forgot && codeStep)) && input.password !== input.confirm
        ? 'تکرار رمز عبور یکسان نیست.' : undefined,
      code: codeStep ? otpCodeSchema.safeParse(input.code).error?.issues[0]?.message : undefined,
      firstName: input.firstName.trim().length > 50 ? 'نام حداکثر ۵۰ نویسه باشد.' : undefined,
      lastName: input.lastName.trim().length > 50 ? 'نام خانوادگی حداکثر ۵۰ نویسه باشد.' : undefined,
    };
  }
  function update(key: keyof typeof values, value: string) {
    const setters = { username: setUsername, phone: setPhone, password: setPassword, confirm: setConfirm,
      code: setCode, firstName: setFirstName, lastName: setLastName };
    setters[key](value);
    setError('');
    if (submitted.current) setErrors(validate({ ...values, [key]: value }));
  }

  async function sendCode() {
    const normalizedPhone = phoneSchema.parse(phone);
    const result = forgot
      ? await api.requestPasswordReset({
          username: normalizeUsername(username),
          phone: normalizedPhone,
        })
      : await api.requestRegistrationOtp(normalizedPhone);
    if (!mounted.current) return;
    const seconds =
      Number.isSafeInteger(result.cooldownSeconds) && result.cooldownSeconds >= 0
        ? result.cooldownSeconds
        : 60;
    const timestamp = Date.now();
    setNow(timestamp);
    setCooldownUntil(timestamp + seconds * 1000);
    setCodeStep(true);
    setCode('');
    setErrors({});
    submitted.current = false;
    setPhone(normalizedPhone);
    setNotice(
      forgot
        ? 'اگر اطلاعات با حساب مطابقت داشته باشد، کد تأیید ارسال می‌شود.'
        : 'کد تأیید ارسال شد؛ آخرین کد را وارد کنید.',
    );
    requestAnimationFrame(() => {
      if (mounted.current) document.getElementById(forgot ? 'password' : 'password-otp')?.focus();
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending.current) return;
    submitted.current = true;
    const problems = validate(values);
    setErrors(problems);
    if (Object.values(problems).some(Boolean)) {
      focusFirstInvalid(event.currentTarget as HTMLFormElement);
      return;
    }
    if (!codeStep && (register || forgot) && remaining > 0) return;
    pending.current = true;
    setBusy(true);
    onBusy(true);
    setError('');
    setNotice('');
    try {
      const credentials = { username: normalizeUsername(username), password };
      if ((register || forgot) && !codeStep) {
        await sendCode();
        return;
      }
      if (forgot) {
        await api.resetPassword({
          username: credentials.username,
          phone: phoneSchema.parse(phone),
          code: otpCodeSchema.parse(code),
          newPassword: password,
        });
        if (mounted.current) {
          setPassword('');
          setConfirm('');
          onLogin();
        }
        return;
      }
      if (register)
        await registerPassword({
          ...credentials,
          phone: phoneSchema.parse(phone),
          code: otpCodeSchema.parse(code),
          firstName: firstName.trim() || undefined,
          lastName: lastName.trim() || undefined,
        });
      else await loginPassword(credentials);
      if (mounted.current) {
        setPassword('');
        setConfirm('');
        navigate(next, { replace: true });
      }
    } catch {
      if (mounted.current)
        setError(
          forgot
            ? 'بازیابی انجام نشد. اطلاعات و کد را بررسی کنید یا دوباره تلاش کنید.'
            : register
              ? 'ساخت حساب انجام نشد. اطلاعات و کد را بررسی کنید یا دوباره تلاش کنید.'
              : 'ورود انجام نشد. اطلاعات را بررسی کنید یا دوباره تلاش کنید.',
        );
    } finally {
      pending.current = false;
      if (mounted.current) {
        setBusy(false);
        onBusy(false);
      }
    }
  }

  async function resendCode() {
    if (pending.current || remaining > 0) return;
    pending.current = true;
    setBusy(true);
    onBusy(true);
    setError('');
    try {
      await sendCode();
    } catch {
      if (mounted.current) setError('درخواست کد انجام نشد. دوباره تلاش کنید.');
    } finally {
      pending.current = false;
      if (mounted.current) {
        setBusy(false);
        onBusy(false);
      }
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} noValidate aria-busy={busy}>
      <Field
        label="نام کاربری"
        htmlFor="username"
        error={errors.username}
        hint={register ? usernameHint : undefined}
      >
        <input
          id="username"
          name="username"
          required
          dir="ltr"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={username}
          disabled={busy || codeStep}
          onChange={(event) => update('username', event.target.value)}
        />
      </Field>
      {(register || forgot) && (
        <Field label="شماره موبایل" htmlFor="password-phone" error={errors.phone}>
          <input
            id="password-phone"
            name="phone"
            required
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            dir="ltr"
            value={phone}
            disabled={busy || codeStep}
            onChange={(event) => update('phone', event.target.value)}
          />
        </Field>
      )}
      {register && (
        <>
          <Field label="نام (اختیاری)" htmlFor="signup-firstName" error={errors.firstName}>
            <input
              id="signup-firstName"
              autoComplete="given-name"
              maxLength={50}
              disabled={busy}
              value={firstName}
              onChange={(event) => update('firstName', event.target.value)}
            />
          </Field>
          <Field label="نام خانوادگی (اختیاری)" htmlFor="signup-lastName" error={errors.lastName}>
            <input
              id="signup-lastName"
              autoComplete="family-name"
              maxLength={50}
              disabled={busy}
              value={lastName}
              onChange={(event) => update('lastName', event.target.value)}
            />
          </Field>
        </>
      )}
      {(!forgot || codeStep) && (
        <Field
          label={forgot ? 'رمز عبور جدید' : 'رمز عبور'}
          htmlFor="password"
          error={errors.password}
        >
          <PasswordInput
            id="password"
            required
            value={password}
            onChange={(value) => update('password', value)}
            disabled={busy}
            autoComplete={register || forgot ? 'new-password' : 'current-password'}
            aria-describedby={register || forgot ? 'password-guidance' : undefined}
          />
          {(register || forgot) && <div id="password-guidance"><PasswordStrength value={password} /></div>}
        </Field>
      )}
      {(register || (forgot && codeStep)) && (
        <Field label="تکرار رمز عبور" htmlFor="password-confirm" error={errors.confirm}>
          <PasswordInput
            id="password-confirm"
            required
            value={confirm}
            onChange={(value) => update('confirm', value)}
            disabled={busy}
            autoComplete="new-password"
          />
        </Field>
      )}
      {codeStep && (
        <Field label="کد تأیید پیامکی" htmlFor="password-otp" error={errors.code}>
          <input
            id="password-otp"
            name="code"
            required
            dir="ltr"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            disabled={busy}
            onChange={(event) => update('code', event.target.value)}
          />
        </Field>
      )}
      <button
        className="auth-submit"
        type="submit"
        disabled={busy || (!codeStep && (register || forgot) && remaining > 0)}
      >
        {busy
          ? 'در حال بررسی…'
          : forgot
            ? codeStep
              ? 'ذخیره رمز و بازگشت به ورود'
              : 'دریافت کد بازیابی'
            : register
              ? codeStep
                ? 'تأیید شماره و ساخت حساب'
                : 'دریافت کد تأیید'
              : 'ورود'}
      </button>
      {codeStep && (
        <>
          <button type="button" disabled={busy || remaining > 0} onClick={() => void resendCode()}>
            {remaining > 0 ? `ارسال مجدد کد (${remaining} ثانیه)` : 'ارسال مجدد کد'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setCodeStep(false);
              setCode('');
              setNotice('');
              setError('');
              setErrors({});
              submitted.current = false;
              requestAnimationFrame(() => {
                if (mounted.current) document.getElementById('username')?.focus();
              });
            }}
          >
            ویرایش اطلاعات
          </button>
        </>
      )}
      {!codeStep && remaining > 0 && <p role="status">درخواست کد جدید تا {remaining} ثانیه دیگر</p>}
      {notice && <p role="status">{notice}</p>}
      {error && (
        <p className="field__error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

/** Initial SMS request retains the existing cooldown and late-response safeguards. */
function OtpLogin({ onBusy }: { onBusy(value: boolean): void }) {
  const [phone, setPhone] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = sanitizeInternalRedirect(params.get('next'));
  const pending = useRef(false);
  const submitted = useRef(false);
  const mounted = useRef(true);

  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
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
    onSettled: () => {
      pending.current = false;
      if (mounted.current) onBusy(false);
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending.current) return;
    submitted.current = true;
    const parsed = phoneSchema.safeParse(phone);
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message);
      focusFirstInvalid(event.currentTarget as HTMLFormElement);
      return;
    }
    setFieldError(undefined);
    pending.current = true;
    onBusy(true);
    requestOtp.mutate(parsed.data);
  }

  return (
    <div>
      <form onSubmit={handleSubmit} noValidate aria-busy={requestOtp.isPending}>
        <Field label="شماره موبایل" htmlFor="phone" error={fieldError}>
          <input
            id="phone"
            name="phone"
            required
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            dir="ltr"
            value={phone}
            disabled={requestOtp.isPending}
            onChange={(event) => {
              const value = event.target.value;
              setPhone(value);
              requestOtp.reset();
              if (submitted.current) setFieldError(phoneSchema.safeParse(value).error?.issues[0]?.message);
            }}
          />
        </Field>

        <button className="auth-submit" type="submit" disabled={requestOtp.isPending}>
          {requestOtp.isPending ? 'ارسال کد…' : 'ارسال کد تأیید'}
        </button>
      </form>

      {requestOtp.error && <ErrorState error={requestOtp.error} />}
    </div>
  );
}
