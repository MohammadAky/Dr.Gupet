import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { setAuthBridge } from '../api/client';
import { api } from '../api/endpoints';
import type { UserProfile } from '../api/types';
import { tokenStorage } from '../lib/storage';

export type AuthStatus = 'loading' | 'guest' | 'authed';

interface AuthContextValue {
  status: AuthStatus;
  user: UserProfile | null;
  /** OTP verify → tokens persisted → profile loaded. */
  verifyOtp(phone: string, code: string): Promise<{ isNewUser: boolean }>;
  logout(): Promise<void>;
  /** Patch the cached profile after a successful PATCH /users/me. */
  applyProfile(profile: UserProfile): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const accessTokenRef = useRef<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  const getAccessToken = useCallback(() => accessTokenRef.current, []);

  /**
   * Rotates the refresh token pair (single-flight is handled by the client).
   * On failure the whole session is dropped — mirrors the server behaviour,
   * where a consumed refresh token can never be replayed.
   */
  const rotateTokens = useCallback(async (): Promise<boolean> => {
    const refreshToken = tokenStorage.get();
    if (!refreshToken) return false;
    try {
      const pair = await api.refresh(refreshToken);
      accessTokenRef.current = pair.accessToken;
      tokenStorage.set(pair.refreshToken);
      return true;
    } catch {
      accessTokenRef.current = null;
      tokenStorage.clear();
      setUser(null);
      setStatus('guest');
      return false;
    }
  }, []);

  const endSession = useCallback(() => {
    accessTokenRef.current = null;
    tokenStorage.clear();
    setUser(null);
    setStatus('guest');
  }, []);

  const loadProfile = useCallback(async (): Promise<boolean> => {
    try {
      const profile = await api.me();
      setUser(profile);
      setStatus('authed');
      return true;
    } catch {
      endSession();
      return false;
    }
  }, [endSession]);

  // Register the bridge used by the API client (401 → refresh → retry once).
  useEffect(() => {
    setAuthBridge({ getAccessToken, refresh: rotateTokens });
    return () => setAuthBridge(null);
  }, [getAccessToken, rotateTokens]);

  // Bootstrap: restore the session from the persisted refresh token.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!tokenStorage.get()) {
        if (!cancelled) setStatus('guest');
        return;
      }
      const ok = await rotateTokens();
      if (cancelled) return;
      if (ok) await loadProfile();
      else if (!cancelled) setStatus('guest');
    })();
    return () => {
      cancelled = true;
    };
  }, [rotateTokens, loadProfile]);

  const verifyOtp = useCallback(
    async (phone: string, code: string) => {
      const result = await api.verifyOtp(phone, code);
      accessTokenRef.current = result.accessToken;
      tokenStorage.set(result.refreshToken);
      await loadProfile();
      return { isNewUser: result.isNewUser };
    },
    [loadProfile],
  );

  const logout = useCallback(async () => {
    const refreshToken = tokenStorage.get();
    if (refreshToken) {
      try {
        await api.logout(refreshToken);
      } catch {
        // Server returns { ok: true } even for invalid tokens; ignore network errors.
      }
    }
    endSession();
  }, [endSession]);

  const applyProfile = useCallback((profile: UserProfile) => setUser(profile), []);

  const value = useMemo(
    () => ({ status, user, verifyOtp, logout, applyProfile }),
    [status, user, verifyOtp, logout, applyProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
