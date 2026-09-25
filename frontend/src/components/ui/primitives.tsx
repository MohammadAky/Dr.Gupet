import { useId } from 'react';
import type { ComponentPropsWithRef, ReactNode } from 'react';

type Tone = 'primary' | 'secondary' | 'quiet' | 'danger';

export interface ButtonProps extends ComponentPropsWithRef<'button'> {
  tone?: Tone;
  size?: 'sm' | 'md';
  pending?: boolean;
}

export function Button({
  tone = 'primary',
  size = 'md',
  pending = false,
  className = '',
  disabled,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={`ui-button ui-button--${tone} ui-button--${size} ${className}`}
    >
      {pending && <span className="ui-spinner" aria-hidden="true" />}
      <span>{children}</span>
      {pending && <span className="sr-only">در حال انجام…</span>}
    </button>
  );
}

interface ControlLabelProps {
  label: string;
  hint?: string;
  error?: string;
}

function ControlFrame({
  id,
  label,
  hint,
  error,
  children,
}: ControlLabelProps & { id: string; children: ReactNode }) {
  return (
    <div className="ui-field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && !error && <small id={`${id}-hint`}>{hint}</small>}
      {error && (
        <small id={`${id}-error`} className="ui-field__error">
          {error}
        </small>
      )}
    </div>
  );
}

type TextProps = Omit<ComponentPropsWithRef<'input'>, 'size'> & ControlLabelProps;
export function Input({
  label,
  hint,
  error,
  id,
  className = '',
  type = 'text',
  ...props
}: TextProps) {
  const generated = useId();
  const controlId = id ?? generated;
  return (
    <ControlFrame id={controlId} label={label} hint={hint} error={error}>
      <input
        {...props}
        id={controlId}
        type={type}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={error ? `${controlId}-error` : hint ? `${controlId}-hint` : undefined}
        className={`ui-control ${className}`}
      />
    </ControlFrame>
  );
}

export interface SelectProps extends ComponentPropsWithRef<'select'>, ControlLabelProps {}
export function Select({
  label,
  hint,
  error,
  id,
  className = '',
  children,
  ...props
}: SelectProps) {
  const generated = useId();
  const controlId = id ?? generated;
  return (
    <ControlFrame id={controlId} label={label} hint={hint} error={error}>
      <select
        {...props}
        id={controlId}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={error ? `${controlId}-error` : hint ? `${controlId}-hint` : undefined}
        className={`ui-control ${className}`}
      >
        {children}
      </select>
    </ControlFrame>
  );
}

export interface TextareaProps extends ComponentPropsWithRef<'textarea'>, ControlLabelProps {}
export function Textarea({ label, hint, error, id, className = '', ...props }: TextareaProps) {
  const generated = useId();
  const controlId = id ?? generated;
  return (
    <ControlFrame id={controlId} label={label} hint={hint} error={error}>
      <textarea
        {...props}
        id={controlId}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={error ? `${controlId}-error` : hint ? `${controlId}-hint` : undefined}
        className={`ui-control ${className}`}
      />
    </ControlFrame>
  );
}

export interface CheckProps extends Omit<ComponentPropsWithRef<'input'>, 'type'> {
  label: string;
  hint?: string;
  error?: string;
}

function CheckControl({
  kind,
  label,
  hint,
  error,
  id,
  className = '',
  ...props
}: CheckProps & { kind: 'checkbox' | 'radio' }) {
  const generated = useId();
  const controlId = id ?? generated;
  return (
    <div className="ui-check-wrap">
      <label className={`ui-check ${className}`} htmlFor={controlId}>
        <input
          {...props}
          id={controlId}
          type={kind}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? `${controlId}-error` : hint ? `${controlId}-hint` : undefined}
        />
        <span>{label}</span>
      </label>
      {hint && !error && <small id={`${controlId}-hint`}>{hint}</small>}
      {error && (
        <small id={`${controlId}-error`} className="ui-field__error">
          {error}
        </small>
      )}
    </div>
  );
}

export function Checkbox(props: CheckProps) {
  return <CheckControl {...props} kind="checkbox" />;
}
export function Radio(props: CheckProps) {
  return <CheckControl {...props} kind="radio" />;
}

export interface BadgeProps extends ComponentPropsWithRef<'span'> {
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
}
export function Badge({ tone = 'neutral', className = '', ...props }: BadgeProps) {
  return <span {...props} className={`ui-badge ui-badge--${tone} ${className}`} />;
}

export interface ChipProps extends ComponentPropsWithRef<'button'> {
  selected?: boolean;
}
export function Chip({ selected = false, className = '', type = 'button', ...props }: ChipProps) {
  return (
    <button
      {...props}
      type={type}
      aria-pressed={selected}
      className={`ui-chip ${selected ? 'ui-chip--selected' : ''} ${className}`}
    />
  );
}

export type CardProps = ComponentPropsWithRef<'article'>;
export function Card({ className = '', ...props }: CardProps) {
  return <article {...props} className={`ui-card ${className}`} />;
}
