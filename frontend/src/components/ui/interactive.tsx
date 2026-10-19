import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface DialogProps {
  open: boolean;
  title: string;
  hideTitle?: boolean;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  variant?: 'modal' | 'drawer';
  dismissible?: boolean;
}

const focusable = 'a[href], button, input, select, textarea, [contenteditable="true"], [tabindex]';

function isTabStop(node: HTMLElement) {
  if (
    node.tabIndex < 0 ||
    node.matches(':disabled, input[type="hidden"]') ||
    node.closest('[hidden], [inert]')
  )
    return false;
  for (let ancestor: HTMLElement | null = node; ancestor; ancestor = ancestor.parentElement) {
    const style = getComputedStyle(ancestor);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.visibility === 'collapse'
    )
      return false;
  }
  return true;
}

interface ModalLayer {
  container: HTMLDivElement;
  panel: HTMLDivElement;
  closeButton: HTMLButtonElement | null;
  previousFocus: HTMLElement | null;
  lastFocus: HTMLElement | null;
  dismissible(): boolean;
  close(): void;
}

// All Dialog portals share one background lock and one keyboard/focus owner.
const modalStack: ModalLayer[] = [];
let modalLock: {
  root: HTMLElement | null;
  inert: boolean;
  overflow: string;
  previousFocus: HTMLElement | null;
} | null = null;
const topModal = () => modalStack[modalStack.length - 1];

function updateModalLayers() {
  modalStack.forEach((layer, index) => {
    const top = layer === topModal();
    layer.container.inert = !top;
    layer.container.toggleAttribute('inert', !top);
    if (top) layer.container.removeAttribute('aria-hidden');
    else layer.container.setAttribute('aria-hidden', 'true');
    layer.panel.setAttribute('aria-modal', String(top));
    layer.container.style.zIndex = String(100 + index);
  });
}

function focusModal(layer: ModalLayer, preferred: HTMLElement | null = null) {
  const candidate = preferred ?? layer.lastFocus;
  if (
    candidate?.isConnected &&
    layer.panel.contains(candidate) &&
    (candidate === layer.panel || isTabStop(candidate))
  ) {
    candidate.focus({ preventScroll: true });
  } else if (layer.dismissible() && layer.closeButton && isTabStop(layer.closeButton)) {
    layer.closeButton.focus({ preventScroll: true });
  } else layer.panel.focus({ preventScroll: true });
}

function modalFocus(event: FocusEvent) {
  const layer = topModal();
  if (!layer || !(event.target instanceof HTMLElement)) return;
  if (layer.panel.contains(event.target)) layer.lastFocus = event.target;
  else focusModal(layer);
}

function modalKeydown(event: globalThis.KeyboardEvent) {
  const layer = topModal();
  if (!layer || event.defaultPrevented) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    if (layer.dismissible()) layer.close();
    return;
  }
  if (event.key !== 'Tab') return;
  const nodes = Array.from(layer.panel.querySelectorAll<HTMLElement>(focusable)).filter(isTabStop);
  const first = nodes[0],
    last = nodes[nodes.length - 1];
  if (!first || !last) {
    event.preventDefault();
    layer.panel.focus();
  } else if (
    !layer.panel.contains(document.activeElement) ||
    document.activeElement === layer.panel
  ) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  } else if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function registerModal(layer: ModalLayer) {
  if (!modalStack.length) {
    const root = document.getElementById('root');
    modalLock = {
      root,
      inert: root?.inert ?? false,
      overflow: document.body.style.overflow,
      previousFocus: layer.previousFocus,
    };
    if (root) root.inert = true;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', modalKeydown);
    document.addEventListener('focusin', modalFocus);
  }
  modalStack.push(layer);
  layer.container.inert = false;
  layer.container.removeAttribute('inert');
  layer.container.removeAttribute('aria-hidden');
  // Move focus before hiding the old layer from the accessibility tree.
  focusModal(layer);
  updateModalLayers();
  return () => {
    const index = modalStack.indexOf(layer);
    if (index === -1) return;
    const wasTop = layer === topModal();
    modalStack.splice(index, 1);
    updateModalLayers();
    const remaining = topModal();
    if (remaining) {
      if (wasTop) focusModal(remaining, layer.previousFocus);
      return;
    }
    document.removeEventListener('keydown', modalKeydown);
    document.removeEventListener('focusin', modalFocus);
    const lock = modalLock;
    modalLock = null;
    if (!lock) return;
    document.body.style.overflow = lock.overflow;
    if (lock.root) lock.root.inert = lock.inert;
    if (
      lock.previousFocus?.isConnected &&
      !lock.previousFocus.closest('[inert]') &&
      !lock.previousFocus.matches(':disabled')
    )
      lock.previousFocus.focus();
    else {
      const heading = document.querySelector<HTMLElement>('main h1');
      if (heading && !heading.closest('[inert]')) {
        heading.tabIndex = -1;
        heading.focus();
      }
    }
  };
}

export function Dialog({
  open,
  title,
  hideTitle = false,
  description,
  onClose,
  children,
  variant = 'modal',
  dismissible = true,
}: DialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const closeCallback = useRef(onClose);
  const canDismiss = useRef(dismissible);
  const layerRef = useRef<ModalLayer | null>(null);
  useLayoutEffect(() => {
    closeCallback.current = onClose;
    canDismiss.current = dismissible;
  }, [onClose, dismissible]);

  useLayoutEffect(() => {
    if (!open || !containerRef.current || !panelRef.current) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current.dataset.motion = previous?.matches(':focus-visible') ? 'instant' : 'enter';
    const layer: ModalLayer = {
      container: containerRef.current,
      panel: panelRef.current,
      closeButton: closeRef.current,
      previousFocus: previous,
      lastFocus: null,
      dismissible: () => canDismiss.current,
      close: () => closeCallback.current(),
    };
    layerRef.current = layer;
    const unregister = registerModal(layer);
    return () => {
      unregister();
      layerRef.current = null;
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div ref={containerRef} className={`ui-dialog ui-dialog--${variant}`}>
      <div
        className="ui-dialog__backdrop"
        aria-hidden="true"
        onClick={() => {
          if (dismissible && topModal() === layerRef.current) onClose();
        }}
      />
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
            <h2 id={titleId} className={hideTitle ? 'sr-only' : undefined}>
              {title}
            </h2>
            {description && <p id={descriptionId}>{description}</p>}
          </div>
          <button
            ref={closeRef}
            type="button"
            className="ui-dialog__close"
            aria-label="بستن پنجره"
            disabled={!dismissible}
            onClick={() => {
              if (dismissible && topModal() === layerRef.current) onClose();
            }}
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
      {items.map((item) => {
        const selected = active.id === item.id;
        return (
          <div
            key={item.id}
            id={`${baseId}-panel-${item.id}`}
            role="tabpanel"
            aria-labelledby={`${baseId}-tab-${item.id}`}
            tabIndex={selected ? 0 : -1}
            hidden={!selected}
            className="ui-tabs__panel"
          >
            {selected ? item.content : null}
          </div>
        );
      })}
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
