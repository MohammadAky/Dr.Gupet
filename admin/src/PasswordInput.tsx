import { useState } from "react";
export function PasswordInput({ id, value, onChange, disabled, autoComplete = "new-password" }: {
  id: string; value: string; onChange(value: string): void; disabled?: boolean;
  autoComplete?: "current-password" | "new-password";
}) {
  const [visible, setVisible] = useState(false);
  return <div className="password-input">
    <input id={id} name={id} type={visible ? "text" : "password"} dir="ltr" autoComplete={autoComplete}
      value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
    <button type="button" aria-controls={id} aria-pressed={visible} disabled={disabled}
      aria-label={visible ? "پنهان کردن رمز" : "نمایش رمز"}
      onClick={() => setVisible((previous) => !previous)}>
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {visible ? <><path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.2 5.3A10 10 0 0 1 12 5c6 0 10 7 10 7a18 18 0 0 1-3.2 3.8M6.2 6.2A18 18 0 0 0 2 12s4 7 10 7a10 10 0 0 0 4.8-1.2" /></> : <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>}
      </svg>
    </button>
  </div>;
}
