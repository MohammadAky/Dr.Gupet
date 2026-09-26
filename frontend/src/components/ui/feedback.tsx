import type { ComponentPropsWithRef, ReactNode } from 'react';
import { Button } from './primitives';

export interface SkeletonProps extends ComponentPropsWithRef<'span'> {
  width?: string;
  height?: string;
}
export function Skeleton({
  width = '100%',
  height = '1rem',
  style,
  className = '',
  ...props
}: SkeletonProps) {
  return (
    <span
      {...props}
      aria-hidden="true"
      className={`ui-skeleton ${className}`}
      style={{ width, height, ...style }}
    />
  );
}

export interface EmptyProps {
  title: string;
  description?: string;
  action?: ReactNode;
}
export function EmptyState({ title, description, action }: EmptyProps) {
  return (
    <div className="ui-state">
      <span className="ui-state__mark" aria-hidden="true">
        ○
      </span>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}

export interface ErrorProps {
  title?: string;
  description: string;
  onRetry?: () => void;
}
export function ErrorState({ title = 'خطایی رخ داد', description, onRetry }: ErrorProps) {
  return (
    <div className="ui-state ui-state--error" role="alert">
      <span className="ui-state__mark" aria-hidden="true">
        !
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {onRetry && (
        <Button tone="secondary" onClick={onRetry}>
          تلاش دوباره
        </Button>
      )}
    </div>
  );
}

export interface AlertProps extends ComponentPropsWithRef<'div'> {
  title?: string;
  tone?: 'info' | 'success' | 'warning' | 'error';
}
export function Alert({ title, tone = 'info', className = '', children, ...props }: AlertProps) {
  return (
    <div
      {...props}
      role={tone === 'error' ? 'alert' : 'status'}
      className={`ui-alert ui-alert--${tone} ${className}`}
    >
      {title && <strong>{title}</strong>}
      <div>{children}</div>
    </div>
  );
}

export interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  label?: string;
}
export function Pagination({ page, totalPages, onChange, label = 'صفحه‌بندی' }: PaginationProps) {
  if (totalPages <= 1) return null;
  const current = Math.min(Math.max(page, 1), totalPages);
  const pages = Array.from(
    new Set(
      [1, current - 1, current, current + 1, totalPages].filter(
        (value) => value >= 1 && value <= totalPages,
      ),
    ),
  ).sort((a, b) => a - b);
  return (
    <nav aria-label={label} className="ui-pagination">
      <Button tone="quiet" disabled={current === 1} onClick={() => onChange(current - 1)}>
        قبلی
      </Button>
      {pages.map((number, index) => (
        <span key={number} className="ui-pagination__item">
          {index > 0 && number - pages[index - 1]! > 1 && <span aria-hidden="true">…</span>}
          <button
            type="button"
            aria-label={`صفحهٔ ${number}`}
            aria-current={number === current ? 'page' : undefined}
            onClick={() => onChange(number)}
          >
            {number.toLocaleString('fa-IR')}
          </button>
        </span>
      ))}
      <Button tone="quiet" disabled={current === totalPages} onClick={() => onChange(current + 1)}>
        بعدی
      </Button>
    </nav>
  );
}

export interface Step {
  label: string;
  description?: string;
}
export interface StepperProps {
  steps: Step[];
  currentStep: number;
  label?: string;
}
export function Stepper({ steps, currentStep, label = 'مراحل' }: StepperProps) {
  return (
    <ol aria-label={label} className="ui-stepper">
      {steps.map((step, index) => (
        <li
          key={`${step.label}-${index}`}
          aria-current={index === currentStep ? 'step' : undefined}
          className={index < currentStep ? 'ui-stepper__done' : ''}
        >
          <span className="ui-stepper__number">{(index + 1).toLocaleString('fa-IR')}</span>
          <span>
            <strong>{step.label}</strong>
            {step.description && <small>{step.description}</small>}
          </span>
        </li>
      ))}
    </ol>
  );
}

export interface Crumb {
  label: string;
  href?: string;
}
export interface BreadcrumbProps {
  items: Crumb[];
  label?: string;
}
export function Breadcrumb({ items, label = 'مسیر صفحه' }: BreadcrumbProps) {
  return (
    <nav aria-label={label} className="ui-breadcrumb">
      <ol>
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`}>
            {index > 0 && <span aria-hidden="true">/</span>}
            {item.href && index < items.length - 1 ? (
              <a href={item.href}>{item.label}</a>
            ) : (
              <span aria-current={index === items.length - 1 ? 'page' : undefined}>
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
