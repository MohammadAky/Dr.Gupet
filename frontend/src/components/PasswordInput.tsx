import { useState } from 'react';

export function PasswordInput({
  id,
  value,
  onChange,
  disabled,
  required = false,
  autoComplete = 'current-password',
  'aria-describedby': describedBy,
  'aria-invalid': invalid,
}: {
  id: string;
  value: string;
  onChange(value: string): void;
  disabled?: boolean;
  required?: boolean;
  autoComplete?: 'current-password' | 'new-password';
  'aria-describedby'?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-input">
      <input
        id={id}
        name={id}
        type={visible ? 'text' : 'password'}
        dir="ltr"
        autoComplete={autoComplete}
        aria-describedby={describedBy}
        aria-invalid={invalid}
        value={value}
        disabled={disabled}
        required={required}
        onChange={(event) => onChange(event.target.value)}
      />
      <button
        type="button"
        aria-controls={id}
        aria-pressed={visible}
        aria-label={visible ? 'پنهان کردن رمز' : 'نمایش رمز'}
        title={visible ? 'پنهان کردن رمز' : 'نمایش رمز'}
        disabled={disabled}
        onClick={() => setVisible((previous) => !previous)}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
          {visible && <path d="m3 3 18 18" />}
        </svg>
      </button>
    </div>
  );
}
