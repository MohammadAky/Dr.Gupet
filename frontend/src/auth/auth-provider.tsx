import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { setAuthBridge } from '../api/client';
import { api, type PasswordCredentials, type PasswordRegistration } from '../api/endpoints';
import type { AuthResult, UserProfile } from '../api/types';
import { tokenStorage } from '../lib/storage';
import { clearPendingOrder } from '../features/checkout/pending-order';
import { useQueryClient } from '@tanstack/react-query';

export type AuthStatus = 'loading' | 'guest' | 'authed';

interface AuthContextValue {
  status: AuthStatus;
  user: UserProfile | null;
  /** OTP verify → tokens persisted → profile loaded. */
  verifyOtp(phone: string, code: string): Promise<{ isNewUser: boolean }>;
  loginPassword(credentials: PasswordCredentials): Promise<{ isNewUser: boolean }>;
  registerPassword(credentials: PasswordRegistration): Promise<{ isNewUser: boolean }>;
  changePassword(currentPassword: string, newPassword: string): Promise<{ isNewUser: boolean }>;
  logout(): Promise<void>;
  /** Patch the cached profile after a successful PATCH /users/me. */
  applyProfile(profile: UserProfile): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const accessTokenRef = useRef<string | null>(null);
  const refreshInFlightRef = useRef<{ epoch: number; promise: Promise<boolean> } | null>(null);
  const sessionEpochRef = useRef(0);
  const mountedRef = useRef(false);
  const userRef = useRef<UserProfile | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  useLayoutEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const isCurrent = useCallback(
    (epoch: number) => mountedRef.current && sessionEpochRef.current === epoch,
    [],
  );

  const getAccessToken = useCallback(
    () => (mountedRef.current ? accessTokenRef.current : null),
    [],
  );

  const endSession = useCallback(() => {
    sessionEpochRef.current += 1;
    accessTokenRef.current = null;
    userRef.current = null;
    tokenStorage.clear();
    clearPendingOrder();
    queryClient.clear();
    if (mountedRef.current) {
      setUser(null);
      setStatus('guest');
    }
  }, [queryClient]);

  /**
   * Rotates the refresh token pair (single-flight is handled by the client).
   * On failure the whole session is dropped — mirrors the server behaviour,
   * where a consumed refresh token can never be replayed.
   */
  const rotateTokens = useCallback((): Promise<boolean> => {
    // Bootstrap effects are replayed in React StrictMode. A consumed refresh
    // token must never be sent twice, including when a 401 arrives concurrently.
    const epoch = sessionEpochRef.current;
    if (!isCurrent(epoch)) return Promise.resolve(false);
    if (refreshInFlightRef.current?.epoch === epoch) return refreshInFlightRef.current.promise;
    const flight = (async () => {
      const refreshToken = tokenStorage.get();
      if (!refreshToken) return false;
      try {
        const pair = await api.refresh(refreshToken);
        // A logout or a new OTP session may have replaced this token meanwhile.
        if (!isCurrent(epoch) || tokenStorage.get() !== refreshToken) return false;
        accessTokenRef.current = pair.accessToken;
        tokenStorage.set(pair.refreshToken);
        return true;
      } catch {
        if (isCurrent(epoch) && tokenStorage.get() === refreshToken) endSession();
        return false;
      }
    })();
    const trackedFlight = { epoch, promise: flight };
    refreshInFlightRef.current = trackedFlight;
    void flight.finally(() => {
      if (refreshInFlightRef.current === trackedFlight) refreshInFlightRef.current = null;
    });
    return flight;
  }, [endSession, isCurrent]);

  const loadProfile = useCallback(
    async (epoch: number): Promise<boolean> => {
      if (!isCurrent(epoch)) return false;
      try {
        const profile = await api.me();
        if (!isCurrent(epoch)) return false;
        userRef.current = profile;
        setUser(profile);
        setStatus('authed');
        return true;
      } catch {
        if (isCurrent(epoch)) endSession();
        return false;
      }
    },
    [endSession, isCurrent],
  );

  // Register the bridge used by the API client (401 → refresh → retry once).
  useEffect(() => {
    setAuthBridge({ getAccessToken, refresh: rotateTokens });
    return () => setAuthBridge(null);
  }, [getAccessToken, rotateTokens]);

  // Bootstrap: restore the session from the persisted refresh token.
  useEffect(() => {
    let cancelled = false;
    const epoch = sessionEpochRef.current;
    void (async () => {
      if (!tokenStorage.get()) {
        if (!cancelled && isCurrent(epoch)) setStatus('guest');
        return;
      }
      const ok = await rotateTokens();
      if (cancelled || !isCurrent(epoch)) return;
      if (ok) await loadProfile(epoch);
      else setStatus('guest');
    })();
    return () => {
      cancelled = true;
    };
  }, [rotateTokens, loadProfile, isCurrent]);

  const establishSession = useCallback(
    async (authenticate: () => Promise<AuthResult>, keepProfile = false) => {
      if (!mountedRef.current) throw new Error('ورود لغو شد. دوباره تلاش کنید.');
      const epoch = ++sessionEpochRef.current;
      const result = await authenticate();
      if (!isCurrent(epoch)) throw new Error('ورود لغو شد. دوباره تلاش کنید.');
      // All query keys are currently account-agnostic. Remove the previous
      // account's cached data before the new identity can render any page.
      queryClient.clear();
      clearPendingOrder();
      if (!keepProfile) {
        userRef.current = null;
        setUser(null);
        setStatus('loading');
      }
      accessTokenRef.current = result.accessToken;
      tokenStorage.set(result.refreshToken);
      if (!(await loadProfile(epoch))) {
        throw new Error('دریافت حساب ممکن نشد. دوباره وارد شوید.');
      }
      if (!isCurrent(epoch)) throw new Error('ورود لغو شد. دوباره تلاش کنید.');
      return { isNewUser: result.isNewUser };
    },
    [isCurrent, loadProfile, queryClient],
  );

  const verifyOtp = useCallback(
    (phone: string, code: string) => establishSession(() => api.verifyOtp(phone, code)),
    [establishSession],
  );
  const loginPassword = useCallback(
    (credentials: PasswordCredentials) => establishSession(() => api.loginPassword(credentials)),
    [establishSession],
  );
  const registerPassword = useCallback(
    (credentials: PasswordRegistration) =>
      establishSession(() => api.registerPassword(credentials)),
    [establishSession],
  );
  const changePassword = useCallback(
    (currentPassword: string, newPassword: string) =>
      establishSession(() => api.changePassword({ currentPassword, newPassword }), true),
    [establishSession],
  );

  const logout = useCallback(async () => {
    const refreshToken = tokenStorage.get();
    // Start revocation while the access token is still available to the API
    // client, then clear private browser state without waiting for the network.
    const revoke = refreshToken ? api.logout(refreshToken) : null;
    endSession();
    if (revoke) {
      try {
        await revoke;
      } catch {
        // Server returns { ok: true } even for invalid tokens; ignore network errors.
      }
    }
  }, [endSession]);

  const applyProfile = useCallback((profile: UserProfile) => {
    if (!mountedRef.current || userRef.current?.id !== profile.id) return;
    userRef.current = profile;
    setUser(profile);
  }, []);

  const value = useMemo(
    () => ({
      status,
      user,
      verifyOtp,
      loginPassword,
      registerPassword,
      changePassword,
      logout,
      applyProfile,
    }),
    [
      status,
      user,
      verifyOtp,
      loginPassword,
      registerPassword,
      changePassword,
      logout,
      applyProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
