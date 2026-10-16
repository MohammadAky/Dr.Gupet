import { useId } from 'react';
import '../styles/auth-profile-refinement.css';

/** Suggestions support stronger passwords without changing the API's acceptance rules. */
export function PasswordStrength({ value, id }: { value: string; id?: string }) {
  const generatedId = useId();
  const labelId = `${id ?? generatedId}-strength`;
  const length = Array.from(value).length;
  const checks = [
    { label: '۸ کاراکتر', met: length >= 8 },
    { label: 'حرف بزرگ انگلیسی', met: /[A-Z]/.test(value) },
    { label: 'عدد', met: /[0-9۰-۹٠-٩]/.test(value) },
  ];
  const metCount = checks.filter((check) => check.met).length;
  const score = !value ? 0 : length < 8 ? 1 : metCount < 3 ? 2 : length >= 12 ? 4 : 3;
  const label = ['قدرت رمز', 'ضعیف', 'متوسط', 'خوب', 'عالی'][score];

  return (
    <div className="password-strength" data-strength={score}>
      <div className="password-strength__heading">
        <span id={labelId}>{label}</span>
        <div className="password-strength__meter" role="meter" aria-label="قدرت رمز عبور"
          aria-valuemin={0} aria-valuemax={4} aria-valuenow={score} aria-valuetext={label}>
          {[1, 2, 3, 4].map((step) => <span key={step} data-filled={score >= step} />)}
        </div>
      </div>
      <ul className="password-strength__checks" aria-label="پیشنهادهای رمز قوی">
        {checks.map((check) => (
          <li key={check.label} data-met={check.met}>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor"
              strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="10" cy="10" r="7.5" />
              {check.met && <path d="m6.5 10 2.3 2.3 4.7-4.6" />}
            </svg>
            <span>{check.label}</span><span className="sr-only">{check.met ? '؛ دارد' : '؛ ندارد'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
