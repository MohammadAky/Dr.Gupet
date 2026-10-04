import { useEffect, useState, type ReactNode } from "react";
import { ApiError, type PageMeta, type PageResult } from "./api/client";
import { useAuth } from "./auth";

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
export const errorMessage = (error: unknown) =>
  error instanceof ApiError
    ? error.message
    : error instanceof TypeError
      ? "اتصال به بک‌اند برقرار نشد."
      : error instanceof Error
        ? error.message
        : "درخواست انجام نشد.";

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
          if (active) setData(result);
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
  return { data, loading, error };
}

export function useDetail<T>(path: string | null, revision = 0) {
  const { request } = useAuth();
  const [data, setData] = useState<T | null>(null);
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
          if (active) setData(result);
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
  return { data, loading, error };
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
