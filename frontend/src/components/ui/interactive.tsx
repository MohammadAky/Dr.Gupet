import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './primitives';

export interface DialogProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  variant?: 'modal' | 'drawer';
}

const focusable =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Dialog({
  open,
  title,
  description,
  onClose,
  children,
  variant = 'modal',
}: DialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const closeCallback = useRef(onClose);
  useEffect(() => {
    closeCallback.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    function keydown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeCallback.current();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(focusable));
      if (!nodes.length) {
        event.preventDefault();
        panelRef.current.focus();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first && last) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last && first) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', keydown);
    return () => {
      document.removeEventListener('keydown', keydown);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className={`ui-dialog ui-dialog--${variant}`}>
      <div className="ui-dialog__backdrop" aria-hidden="true" onClick={onClose} />
      <div
        ref={panelRef}
        className="ui-dialog__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
      >
        <div className="ui-dialog__head">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description && <p id={descriptionId}>{description}</p>}
          </div>
          <button
            ref={closeRef}
            type="button"
            className="ui-dialog__close"
            aria-label="بستن پنجره"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="ui-dialog__body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
  disabled?: boolean;
}
export interface TabsProps {
  items: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  label: string;
}
export function Tabs({ items, activeId, onChange, label }: TabsProps) {
  const baseId = useId();
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const active =
    items.find((item) => item.id === activeId && !item.disabled) ??
    items.find((item) => !item.disabled);
  if (!active) return null;
  function keydown(event: KeyboardEvent<HTMLButtonElement>) {
    const enabled = items.filter((item) => !item.disabled);
    const index = enabled.findIndex((item) => item.id === active?.id);
    let next: number;
    if (event.key === 'ArrowRight') next = (index - 1 + enabled.length) % enabled.length;
    else if (event.key === 'ArrowLeft') next = (index + 1) % enabled.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = enabled.length - 1;
    else return;
    event.preventDefault();
    const target = enabled[next];
    if (target) {
      onChange(target.id);
      refs.current[target.id]?.focus();
    }
  }
  return (
    <div className="ui-tabs">
      <div role="tablist" aria-label={label} className="ui-tabs__list">
        {items.map((item) => (
          <button
            key={item.id}
            ref={(node) => {
              refs.current[item.id] = node;
            }}
            id={`${baseId}-tab-${item.id}`}
            role="tab"
            type="button"
            aria-selected={active.id === item.id}
            aria-controls={`${baseId}-panel-${item.id}`}
            tabIndex={active.id === item.id ? 0 : -1}
            disabled={item.disabled}
            onClick={() => onChange(item.id)}
            onKeyDown={keydown}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div
        id={`${baseId}-panel-${active.id}`}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-${active.id}`}
        tabIndex={0}
        className="ui-tabs__panel"
      >
        {active.content}
      </div>
    </div>
  );
}

export type ToastTone = 'success' | 'error' | 'info';
export interface ToastMessage {
  id: number;
  text: string;
  tone: ToastTone;
}
interface ToastContextValue {
  showToast: (text: string, tone?: ToastTone) => void;
  dismissToast: (id: number) => void;
}
const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([]);
  const nextId = useRef(0);
  const timers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const dismissToast = useCallback(
    (id: number) => setMessages((current) => current.filter((message) => message.id !== id)),
    [],
  );
  const showToast = useCallback(
    (text: string, tone: ToastTone = 'info') => {
      const id = ++nextId.current;
      setMessages((current) => [...current, { id, text, tone }]);
      const timer = setTimeout(() => {
        dismissToast(id);
        timers.current.delete(timer);
      }, 6000);
      timers.current.add(timer);
    },
    [dismissToast],
  );
  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      pending.clear();
    };
  }, []);
  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}
      {messages.length > 0 &&
        createPortal(
          <div className="ui-toasts" aria-label="پیام‌ها">
            {messages.map((message) => (
              <div
                key={message.id}
                role={message.tone === 'error' ? 'alert' : 'status'}
                className={`ui-toast ui-toast--${message.tone}`}
              >
                <span>{message.text}</span>
                <button
                  type="button"
                  onClick={() => dismissToast(message.id)}
                  aria-label="بستن پیام"
                >
                  ×
                </button>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}

export function DialogExample({ variant }: { variant: 'modal' | 'drawer' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button tone="secondary" onClick={() => setOpen(true)}>
        {variant === 'modal' ? 'بازکردن پنجره' : 'بازکردن کشو'}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        variant={variant}
        title="عنوان نمونه"
        description="با کلید Escape هم می‌توانید این بخش را ببندید."
      >
        <p>این یک نمونهٔ محتوای قابل‌دسترس است.</p>
        <Button onClick={() => setOpen(false)}>تأیید</Button>
      </Dialog>
    </>
  );
}
