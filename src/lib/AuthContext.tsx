import React, { createContext, useCallback, useContext, useEffect, useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/apiClient';
import { ApiError, SESSION_EXPIRED_EVENT } from '../services/helper';
import { clearLinkToken, refreshLinkToken } from './linkToken';

/** Set when the session ends mid-use: why, and the page to return to after signing in again (read by Login). */
export const SIGNED_OUT_KEY = 'signedOut';

// While the server can't be reached (restarting, network blip), keep the sign-in and try again.
const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 15000];
// Link tokens last a few hours; a fresh one every 30 minutes keeps every link on the page valid.
const LINK_TOKEN_REFRESH_MS = 30 * 60_000;
// The server signs people out after 30 minutes without activity, and only changes count, so tell it while
// someone is actually using the page (clicking, typing, scrolling), at most this often.
const HEARTBEAT_EVERY_MS = 4 * 60_000;

const clearStoredSession = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('ms_id_token');
  sessionStorage.clear();
  clearLinkToken();
};

export interface User {
  id: string;
  email: string;
  full_name: string;
  is_super_admin: boolean;
  is_active?: boolean;
  department?: string;
  job_title?: string;
}

export interface Role {
  id: string;
  name: string;
  code: string;
  description?: string;
  is_active?: boolean;
  is_system_role?: boolean;
  parent_role_id?: string | null;
  display_order?: number;
  department?: string;
  children?: Role[];
}

interface PermissionsData {
  user: User;
  roles: Role[];
  navigation_permissions: Record<string, string[]>;
  mcp_tool_permissions: string[];
}

interface AuthContextType {
  user: User | null;
  roles: Role[];
  isLoading: boolean;
  /** Permissions couldn't be loaded because the server didn't answer; it's retrying and the sign-in is kept. */
  serverUnreachable: boolean;
  canAccessNavigationItem: (navigationCode: string, actionCode?: string) => boolean;
  hasPermission: (permissionCode: string) => boolean;
  canUseMcpTool: (toolCode: string) => boolean;
  hasRole: (roleCode: string) => boolean;
  logout: () => Promise<void>;
  refreshPermissions: () => Promise<PermissionsData | null>;
  /** Super admins can view the app as a reviewer or as a content creator; everyone else's role decides it. */
  canSwitchView: boolean;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  /** A super admin viewing the app as a creator: only their own content, and no review actions. */
  creatorView: boolean;
}

export type ViewMode = "reviewer" | "creator";

const VIEW_MODE_KEY = "portal.viewMode";
// What a creator doesn't do: review and approve, see everyone's content, delete other people's drafts. In creator
// view these read as not granted, so every screen shows the creator's side. It's only a view: the server still
// allows a super admin everything.
const REVIEWER_ONLY_PERMISSIONS = new Set(["CONTENT_REVIEW_APPROVE", "CONTENT_SUBMISSIONS_VIEW", "CONTENT_SUBMISSIONS_DELETE"]);

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [permissions, setPermissions] = useState<PermissionsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [serverUnreachable, setServerUnreachable] = useState(false);
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    try {
      return localStorage.getItem(VIEW_MODE_KEY) === "creator" ? "creator" : "reviewer";
    } catch {
      return "reviewer";
    }
  });
  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode);
    try {
      localStorage.setItem(VIEW_MODE_KEY, mode);
    } catch {
      // the choice just won't be remembered
    }
  }, []);

  const fetchRequestId = useRef(0);

  const fetchPermissions = useCallback(async () => {
    const requestId = ++fetchRequestId.current;
    setIsLoading(true);
    try {
      for (let attempt = 0; ; attempt++) {
        try {
          const data = await apiClient.get<PermissionsData>('/api/me/permissions');
          // Before the app renders, so images and videos load with it straight away. Without it they just don't
          // load; that shouldn't block signing in.
          await refreshLinkToken().catch(() => undefined);
          if (requestId === fetchRequestId.current) {
            setPermissions(data);
            setServerUnreachable(false);
          }
          return data;
        } catch (err) {
          if (requestId !== fetchRequestId.current) return null;
          // Only the server saying the sign-in is invalid ends the session. A restart, network error or
          // server error mustn't sign anyone out.
          if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
            setPermissions(null);
            setServerUnreachable(false);
            clearStoredSession();
            return null;
          }
          // Nobody is signed in on this tab, so there's no session to keep: show the login page.
          if (!sessionStorage.getItem('token')) {
            setPermissions(null);
            setServerUnreachable(false);
            return null;
          }
          setServerUnreachable(true);
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)]));
          if (requestId !== fetchRequestId.current) return null;
        }
      }
    } finally {
      if (requestId === fetchRequestId.current) {
        setIsLoading(false);
      }
    }
  }, []);

  // Only the Logout button logs out; refreshing or closing the tab keeps the session.
  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const signedIn = Boolean(permissions);
  useEffect(() => {
    if (!signedIn) return;
    const refresh = window.setInterval(() => refreshLinkToken().catch(() => undefined), LINK_TOKEN_REFRESH_MS);
    let active = false;
    let lastBeat = Date.now();
    const onActivity = () => {
      active = true;
    };
    const events = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    const beat = window.setInterval(() => {
      if (!active || Date.now() - lastBeat < HEARTBEAT_EVERY_MS) return;
      active = false;
      lastBeat = Date.now();
      apiClient.post('/api/auth/heartbeat', undefined, { skipGlobalLoading: true }).catch(() => undefined);
    }, 30_000);
    return () => {
      window.clearInterval(refresh);
      window.clearInterval(beat);
      events.forEach((e) => window.removeEventListener(e, onActivity));
    };
  }, [signedIn]);

  // A request was refused because the sign-in ended (e.g. signed out after inactivity): go to the login page
  // straight away, instead of leaving pages showing load errors until the next refresh.
  const queryClient = useQueryClient();
  const signedInRef = useRef(false);
  useEffect(() => {
    signedInRef.current = Boolean(permissions);
  }, [permissions]);
  useEffect(() => {
    const onExpired = (e: Event) => {
      if (!signedInRef.current) return; // not signed in yet (e.g. on the login page), or already handled
      signedInRef.current = false;
      fetchRequestId.current++; // drop any permissions load still in flight
      const returnTo = window.location.pathname + window.location.search;
      clearStoredSession();
      sessionStorage.setItem(SIGNED_OUT_KEY, JSON.stringify({ reason: (e as CustomEvent<string>).detail, returnTo }));
      queryClient.clear(); // nothing from this session stays on screen or in memory
      setPermissions(null);
      setIsLoading(false);
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [queryClient]);



  const canAccessNavigationItem = (navigationCode: string, actionCode = 'VIEW') => {
    if (!permissions) return false;
    if (permissions.user.is_super_admin) return true;
    if (permissions.roles.some((r) => r.code === 'SUPER_ADMIN')) return true;
    
    const pageActions = permissions.navigation_permissions[navigationCode];
    if (!pageActions) return false;
    
    return pageActions.includes(actionCode);
  };

  const canSwitchView = Boolean(permissions && (permissions.user.is_super_admin || permissions.roles.some((r) => r.code === 'SUPER_ADMIN')));
  const creatorView = canSwitchView && viewMode === "creator";

  const hasPermission = (permissionCode: string) => {
    if (!permissions) return false;
    if (creatorView && REVIEWER_ONLY_PERMISSIONS.has(permissionCode)) return false;
    if (permissions.user.is_super_admin) return true;
    if (permissions.roles.some((r) => r.code === 'SUPER_ADMIN')) return true;
    
    const lastUnderscoreIndex = permissionCode.lastIndexOf('_');
    let navigationCode = permissionCode;
    let actionCode = 'PAGE_ACCESS';
    
    if (lastUnderscoreIndex !== -1) {
      navigationCode = permissionCode.substring(0, lastUnderscoreIndex);
      actionCode = permissionCode.substring(lastUnderscoreIndex + 1);
    }
    
    const actionMap: Record<string, string> = {
      "READ": "VIEW",
      "UPDATE": "UPDATE",
      "CREATE": "CREATE",
      "DELETE": "DELETE",
      "IMPORT": "CREATE",
      "EXPORT": "VIEW",
      "PROCESS": "UPDATE",
      "PAGE_ACCESS": "VIEW"
    };
    
    const dbActionCode = actionMap[actionCode] || actionCode;
    const pageActions = permissions.navigation_permissions[navigationCode];
    
    if (!pageActions) return false;
    return pageActions.includes(dbActionCode);
  };

  const canUseMcpTool = (toolCode: string) => {
    if (!permissions) return false;
    if (permissions.user.is_super_admin) return true;
    if (permissions.roles.some((r) => r.code === 'SUPER_ADMIN')) return true;
    
    return permissions.mcp_tool_permissions.includes(toolCode);
  };

  const hasRole = (roleCode: string) => {
    if (!permissions) return false;
    return permissions.roles.some((r) => r.code === roleCode);
  };

  const logout = async () => {

    try {
      await apiClient.post('/api/auth/logout', {});
    } catch (e) {
      console.error('Failed to logout on backend', e);
    }
    

    
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('ms_id_token');
    sessionStorage.removeItem('auth_provider');
    clearLinkToken();
    setPermissions(null);
    
    // Always perform SSO logout redirect
    const postLogoutUri = encodeURIComponent(window.location.origin + '/login');
    window.location.href = `https://login.microsoftonline.com/common/oauth2/v2.0/logout?post_logout_redirect_uri=${postLogoutUri}`;
  };

  return (
    <AuthContext.Provider
      value={{
        user: permissions?.user || null,
        roles: permissions?.roles || [],
        isLoading,
        serverUnreachable,
        canAccessNavigationItem,
        hasPermission,
        canUseMcpTool,
        hasRole,
        logout,
        refreshPermissions: fetchPermissions,
        canSwitchView,
        viewMode: canSwitchView ? viewMode : "reviewer",
        setViewMode,
        creatorView,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
