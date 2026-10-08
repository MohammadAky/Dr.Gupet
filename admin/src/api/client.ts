/** All admin network traffic passes through this client. */
const baseUrl = (import.meta.env.VITE_API_BASE_URL || "/api/v1").replace(
  /\/+$/,
  "",
);

interface Envelope<T> {
  success: boolean;
  data?: T;
  meta?: PageMeta;
  message?: string;
  code?: string;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PageResult<T> {
  data: T[];
  meta: PageMeta;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

export interface Options {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  token?: string;
  body?: unknown;
  formData?: FormData;
  withMeta?: boolean;
  responseType?: "json" | "blob";
}

export async function apiRequest<T>(
  path: string,
  options: Options = {},
): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? "GET",
      credentials: "omit",
      cache: "no-store",
      headers: {
        Accept: options.responseType === "blob" ? "text/csv" : "application/json",
        ...(options.body === undefined || options.formData
          ? {}
          : { "Content-Type": "application/json" }),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.formData ??
        (options.body === undefined ? undefined : JSON.stringify(options.body)),
      signal: controller.signal,
    });
    if (response.ok && options.responseType === "blob") {
      const contentType = response.headers.get("Content-Type") || "";
      if (!contentType.toLowerCase().includes("text/csv")) {
        throw new ApiError("فایل گزارش با فرمت معتبر دریافت نشد.", response.status, "INVALID_RESPONSE");
      }
      return await response.blob() as T;
    }
    const payload = (await response
      .json()
      .catch(() => null)) as Envelope<T> | null;
    if (!response.ok) {
      throw new ApiError(
        payload?.message || `خطای سرور (${response.status})`,
        response.status,
        payload?.code,
      );
    }
    if (!payload || payload.success !== true || !("data" in payload)) {
      throw new ApiError(
        "پاسخ نامعتبر از سرور دریافت شد.",
        response.status,
        "INVALID_RESPONSE",
      );
    }
    if (options.withMeta) {
      if (!payload.meta) {
        throw new ApiError("اطلاعات صفحه‌بندی از سرور دریافت نشد.", response.status, "INVALID_RESPONSE");
      }
      return { data: payload.data, meta: payload.meta } as T;
    }
    return payload.data as T;
  } catch (error) {
    if (controller.signal.aborted)
      throw new ApiError("زمان پاسخ‌گویی سرور تمام شد.", 0, "TIMEOUT");
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export function apiBlob(path: string, options: Omit<Options, "responseType"> = {}): Promise<Blob> {
  return apiRequest<Blob>(path, { ...options, responseType: "blob" });
}

export interface AdminIdentity {
  id: number;
  firstName: string | null;
  lastName: string | null;
  phone: string;
  username: string | null;
  role: "ADMIN" | "USER";
  status: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export const adminApi = {
  loginPassword: (username: string, password: string) =>
    apiRequest<TokenPair>("/auth/password/login", { method: "POST", body: { username, password } }),
  requestOtp: (phone: string) =>
    apiRequest<{ expiresIn: number; cooldownSeconds?: number }>("/auth/otp/request", {
      method: "POST",
      body: { phone },
    }),
  verifyOtp: (phone: string, code: string) =>
    apiRequest<TokenPair & { user: AdminIdentity }>("/auth/otp/verify", {
      method: "POST",
      body: { phone, code },
    }),
  refresh: (refreshToken: string) =>
    apiRequest<TokenPair>("/auth/refresh", {
      method: "POST",
      body: { refreshToken },
    }),
  logout: (accessToken: string, refreshToken: string) =>
    apiRequest<{ ok: true }>("/auth/logout", {
      method: "POST",
      token: accessToken,
      body: { refreshToken },
    }),
  me: (token: string) => apiRequest<AdminIdentity>("/admin/me", { token }),
};
