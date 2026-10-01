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
} from "./api/client";

type Mode = "guest" | "admin" | "preview";
interface AuthValue {
  mode: Mode;
  identity: AdminIdentity | null;
  requestOtp(phone: string): Promise<void>;
  verifyOtp(phone: string, code: string): Promise<void>;
  read<T>(path: string): Promise<T>;
  enterPreview(): void;
  logout(): void;
}

const AuthContext = createContext<AuthValue | null>(null);
export const LOCAL_PREVIEW =
  import.meta.env.DEV &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");

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

  async function read<T>(path: string): Promise<T> {
    const pair = tokens.current;
    if (!pair) throw new ApiError("برای مشاهدهٔ داده‌ها وارد شوید.", 401);
    const startedAt = version.current;
    try {
      return await apiRequest<T>(path, { token: pair.accessToken });
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) {
        if (error instanceof ApiError && error.status === 403) clearSession();
        throw error;
      }
      if (!refreshFlight.current)
        refreshFlight.current = adminApi.refresh(pair.refreshToken);
      try {
        const next = await refreshFlight.current;
        if (version.current !== startedAt)
          throw new ApiError("نشست تغییر کرده است.", 401);
        tokens.current = next;
        return await apiRequest<T>(path, { token: next.accessToken });
      } catch (retryError) {
        if (version.current === startedAt) clearSession();
        throw retryError;
      } finally {
        refreshFlight.current = null;
      }
    }
  }

  function enterPreview() {
    if (!LOCAL_PREVIEW) return;
    const url = new URL(window.location.href);
    if (url.searchParams.has("demo")) {
      url.searchParams.delete("demo");
      window.history.replaceState(
        null,
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
    }
    clearSession();
    setIdentity({
      id: 0,
      firstName: "مدیر نمونه",
      lastName: null,
      phone: "—",
      role: "ADMIN",
      status: "PREVIEW",
    });
    setMode("preview");
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
        enterPreview,
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
