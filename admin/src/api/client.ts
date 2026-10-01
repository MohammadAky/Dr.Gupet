/** All admin network traffic passes through this client. */
const baseUrl = (import.meta.env.VITE_API_BASE_URL || "/api/v1").replace(
  /\/+$/,
  "",
);

interface Envelope<T> {
  success: boolean;
  data?: T;
  message?: string;
  code?: string;
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

interface Options {
  method?: "GET" | "POST";
  token?: string;
  body?: unknown;
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
        Accept: "application/json",
        ...(options.body === undefined
          ? {}
          : { "Content-Type": "application/json" }),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
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
    return payload.data as T;
  } catch (error) {
    if (controller.signal.aborted)
      throw new ApiError("زمان پاسخ‌گویی سرور تمام شد.", 0, "TIMEOUT");
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export interface AdminIdentity {
  id: number;
  firstName: string | null;
  lastName: string | null;
  phone: string;
  role: "ADMIN" | "USER";
  status: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export const adminApi = {
  requestOtp: (phone: string) =>
    apiRequest<{ expiresIn: number }>("/auth/otp/request", {
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
