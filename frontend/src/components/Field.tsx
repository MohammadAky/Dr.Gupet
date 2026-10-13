import { Children, cloneElement, isValidElement, useId, type ReactNode } from 'react';
import { PasswordInput } from './PasswordInput';
import { ImagePicker } from './ImagePicker';

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
  const generatedId = useId();
  const existingControl = Children.toArray(children).find(
    (child) =>
      isValidElement<{ id?: string }>(child) &&
      (child.type === PasswordInput ||
        child.type === ImagePicker ||
        (typeof child.type === 'string' && ['input', 'select', 'textarea'].includes(child.type))),
  );
  const controlId =
    htmlFor ??
    (isValidElement<{ id?: string }>(existingControl) ? existingControl.props.id : undefined) ??
    generatedId;
  const descriptionId = `${controlId}-${error ? 'error' : 'hint'}`;
  const controls = Children.map(children, (child) => {
    if (
      !isValidElement<{
        id?: string;
        'aria-describedby'?: string;
        'aria-invalid'?: boolean | 'true' | 'false';
      }>(child)
    )
      return child;
    if (
      child.type !== PasswordInput &&
      child.type !== ImagePicker &&
      (typeof child.type !== 'string' || !['input', 'select', 'textarea'].includes(child.type))
    )
      return child;
    return cloneElement(child, {
      id: child.props.id ?? controlId,
      'aria-invalid': error ? true : child.props['aria-invalid'],
      'aria-describedby':
        [child.props['aria-describedby'], error || hint ? descriptionId : null]
          .filter(Boolean)
          .join(' ') || undefined,
    });
  });
  return (
    <div className="field">
      <label htmlFor={controlId}>{label}</label>
      {controls}
      {hint && !error && (
        <p id={descriptionId} className="field__hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={descriptionId} role="alert" className="field__error">
          {error}
        </p>
      )}
    </div>
  );
}
