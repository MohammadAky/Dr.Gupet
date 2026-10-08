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
      onClick={() => setVisible((previous) => !previous)}>{visible ? "پنهان کردن رمز" : "نمایش رمز"}</button>
  </div>;
}
