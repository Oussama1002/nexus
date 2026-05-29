import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import * as api from '../lib/api';
import { hasAnyPermission, userHasPermissionSlug } from '../lib/navPermissions';

export type ApiUser = {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  status: string;
};

export type ApiRole = {
  id: number;
  name: string;
  slug: string;
};

export type ApiPermission = {
  id: number;
  name: string;
  slug: string;
  module: string | null;
};

export type ApiBrand = {
  id: number;
  name: string;
  code: string;
  status: string;
  whatsapp_number?: string | null;
};

export type AuthPayload = {
  token?: string;
  token_type?: string;
  user: ApiUser;
  roles: ApiRole[];
  permissions: ApiPermission[];
  brands: ApiBrand[];
};

type AuthContextValue = {
  user: ApiUser | null;
  roles: ApiRole[];
  permissions: ApiPermission[];
  accessibleBrands: ApiBrand[];
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
  hasPermission: (required: string | string[]) => boolean;
  isAdmin: boolean;
  permissionSlugs: Set<string>;
  roleSlugs: string[];
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [roles, setRoles] = useState<ApiRole[]>([]);
  const [permissions, setPermissions] = useState<ApiPermission[]>([]);
  const [accessibleBrands, setAccessibleBrands] = useState<ApiBrand[]>([]);
  const [loading, setLoading] = useState(() => !!api.getStoredToken());

  const permissionSlugs = useMemo(
    () => new Set(permissions.map((p) => p.slug)),
    [permissions],
  );

  const roleSlugs = useMemo(() => roles.map((r) => r.slug), [roles]);

  const isAdmin = useMemo(() => roleSlugs.includes('admin'), [roleSlugs]);

  const hasPermission = useCallback(
    (required: string | string[]) => {
      if (isAdmin) return true;
      const list = Array.isArray(required) ? required : [required];
      return hasAnyPermission(permissionSlugs, list);
    },
    [isAdmin, permissionSlugs],
  );

  const applyMePayload = useCallback((data: AuthPayload) => {
    setUser(data.user);
    setRoles(data.roles ?? []);
    setPermissions(data.permissions ?? []);
    setAccessibleBrands(data.brands ?? []);
  }, []);

  const fetchMe = useCallback(async () => {
    const t = api.getStoredToken();
    if (!t) {
      setUser(null);
      setRoles([]);
      setPermissions([]);
      setAccessibleBrands([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await api.get<AuthPayload>('auth/me');
    if (!res.ok || !res.data?.user) {
      setUser(null);
      setRoles([]);
      setPermissions([]);
      setAccessibleBrands([]);
      setLoading(false);
      return;
    }
    applyMePayload(res.data as AuthPayload);
    setLoading(false);
  }, [applyMePayload]);

  useEffect(() => {
    void fetchMe();
  }, [fetchMe]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<AuthPayload>('auth/login', { email, password });
    if (!res.ok || !res.data) {
      return { ok: false as const, message: res.message };
    }
    const data = res.data as AuthPayload;
    const token = data.token;
    if (!token) {
      return { ok: false as const, message: 'No token returned from server.' };
    }
    api.setStoredToken(token);
    applyMePayload(data);
    setLoading(false);
    return { ok: true as const };
  }, [applyMePayload]);

  const logout = useCallback(async () => {
    try {
      await api.post('auth/logout', {});
    } catch {
      // still clear locally
    }
    api.setStoredToken(null);
    setUser(null);
    setRoles([]);
    setPermissions([]);
    setAccessibleBrands([]);
    setLoading(false);
  }, []);

  const isAuthenticated = !!user && !!api.getStoredToken();

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      roles,
      permissions,
      accessibleBrands,
      isAuthenticated,
      loading,
      login,
      logout,
      fetchMe,
      hasPermission,
      isAdmin,
      permissionSlugs,
      roleSlugs,
    }),
    [
      user,
      roles,
      permissions,
      accessibleBrands,
      isAuthenticated,
      loading,
      login,
      logout,
      fetchMe,
      hasPermission,
      isAdmin,
      permissionSlugs,
      roleSlugs,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function checkPermissionSlug(permissionSlugs: Set<string>, isAdmin: boolean, required: string | string[]): boolean {
  if (isAdmin) return true;
  const list = Array.isArray(required) ? required : [required];
  return list.some((r) => userHasPermissionSlug(permissionSlugs, r));
}
