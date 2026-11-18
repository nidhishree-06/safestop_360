import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  fetchCurrentUser,
  loginUser,
  logoutUser,
  registerUser,
  tokenStorage,
  updateCurrentUser,
} from '@/services/api';
import type {
  AuthUser,
  ProfileUpdatePayload,
  RegisterPayload,
  UserRole,
} from '@/types';

export function getDashboardPath(role: UserRole): string {
  switch (role) {
    case 'ADMIN':
      return '/admin';
    case 'PARTNER':
      return '/partner';
    case 'WOMAN':
    default:
      return '/app';
  }
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (payload: RegisterPayload) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<AuthUser | null>;
  updateProfile: (payload: ProfileUpdatePayload) => Promise<AuthUser>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshUser = useCallback(async () => {
    const token = tokenStorage.getAccess();
    if (!token) {
      setUser(null);
      return null;
    }
    try {
      const me = await fetchCurrentUser();
      setUser(me);
      return me;
    } catch {
      tokenStorage.clear();
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;
    refreshUser().finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await loginUser(email, password);
    tokenStorage.setTokens(res.tokens.access, res.tokens.refresh);
    setUser(res.user);
    return res.user;
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const res = await registerUser(payload);
    tokenStorage.setTokens(res.tokens.access, res.tokens.refresh);
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    const refresh = tokenStorage.getRefresh();
    try {
      if (tokenStorage.getAccess()) {
        await logoutUser(refresh);
      }
    } catch {
      // Clear local session even if backend token already expired
    } finally {
      tokenStorage.clear();
      setUser(null);
    }
  }, []);

  const updateProfile = useCallback(async (payload: ProfileUpdatePayload) => {
    const updated = await updateCurrentUser(payload);
    setUser(updated);
    return updated;
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      login,
      register,
      logout,
      refreshUser,
      updateProfile,
    }),
    [user, loading, login, register, logout, refreshUser, updateProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
