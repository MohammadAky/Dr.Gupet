import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ApiError, type PageMeta, type PageResult } from "./api/client";
import { useAuth } from "./auth";

export const normalizeDigits = (value: string) => value
  .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776))
  .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632));

let confirmationId = 0;
export function confirmAction(message: string, action = "تأیید تغییر"): Promise<boolean> {
  if (document.querySelector(".admin-confirm")) return Promise.resolve(false);
  return new Promise((resolve) => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = document.createElement("dialog");
    const id = `admin-confirm-${++confirmationId}`;
    dialog.className = "admin-confirm";
    dialog.setAttribute("aria-labelledby", `${id}-title`);
    dialog.setAttribute("aria-describedby", `${id}-description`);
    const title = document.createElement("h2"); title.id = `${id}-title`; title.textContent = action;
    const description = document.createElement("p"); description.id = `${id}-description`; description.textContent = message;
    const actions = document.createElement("div"); actions.className = "manage-actions";
    const cancel = document.createElement("button"); cancel.type = "button"; cancel.textContent = "بازگشت";
    const accept = document.createElement("button"); accept.type = "button"; accept.className = "manage-primary"; accept.textContent = action;
    actions.append(cancel, accept); dialog.append(title, description, actions); document.body.append(dialog);
    const backgrounds = Array.from(document.body.children).filter((node): node is HTMLElement => node instanceof HTMLElement && node !== dialog);
    const inertBefore = backgrounds.map((node) => node.hasAttribute("inert"));
    backgrounds.forEach((node) => node.setAttribute("inert", ""));
    const overflow = document.body.style.overflow; document.body.style.overflow = "hidden";
    let finished = false;
    function finish(value: boolean) {
      if (finished) return; finished = true;
      dialog.remove(); backgrounds.forEach((node, index) => { if (!inertBefore[index]) node.removeAttribute("inert"); });
      document.body.style.overflow = overflow;
      if (opener?.isConnected) opener.focus();
      resolve(value);
      window.dispatchEvent(new Event("admin:confirmationclosed"));
    }
    cancel.addEventListener("click", () => finish(false)); accept.addEventListener("click", () => finish(true));
    dialog.addEventListener("cancel", (event) => { event.preventDefault(); finish(false); });
    dialog.addEventListener("keydown", (event) => {
      event.stopPropagation();
      if (event.key === "Escape") { event.preventDefault(); finish(false); }
      if (event.key === "Tab") { event.preventDefault(); (document.activeElement === cancel ? accept : cancel).focus(); }
    });
    if (typeof dialog.showModal === "function") dialog.showModal();
    else { dialog.open = true; dialog.setAttribute("role", "dialog"); dialog.setAttribute("aria-modal", "true"); }
    cancel.focus();
  });
}

export function showFieldErrors(form: HTMLFormElement, errors: Record<string, string>) {
  form.querySelectorAll("[data-field-error]").forEach((node) => node.remove());
  form.querySelectorAll("[aria-invalid='true']").forEach((node) => { node.removeAttribute("aria-invalid"); node.removeAttribute("aria-describedby"); });
  let first: HTMLElement | null = null;
  for (const [name, message] of Object.entries(errors)) {
    const field = form.elements.namedItem(name);
    if (!(field instanceof HTMLElement)) continue;
    const error = document.createElement("span"); error.id = `${name}-error-${++confirmationId}`;
    error.className = "admin-field-error"; error.dataset.fieldError = "true"; error.textContent = message;
    field.setAttribute("aria-invalid", "true"); field.setAttribute("aria-describedby", error.id);
    (field.closest("label") ?? field.parentElement)?.append(error);
    first ??= field;
  }
  first?.focus();
}

export function validateRequiredFields(form: HTMLFormElement): boolean {
  showFieldErrors(form, {});
  const errors: Record<string, string> = {};
  Array.from(form.elements).forEach((field, index) => {
    if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) || field.matches(":disabled")) return;
    if (field instanceof HTMLInputElement && ["checkbox", "radio", "hidden", "submit"].includes(field.type)) return;
    const value = field.value.trim();
    const minimum = Number(field.getAttribute("minlength"));
    const maximum = Number(field.getAttribute("maxlength"));
    let message = "";
    if (field.required && !value) message = "این فیلد را تکمیل کنید.";
    else if (value && minimum > 0 && value.length < minimum) message = `دست‌کم ${formatNumber(minimum)} نویسه وارد کنید.`;
    else if (maximum > 0 && value.length > maximum) message = `حداکثر ${formatNumber(maximum)} نویسه وارد کنید.`;
    if (message) {
      if (!field.name) field.name = `admin-field-${index}`;
      errors[field.name] = message;
    }
  });
  showFieldErrors(form, errors);
  return !Object.keys(errors).length;
}

export function markFormSaved(form: HTMLElement) {
  delete form.dataset.dirty;
  form.dispatchEvent(new Event("admin:saved", { bubbles: true }));
}
export const hasUnsavedDrafts = () => !!document.querySelector("[data-dirty='true']");
export async function discardDrafts(panel: Element | null) {
  return !(panel?.matches("[data-dirty='true']") || panel?.querySelector("[data-dirty='true']")) || await confirmAction("تغییرهای ذخیره‌نشده کنار گذاشته می‌شوند.", "کنار گذاشتن تغییرها");
}
export function useDraftProtection() {
  useEffect(() => {
    let replaying = false;
    const leaveEditor = (event: MouseEvent) => {
      if (replaying || !(event.target instanceof Element)) return;
      const button = event.target.closest<HTMLButtonElement>("button");
      if (!button || button.closest(".admin-confirm, .sidebar") || button.type === "submit" || button.hasAttribute("data-draft-keep")) return;
      const leaves = button.hasAttribute("data-draft-exit") || /^(بستن|بازگشت|انصراف|برگشت|خروج)/.test(button.textContent?.trim() ?? "") || button.matches(".manage-row-button, .catalog-link, .care-tab, .reference-item, .reference-tabs button");
      if (!leaves) return;
      const targetId = button.dataset.draftTarget;
      const owner = targetId ? document.getElementById(targetId) : button.closest("[data-draft-region]") ?? document;
      const drafts = owner ? [
        ...(owner instanceof HTMLElement && owner.matches("[data-dirty='true']") ? [owner] : []),
        ...owner.querySelectorAll<HTMLElement>("[data-dirty='true']"),
      ] : [];
      if (!drafts.length) return;
      event.preventDefault(); event.stopPropagation();
      void confirmAction("تغییرهای ذخیره‌نشده با بستن یا تعویض این پرونده کنار گذاشته می‌شوند.", "کنار گذاشتن تغییرها").then((accepted) => {
        if (!accepted || !button.isConnected) return;
        drafts.filter((draft) => draft.isConnected).forEach(markFormSaved);
        replaying = true; button.click(); replaying = false;
      });
    };
    const edit = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) return;
      if (target.hasAttribute("data-draft-selector")) return;
      const form = target.form ?? target.closest<HTMLElement>(".manage-form, .manage-card, [data-draft-editor]");
      if (!form || (!form.hasAttribute("data-draft-editor") && (form.matches(".manage-toolbar, .care-filter, .care-link-search") || form.closest(".catalog-toolbar")))) return;
      form.dataset.dirty = "true";
      if (target.hasAttribute("aria-invalid")) {
        const errorId = target.getAttribute("aria-describedby");
        if (errorId) document.getElementById(errorId)?.remove();
        target.removeAttribute("aria-invalid"); target.removeAttribute("aria-describedby");
      }
    };
    const beforeLeave = (event: BeforeUnloadEvent) => { if (hasUnsavedDrafts()) { event.preventDefault(); event.returnValue = ""; } };
    document.addEventListener("input", edit); document.addEventListener("change", edit);
    document.addEventListener("click", leaveEditor, true);
    window.addEventListener("beforeunload", beforeLeave);
    return () => { document.removeEventListener("input", edit); document.removeEventListener("change", edit); document.removeEventListener("click", leaveEditor, true); window.removeEventListener("beforeunload", beforeLeave); };
  }, []);
}

const number = new Intl.NumberFormat("fa-IR");
const date = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  dateStyle: "medium",
  timeStyle: "short",
});
export const formatNumber = (value: number | null | undefined) =>
  number.format(value ?? 0);
export const formatMoney = (value: number | null | undefined) =>
  `${formatNumber(value)} تومان`;
export const formatDate = (value: string | null | undefined) =>
  value && !Number.isNaN(Date.parse(value))
    ? date.format(new Date(value))
    : "—";
export const paymentStatusLabel = (value: string) => ({
  INITIATED: "آغازشده", SUCCESS: "موفق", FAILED: "ناموفق",
}[value] ?? value);
export const gatewayLabel = (value: string) => ({
  zarinpal: "زرین‌پال", mock: "آزمایشی", disabled: "غیرفعال",
}[value.toLowerCase()] ?? value);
export const orderStatusLabel = (value: string) => ({
  PENDING_PAYMENT: "در انتظار پرداخت", PAID: "پرداخت‌شده", PROCESSING: "در حال پردازش",
  SHIPPED: "ارسال‌شده", DELIVERED: "تحویل‌شده", CANCELED: "لغوشده",
}[value] ?? value);
export const errorMessage = (error: unknown) =>
  error instanceof ApiError
    ? error.message
    : error instanceof TypeError
      ? "اتصال برقرار نشد. ارتباط اینترنت را بررسی کنید و دوباره تلاش کنید."
      : error instanceof Error
        ? error.message
        : "درخواست انجام نشد.";

export function useInlinePanelFocus<T extends HTMLElement = HTMLElement>() {
  const panelRef = useRef<T | null>(null);
  const setPanelRef = useCallback((panel: T | null) => { panelRef.current = panel; }, []);
  const triggerRef = useRef<HTMLElement | null>(null);
  const [revealVersion, setRevealVersion] = useState(0);
  useLayoutEffect(() => {
    if (!revealVersion) return;
    const panel = panelRef.current;
    if (!panel) return;
    panel.focus({ preventScroll: true });
    panel.scrollIntoView?.({ block: "start", behavior: "auto" });
  }, [revealVersion]);
  function reveal(trigger: HTMLElement) {
    triggerRef.current = trigger;
    setRevealVersion((value) => value + 1);
  }
  function restore() {
    const trigger = triggerRef.current;
    queueMicrotask(() => {
      if (trigger?.isConnected) trigger.focus();
    });
  }
  return { panelRef: setPanelRef, reveal, restore };
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="manage-head">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action && <div className="manage-head__action">{action}</div>}
    </header>
  );
}

export function Notice({
  message,
  kind = "error",
}: {
  message: string;
  kind?: "error" | "success" | "info";
}) {
  return message ? (
    <p
      className={`manage-notice manage-notice--${kind}`}
      role={kind === "error" ? "alert" : "status"}
    >
      {message}
    </p>
  ) : null;
}

export function Paginator({
  meta,
  onPage,
}: {
  meta: PageMeta;
  onPage: (page: number) => void;
}) {
  if (meta.totalPages <= 1) return null;
  return (
    <nav className="manage-pagination" aria-label="صفحه‌بندی">
      <button
        type="button"
        disabled={meta.page <= 1}
        onClick={() => onPage(meta.page - 1)}
      >
        صفحهٔ قبل
      </button>
      <span>
        صفحهٔ {formatNumber(meta.page)} از {formatNumber(meta.totalPages)}
      </span>
      <button
        type="button"
        disabled={meta.page >= meta.totalPages}
        onClick={() => onPage(meta.page + 1)}
      >
        صفحهٔ بعد
      </button>
    </nav>
  );
}

export function usePaged<T>(path: string, revision = 0) {
  const { request } = useAuth();
  const [data, setData] = useState<PageResult<T> | null>(null);
  const [loadedPath, setLoadedPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setLoading(true);
      setError("");
      void request<PageResult<T>>(path, { withMeta: true })
        .then((result) => {
          if (active) { setData(result); setLoadedPath(path); }
        })
        .catch((problem) => {
          if (active) {
            setData(null);
            setError(errorMessage(problem));
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    });
    return () => {
      active = false;
    };
  }, [path, request, revision]);
  return { data: loading || loadedPath !== path ? null : data, loading, error };
}

export function useDetail<T>(path: string | null, revision = 0) {
  const { request } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [loadedPath, setLoadedPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      if (!path) {
        setData(null);
        setError("");
        setLoading(false);
        return;
      }
      setData(null);
      setLoading(true);
      setError("");
      void request<T>(path)
        .then((result) => {
          if (active) { setData(result); setLoadedPath(path); }
        })
        .catch((problem) => {
          if (active) {
            setData(null);
            setError(errorMessage(problem));
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    });
    return () => {
      active = false;
    };
  }, [path, request, revision]);
  return { data: loadedPath === path ? data : null, loading, error };
}

export function QueryState({
  loading,
  error,
  empty,
  onRetry,
}: {
  loading: boolean;
  error: string;
  empty?: boolean;
  onRetry?: () => void;
}) {
  if (loading)
    return (
      <p className="manage-state" role="status">
        در حال دریافت داده‌ها…
      </p>
    );
  if (error)
    return (
      <div className="manage-state" role="alert">
        <p>{error}</p>
        {onRetry && (
          <button type="button" onClick={onRetry}>
            تلاش دوباره
          </button>
        )}
      </div>
    );
  if (empty)
    return <p className="manage-state">موردی برای نمایش وجود ندارد.</p>;
  return null;
}
