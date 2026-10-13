import '../styles/content-pages.css';
import { useMutation } from '@tanstack/react-query';
import { useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { api, type UpdateProfileInput } from '../api/endpoints';
import { useAuth } from '../auth/auth-provider';
import { Field } from '../components/Field';
import { ImagePicker } from '../components/ImagePicker';
import { LoadingState } from '../components/states';
import { validateUploadFile } from '../lib/schemas';
import { errorText } from '../lib/labels';
import { API_BASE_URL } from '../lib/env';
import { safeImageUrl } from '../lib/image-url';
import { PasswordChange } from '../components/PasswordChange';
import { AccountNav } from '../components/AccountNav';
import { SafeImage } from '../components/SafeImage';
import { focusFirstInvalid } from '../lib/form-validation';

/** Profile (F3): name + avatar editing; the phone number is read-only. */
export function ProfilePage() {
  const { user, status } = useAuth();
  if (status === 'loading')
    return (
      <section className="account-page">
        <AccountNav />
        <h1>حساب من</h1>
        <LoadingState layout="form" />
      </section>
    );
  if (status !== 'authed' || !user) return <p>برای دیدن پروفایل وارد حساب شوید.</p>;
  return <ProfileSession key={user.id} />;
}

function ProfileSession() {
  const { user, status, applyProfile } = useAuth();
  const active = useRef(true);
  const writing = useRef(false);
  useLayoutEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [avatar, setAvatar] = useState<string | null>(user?.avatar ?? null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const submitted = useRef(false);
  const [noticeKind, setNoticeKind] = useState<'success' | 'error'>('success');
  const avatarUrl = safeImageUrl(avatar, window.location.origin, API_BASE_URL);

  const save = useMutation({
    mutationFn: (payload: UpdateProfileInput) => api.updateMe(payload),
    onSuccess: (profile) => {
      if (!active.current) return;
      applyProfile(profile);
      setNotice('اطلاعات ذخیره شد.');
      setNoticeKind('success');
    },
    onError: (error) => {
      if (active.current) {
        setNotice(errorText(error));
        setNoticeKind('error');
      }
    },
    onSettled: () => {
      if (active.current) writing.current = false;
    },
  });

  const upload = useMutation({
    mutationFn: (file: File) => api.uploadImage(file),
    onSuccess: (result) => {
      if (active.current) setAvatar(result.url);
    },
    onError: (error) => {
      if (active.current) {
        setNotice(errorText(error));
        setNoticeKind('error');
      }
    },
  });

  if (status === 'loading') return <LoadingState layout="form" />;
  if (!user) return null;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!active.current || writing.current || upload.isPending) return;
    submitted.current = true;
    const errors: Record<string, string> = {};
    if (firstName.trim().length > 50) errors.firstName = 'حداکثر ۵۰ کاراکتر';
    if (lastName.trim().length > 50) errors.lastName = 'حداکثر ۵۰ کاراکتر';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      focusFirstInvalid(event.currentTarget as HTMLFormElement);
      return;
    }

    setNotice(null);
    writing.current = true;
    save.mutate({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      avatar: avatar ?? undefined,
    });
  }

  function pickFile(file: File | undefined) {
    if (!active.current || !file || upload.isPending || writing.current) return;
    const problem = validateUploadFile(file);
    if (problem) {
      setNotice(problem);
      setNoticeKind('error');
      return;
    }
    setNotice(null);
    upload.mutate(file);
  }

  return (
    <section className="account-page">
      <AccountNav />
      <header className="account-hero">
        <div className="account-hero__identity">
          {avatarUrl ? (
            <SafeImage
              src={avatarUrl}
              alt="تصویر پروفایل"
              width={76}
              height={76}
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="account-hero__avatar" aria-hidden="true">
              {(user.firstName || 'گ').slice(0, 1)}
            </span>
          )}
          <div>
            <h1>سلام، {user.firstName || 'همراه گوپت'}</h1>
            <p>همه چیز برای شما و همراه کوچکتان، در یک جا.</p>
          </div>
        </div>
        <div className="account-hero__meta">
          <span>
            شماره موبایل <bdi>{user.phone ?? 'ثبت نشده'}</bdi>
          </span>
          <span>
            نام کاربری <bdi>{user.username ?? 'هنوز ثبت نشده'}</bdi>
          </span>
        </div>
      </header>
      <div className="account-settings-grid">
        <div className="account-profile">
          <div>
            <h2>ویرایش پروفایل</h2>
            <p className="account-subtle">
              نام و تصویرتان را به‌روز کنید. شماره موبایل این حساب ثابت است.
            </p>
          </div>
          {avatarUrl && (
            <SafeImage
              className="account-pet-photo"
              src={avatarUrl}
              alt="تصویر پروفایل"
              width={96}
              height={96}
              referrerPolicy="no-referrer"
            />
          )}

          <form onSubmit={submit} noValidate aria-busy={save.isPending || upload.isPending}>
            <Field label="نام" htmlFor="firstName" error={fieldErrors.firstName}>
              <input
                id="firstName"
                autoComplete="given-name"
                disabled={save.isPending}
                value={firstName}
                onChange={(event) => {
                  setFirstName(event.target.value);
                  if (submitted.current)
                    setFieldErrors((previous) => ({
                      ...previous,
                      firstName: event.target.value.trim().length > 50 ? 'حداکثر ۵۰ کاراکتر' : '',
                    }));
                }}
              />
            </Field>
            <Field label="نام خانوادگی" htmlFor="lastName" error={fieldErrors.lastName}>
              <input
                id="lastName"
                autoComplete="family-name"
                disabled={save.isPending}
                value={lastName}
                onChange={(event) => {
                  setLastName(event.target.value);
                  if (submitted.current)
                    setFieldErrors((previous) => ({
                      ...previous,
                      lastName: event.target.value.trim().length > 50 ? 'حداکثر ۵۰ کاراکتر' : '',
                    }));
                }}
              />
            </Field>
            <Field
              label="تصویر پروفایل"
              htmlFor="avatar"
              hint="JPEG، PNG یا WebP، حداکثر ۵ مگابایت"
            >
              <ImagePicker
                id="avatar"
                label="انتخاب تصویر پروفایل"
                disabled={upload.isPending || save.isPending}
                onSelect={pickFile}
              />
            </Field>
            {upload.isPending && (
              <p role="status">در حال بارگذاری تصویر… پس از پایان، پروفایل را ذخیره کنید.</p>
            )}

            <button type="submit" disabled={save.isPending || upload.isPending}>
              {save.isPending ? 'در حال ذخیره…' : 'ذخیره'}
            </button>
          </form>

          {notice && <p role={noticeKind === 'error' ? 'alert' : 'status'}>{notice}</p>}
        </div>
        <PasswordChange />
      </div>
    </section>
  );
}
