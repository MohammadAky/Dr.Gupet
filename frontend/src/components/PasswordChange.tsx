import { useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/auth-provider';
import { passwordError } from '../lib/password';
import { Field } from './Field';
import { PasswordInput } from './PasswordInput';
import { PasswordStrength } from './PasswordStrength';
import { focusFirstInvalid } from '../lib/form-validation';

export function PasswordChange() {
  const { user, changePassword, logout } = useAuth();
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const submitted = useRef(false);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending.current) return;
    submitted.current = true;
    const next = validate(current, password, confirm);
    setErrors(next);
    setError('');
    setNotice('');
    if (Object.keys(next).length) { focusFirstInvalid(event.currentTarget as HTMLFormElement); return; }
    pending.current = true;
    setBusy(true);
    try {
      await changePassword(current, password);
      if (mounted.current) {
        setCurrent('');
        setPassword('');
        setConfirm('');
        submitted.current = false;
        setErrors({});
        setNotice('رمز عبور تغییر کرد. نشست‌های قبلی پایان یافتند.');
      }
    } catch {
      if (mounted.current)
        setError('تغییر رمز انجام نشد. رمز فعلی را بررسی کنید یا دوباره تلاش کنید.');
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  function validate(currentValue: string, nextValue: string, confirmation: string) {
    const next: Record<string, string> = {};
    if (!currentValue) next.current = 'رمز عبور فعلی را وارد کنید.';
    const problem = passwordError(nextValue);
    if (problem) next.password = problem;
    if (nextValue !== confirmation || !confirmation) next.confirm = 'تکرار رمز عبور یکسان نیست.';
    return next;
  }
  function change(field: 'current' | 'password' | 'confirm', value: string) {
    if (field === 'current') setCurrent(value);
    if (field === 'password') setPassword(value);
    if (field === 'confirm') setConfirm(value);
    setError('');
    setNotice('');
    if (submitted.current) setErrors(validate(field === 'current' ? value : current,
      field === 'password' ? value : password, field === 'confirm' ? value : confirm));
  }
  return (
    <div className="account-profile">
      <h2>رمز عبور</h2>
      {user?.username ? (
        <form onSubmit={(event) => void submit(event)} noValidate aria-busy={busy}>
          <Field label="رمز عبور فعلی" htmlFor="current-password" error={errors.current}>
            <PasswordInput
              id="current-password"
              required
              value={current}
              onChange={(value) => change('current', value)}
              disabled={busy}
              autoComplete="off"
              requireInteraction
            />
          </Field>
          <Field label="رمز عبور جدید" htmlFor="new-password" error={errors.password}>
            <PasswordInput
              id="new-password"
              required
              value={password}
              onChange={(value) => change('password', value)}
              disabled={busy}
              autoComplete="new-password"
              aria-describedby="new-password-guidance"
            />
            <div id="new-password-guidance"><PasswordStrength value={password} /></div>
          </Field>
          <Field label="تکرار رمز عبور جدید" htmlFor="confirm-new-password" error={errors.confirm}>
            <PasswordInput
              id="confirm-new-password"
              required
              value={confirm}
              onChange={(value) => change('confirm', value)}
              disabled={busy}
              autoComplete="new-password"
            />
          </Field>
          <button type="submit" disabled={busy}>
            {busy ? 'در حال تغییر…' : 'تغییر رمز عبور'}
          </button>
          {error && <p role="alert">{error}</p>}
          {notice && <p role="status">{notice}</p>}
        </form>
      ) : (
        <>
          <p>
            برای افزودن نام کاربری و رمز عبور، پس از خروج همین شمارهٔ موبایل را در ثبت‌نام تأیید
            کنید. اطلاعات و سوابق این حساب حفظ می‌شود.
          </p>
          <Link
            to="/login?mode=register&next=%2Fprofile"
            onClick={() => {
              void logout();
            }}
          >
            خروج و افزودن نام کاربری و رمز
          </Link>
        </>
      )}
    </div>
  );
}
