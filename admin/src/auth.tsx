import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  adminApi,
  apiRequest,
  ApiError,
  type AdminIdentity,
  type TokenPair,
  type Options,
} from "./api/client";

type Mode = "guest" | "admin";
interface AuthValue {
  mode: Mode;
  identity: AdminIdentity | null;
  requestOtp(phone: string): Promise<void>;
  verifyOtp(phone: string, code: string): Promise<void>;
  read<T>(path: string): Promise<T>;
  request<T>(path: string, options?: Omit<Options, "token">): Promise<T>;
  download(path: string): Promise<Blob>;
  logout(): void;
}

const AuthContext = createContext<AuthValue | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>("guest");
  const [identity, setIdentity] = useState<AdminIdentity | null>(null);
  const tokens = useRef<TokenPair | null>(null);
  const refreshFlight = useRef<Promise<TokenPair> | null>(null);
  const version = useRef(0);

  function clearSession() {
    version.current += 1;
    tokens.current = null;
    refreshFlight.current = null;
    setIdentity(null);
    setMode("guest");
  }

  async function requestOtp(phone: string) {
    await adminApi.requestOtp(phone);
  }

  async function verifyOtp(phone: string, code: string) {
    const pair = await adminApi.verifyOtp(phone, code);
    const person = await adminApi.me(pair.accessToken);
    if (person.role !== "ADMIN") {
      throw new ApiError(
        "این شماره به پنل مدیریت دسترسی ندارد.",
        403,
        "ADMIN_REQUIRED",
      );
    }
    version.current += 1;
    tokens.current = pair;
    setIdentity(person);
    setMode("admin");
  }

  async function request<T>(path: string, options: Omit<Options, "token"> = {}): Promise<T> {
    const pair = tokens.current;
    if (!pair) throw new ApiError("برای مشاهدهٔ داده‌ها وارد شوید.", 401);
    const startedAt = version.current;
    try {
      return await apiRequest<T>(path, { ...options, token: pair.accessToken });
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) {
        if (error instanceof ApiError && error.status === 403) clearSession();
        throw error;
      }
      if (version.current !== startedAt)
        throw new ApiError("نشست تغییر کرده است.", 401);
      // A response for the old access token can arrive after another request
      // has already rotated the one-use refresh token.
      const current = tokens.current;
      if (current && current.accessToken !== pair.accessToken) {
        try {
          return await apiRequest<T>(path, { ...options, token: current.accessToken });
        } catch (retryError) {
          if (retryError instanceof ApiError &&
            (retryError.status === 401 || retryError.status === 403) &&
            version.current === startedAt) clearSession();
          throw retryError;
        }
      }
      if (!refreshFlight.current)
        refreshFlight.current = adminApi.refresh(pair.refreshToken);
      const flight = refreshFlight.current;
      try {
        const next = await flight;
        if (version.current !== startedAt)
          throw new ApiError("نشست تغییر کرده است.", 401);
        tokens.current = next;
        return await apiRequest<T>(path, { ...options, token: next.accessToken });
      } catch (retryError) {
        if (version.current === startedAt) clearSession();
        throw retryError;
      } finally {
        if (refreshFlight.current === flight) refreshFlight.current = null;
      }
    }
  }

  function read<T>(path: string): Promise<T> {
    return request<T>(path);
  }

  function download(path: string): Promise<Blob> {
    return request<Blob>(path, { responseType: "blob" });
  }

  function logout() {
    const pair = tokens.current;
    clearSession();
    if (pair)
      void adminApi
        .logout(pair.accessToken, pair.refreshToken)
        .catch(() => undefined);
  }

  return (
    <AuthContext.Provider
      value={{
        mode,
        identity,
        requestOtp,
        verifyOtp,
        read,
        request,
        download,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthValue {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("AuthProvider is missing");
  return auth;
}
