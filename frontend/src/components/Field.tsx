import type { ReactNode } from 'react';

/** Label + control + Persian error message. Presentation belongs to the design layer. */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && !error && <p className="field__hint">{hint}</p>}
      {error && (
        <p role="alert" className="field__error">
          {error}
        </p>
      )}
    </div>
  );
}
