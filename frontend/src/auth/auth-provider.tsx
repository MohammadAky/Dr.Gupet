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
import { useQueryClient } from '@tanstack/react-query';

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
  const queryClient = useQueryClient();
  const accessTokenRef = useRef<string | null>(null);
  const refreshInFlightRef = useRef<Promise<boolean> | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  const getAccessToken = useCallback(() => accessTokenRef.current, []);

  /**
   * Rotates the refresh token pair (single-flight is handled by the client).
   * On failure the whole session is dropped — mirrors the server behaviour,
   * where a consumed refresh token can never be replayed.
   */
  const rotateTokens = useCallback((): Promise<boolean> => {
    // Bootstrap effects are replayed in React StrictMode. A consumed refresh
    // token must never be sent twice, including when a 401 arrives concurrently.
    if (refreshInFlightRef.current) return refreshInFlightRef.current;
    const flight = (async () => {
      const refreshToken = tokenStorage.get();
      if (!refreshToken) return false;
      try {
        const pair = await api.refresh(refreshToken);
        // A logout or a new OTP session may have replaced this token meanwhile.
        if (tokenStorage.get() !== refreshToken) return false;
        accessTokenRef.current = pair.accessToken;
        tokenStorage.set(pair.refreshToken);
        return true;
      } catch {
        if (tokenStorage.get() === refreshToken) {
          accessTokenRef.current = null;
          tokenStorage.clear();
          queryClient.clear();
          setUser(null);
          setStatus('guest');
        }
        return false;
      }
    })();
    refreshInFlightRef.current = flight;
    void flight.finally(() => {
      if (refreshInFlightRef.current === flight) refreshInFlightRef.current = null;
    });
    return flight;
  }, [queryClient]);

  const endSession = useCallback(() => {
    accessTokenRef.current = null;
    tokenStorage.clear();
    queryClient.clear();
    setUser(null);
    setStatus('guest');
  }, [queryClient]);

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
      // All query keys are currently account-agnostic. Remove the previous
      // account's cached data before the new identity can render any page.
      queryClient.clear();
      accessTokenRef.current = result.accessToken;
      tokenStorage.set(result.refreshToken);
      await loadProfile();
      return { isNewUser: result.isNewUser };
    },
    [loadProfile, queryClient],
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
