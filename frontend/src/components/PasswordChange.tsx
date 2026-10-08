import { useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/auth-provider';
import { passwordError, passwordHint } from '../lib/password';
import { Field } from './Field';
import { PasswordInput } from './PasswordInput';

export function PasswordChange() {
  const { user, changePassword, logout } = useAuth();
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
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
    const problem = !current
      ? 'رمز عبور فعلی را وارد کنید.'
      : (passwordError(password) ??
        (password !== confirm ? 'تکرار رمز عبور یکسان نیست.' : undefined));
    setError(problem ?? '');
    setNotice('');
    if (problem) return;
    pending.current = true;
    setBusy(true);
    try {
      await changePassword(current, password);
      if (mounted.current) {
        setCurrent('');
        setPassword('');
        setConfirm('');
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
  return (
    <div className="account-profile">
      <h2>رمز عبور</h2>
      {user?.username ? (
        <form onSubmit={(event) => void submit(event)} noValidate>
          <input
            type="text"
            name="username"
            autoComplete="username"
            value={user.username}
            readOnly
            hidden
          />
          <Field label="رمز عبور فعلی" htmlFor="current-password">
            <PasswordInput
              id="current-password"
              value={current}
              onChange={setCurrent}
              disabled={busy}
            />
          </Field>
          <Field label="رمز عبور جدید" htmlFor="new-password" hint={passwordHint}>
            <PasswordInput
              id="new-password"
              value={password}
              onChange={setPassword}
              disabled={busy}
              autoComplete="new-password"
            />
          </Field>
          <Field label="تکرار رمز عبور جدید" htmlFor="confirm-new-password">
            <PasswordInput
              id="confirm-new-password"
              value={confirm}
              onChange={setConfirm}
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
