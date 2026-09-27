import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, type UpdateProfileInput } from '../api/endpoints';
import { useAuth } from '../auth/auth-provider';
import { Field } from '../components/Field';
import { ErrorState, LoadingState } from '../components/states';
import { validateUploadFile } from '../lib/schemas';
import { errorText } from '../lib/labels';
import { API_BASE_URL } from '../lib/env';
import { safeImageUrl } from '../lib/image-url';

/** Profile (F3): name + avatar editing; the phone number is read-only. */
export function ProfilePage() {
  const { user, status, applyProfile, previewMode } = useAuth();

  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [avatar, setAvatar] = useState<string | null>(user?.avatar ?? null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const avatarUrl = safeImageUrl(avatar, window.location.origin, API_BASE_URL);

  const save = useMutation({
    mutationFn: (payload: UpdateProfileInput) => api.updateMe(payload),
    onSuccess: (profile) => {
      applyProfile(profile);
      setNotice('اطلاعات ذخیره شد.');
    },
    onError: (error) => setNotice(errorText(error)),
  });

  const upload = useMutation({
    mutationFn: (file: File) => api.uploadImage(file),
    onSuccess: (result) => setAvatar(result.url),
    onError: (error) => setNotice(errorText(error)),
  });

  if (status === 'loading') return <LoadingState />;
  if (!user) return null;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (previewMode) {
      setNotice('ذخیره‌سازی در حالت نمایشی فعال نیست.');
      return;
    }
    const errors: Record<string, string> = {};
    if (firstName.trim().length > 50) errors.firstName = 'حداکثر ۵۰ کاراکتر';
    if (lastName.trim().length > 50) errors.lastName = 'حداکثر ۵۰ کاراکتر';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setNotice(null);
    save.mutate({
      firstName: firstName.trim() || undefined,
      lastName: lastName.trim() || undefined,
      avatar: avatar ?? undefined,
    });
  }

  function pickFile(file: File | undefined) {
    if (!file) return;
    if (previewMode) {
      setNotice('آپلود در حالت نمایشی فعال نیست.');
      return;
    }
    const problem = validateUploadFile(file);
    if (problem) {
      setNotice(problem);
      return;
    }
    setNotice(null);
    upload.mutate(file);
  }

  return (
    <section className="account-page">
      <div className="account-hero">
        <span className="eyebrow">حساب کاربری</span>
        <h1>سلام، {user.firstName || 'همراه گوپت'}</h1>
        <p>اطلاعات حساب و بخش‌های شخصی شما اینجاست.</p>
        <span dir="ltr" className="account-hero__phone">
          {user.phone}
        </span>
      </div>
      <nav className="account-grid" aria-label="بخش‌های حساب">
        <Link to="/addresses">
          <strong>آدرس‌های من</strong>
          <span>مدیریت نشانی‌های ارسال</span>
          <b aria-hidden="true">←</b>
        </Link>
        <Link to="/pets">
          <strong>حیوانات من</strong>
          <span>پروفایل و نیازهای هر پت</span>
          <b aria-hidden="true">←</b>
        </Link>
        <Link to="/orders">
          <strong>سفارش‌ها</strong>
          <span>پیگیری سفارش‌های ثبت‌شده</span>
          <b aria-hidden="true">←</b>
        </Link>
        <Link to="/favorites">
          <strong>علاقه‌مندی‌ها</strong>
          <span>محصولات ذخیره‌شده</span>
          <b aria-hidden="true">←</b>
        </Link>
        <Link to="/recommendations">
          <strong>پیشنهادهای من</strong>
          <span>پیشنهادهای متناسب با پت</span>
          <b aria-hidden="true">←</b>
        </Link>
      </nav>
      <div className="account-profile">
        <div>
          <span className="eyebrow">اطلاعات شخصی</span>
          <h2>ویرایش پروفایل</h2>
        </div>
        {avatarUrl && (
          <img
            src={avatarUrl}
            alt="تصویر پروفایل"
            width={96}
            height={96}
            referrerPolicy="no-referrer"
          />
        )}

        <form onSubmit={submit} noValidate>
          <Field label="نام" htmlFor="firstName" error={fieldErrors.firstName}>
            <input
              id="firstName"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
            />
          </Field>
          <Field label="نام خانوادگی" htmlFor="lastName" error={fieldErrors.lastName}>
            <input
              id="lastName"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
            />
          </Field>
          <Field label="تصویر پروفایل" htmlFor="avatar" hint="JPEG، PNG یا WebP — حداکثر ۵ مگابایت">
            <input
              id="avatar"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => pickFile(event.target.files?.[0])}
            />
          </Field>

          <button type="submit" disabled={save.isPending}>
            {save.isPending ? 'در حال ذخیره…' : 'ذخیره'}
          </button>
        </form>

        {notice && <p role="status">{notice}</p>}
        {save.error && <ErrorState error={save.error} />}
      </div>
    </section>
  );
}
