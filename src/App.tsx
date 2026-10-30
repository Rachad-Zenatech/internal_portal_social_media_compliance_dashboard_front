import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import { lazy, Suspense, type ReactNode } from "react";
import { AuthProvider, useAuth } from "./lib/AuthContext";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { Button } from "./components/ui/button";
import ProtectedRoute from "./components/ProtectedRoute";
import { VideoUploadQueueProvider } from "./context/VideoUploadQueueContext";
import { VideoUploadQueueDrawer } from "./components/video/VideoUploadQueueDrawer";

const AppShell = lazy(() => import("./components/AppShell/AppShell"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Users = lazy(() => import("./pages/Configurations/Users"));
const Roles = lazy(() => import("./pages/Configurations/Roles"));
const UserRoleAssignment = lazy(() => import("./pages/Configurations/UserRoleAssignment"));
const ApprovalPaths = lazy(() => import("./pages/Configurations/ApprovalPaths"));
const RoleGroupPermissions = lazy(() => import("./pages/Configurations/RoleGroupPermissions"));
const RoleApiPermissions = lazy(() => import("./pages/Configurations/RoleApiPermissions"));
const RoleMcpToolPermissions = lazy(() => import("./pages/Configurations/RoleMcpToolPermissions"));
const SocialMediaPage = lazy(() => import("./pages/SocialMedia/SocialMediaPage"));
const OAuthIntegrations = lazy(() => import("./pages/Configurations/OAuthIntegrations"));
const OAuthCallbackPage = lazy(() => import("./pages/Configurations/OAuthCallbackPage"));
const ComplianceRulesPage = lazy(() => import("./pages/Compliance/ComplianceRulesPage"));
const MessagingContextPage = lazy(() => import("./pages/Compliance/MessagingContextPage"));
const PostPerformancePage = lazy(() => import("./pages/Performance/PostPerformancePage"));
const ContentScreenerPage = lazy(() => import("./pages/Compliance/ContentScreenerPage"));
// The previous screener, kept reachable while the new one beds in.
const VideoComplianceScannerPage = lazy(() => import("./pages/Compliance/VideoComplianceScannerPage"));
const NewSubmissionPage = lazy(() => import("./pages/Submissions/NewSubmissionPage"));
const SubmissionsListPage = lazy(() => import("./pages/Submissions/SubmissionsListPage"));
const SubmissionDetailPage = lazy(() => import("./pages/Submissions/SubmissionDetailPage"));
const SubmissionsLayout = lazy(() => import("./pages/Submissions/SubmissionsLayout"));
const ContentCalendarPage = lazy(() => import("./pages/ContentCalendar/ContentCalendarPage"));
const PublishDraftPage = lazy(() => import("./pages/ContentCalendar/PublishDraftPage"));
const AuditLog = lazy(() => import("./pages/Log/AuditLog"));
const SystemLogsPage = lazy(() => import("./pages/Logs/SystemLogsPage"));
const Login = lazy(() => import("./pages/Login"));
const PendingAccess = lazy(() => import("./pages/PendingAccess"));

/** Pages inside the app shell. `navigationCode` is the permission needed to open the page (none = any signed-in user). */
const PAGES: { path: string; navigationCode?: string; element: ReactNode }[] = [
  { path: "/dashboard", navigationCode: "DASHBOARD", element: <Dashboard /> },
  { path: "/socials", navigationCode: "DASHBOARD", element: <SocialMediaPage /> },
  { path: "/submissions/:id", navigationCode: "DASHBOARD", element: <SubmissionDetailPage /> },
  { path: "/content-calendar", navigationCode: "DASHBOARD", element: <ContentCalendarPage /> },
  { path: "/content-calendar/publish/:itemId/:platform", navigationCode: "DASHBOARD", element: <PublishDraftPage /> },
  { path: "/compliance/scanner", navigationCode: "DASHBOARD", element: <ContentScreenerPage /> },
  { path: "/compliance/scanner/classic", navigationCode: "DASHBOARD", element: <VideoComplianceScannerPage /> },
  { path: "/compliance/rules", navigationCode: "DASHBOARD", element: <ComplianceRulesPage /> },
  { path: "/compliance/context", navigationCode: "DASHBOARD", element: <MessagingContextPage /> },
  { path: "/performance", navigationCode: "DASHBOARD", element: <PostPerformancePage /> },
  { path: "/configurations/integrations", navigationCode: "CONFIG_ROLES", element: <OAuthIntegrations /> },
  { path: "/configurations/oauth-callback", element: <OAuthCallbackPage /> },
  { path: "/configurations/users", navigationCode: "CONFIG_USERS", element: <Users /> },
  { path: "/configurations/roles", navigationCode: "CONFIG_ROLES", element: <Roles /> },
  { path: "/configurations/user-role-assignment", navigationCode: "CONFIG_USER_ROLE_ASSIGNMENT", element: <UserRoleAssignment /> },
  { path: "/configurations/approval-paths", navigationCode: "CONFIG_USER_ROLE_ASSIGNMENT", element: <ApprovalPaths /> },
  { path: "/configurations/role-group-permissions", navigationCode: "CONFIG_ROLES", element: <RoleGroupPermissions /> },
  { path: "/configurations/role-api-permissions", navigationCode: "CONFIG_ROLE_API_PERMISSIONS", element: <RoleApiPermissions /> },
  { path: "/configurations/role-mcp-tool-permissions", navigationCode: "CONFIG_ROLE_MCP_TOOL_PERMISSIONS", element: <RoleMcpToolPermissions /> },
  { path: "/log/audit", navigationCode: "AUDIT_LOG", element: <AuditLog /> },
  { path: "/log/system-logs", navigationCode: "AUDIT_LOG", element: <SystemLogsPage /> },
];

/**
 * Old or alternate URLs, kept working because they appear in bookmarks, notifications and the
 * backend's stored navigation paths (which use /configuration/...). The rest of the path and the
 * query string are carried over, so e.g. OAuth callback parameters survive.
 */
const REDIRECTS: { from: string; to: string }[] = [
  { from: "/configuration", to: "/configurations" },
  { from: "/new-submission", to: "/submissions/new" },
  { from: "/social-media", to: "/socials" },
  { from: "/video-scanner", to: "/compliance/scanner" },
  { from: "/log/audit-log", to: "/log/audit" },
];

function PrefixRedirect({ from, to }: { from: string; to: string }) {
  const { pathname, search } = useLocation();
  return <Navigate to={`${to}${pathname.slice(from.length)}${search}`} replace />;
}

/** My posts is the creators' page; reviewers work from the Content screener, so they're sent there. */
function PostsListRoute() {
  const { hasPermission } = useAuth();
  return hasPermission("CONTENT_REVIEW_APPROVE") ? <Navigate to="/compliance/scanner" replace /> : <SubmissionsListPage />;
}

function NotFoundAlert() {
  return (
    <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center bg-card rounded-xl border border-border shadow-xs my-6 max-w-lg mx-auto">
      <div className="w-14 h-14 bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mb-4">
        <ShieldAlert className="w-7 h-7" />
      </div>
      <h2 className="text-xl font-bold text-foreground mb-1.5">Page Not Found or Access Restricted</h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-md">
        The page you requested does not exist or you do not have permission to view it.
      </p>
      <Button onClick={() => (window.location.href = "/dashboard")} variant="outline" className="gap-2 text-xs">
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Dashboard</span>
      </Button>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <VideoUploadQueueProvider>
        <BrowserRouter>
          <VideoUploadQueueDrawer />
          <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading...</div>}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/pending-access" element={<PendingAccess />} />

              {/* Main app layout routes */}
              <Route
                element={
                  <ProtectedRoute>
                    <AppShell>
                      <Outlet />
                    </AppShell>
                  </ProtectedRoute>
                }
              >
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/configurations" element={<Navigate to="/configurations/users" replace />} />
                <Route path="/compliance" element={<Navigate to="/compliance/scanner" replace />} />
                <Route path="/log" element={<Navigate to="/log/audit" replace />} />

                {/* Submissions: the list and the new-submission form share one tabbed area */}
                <Route
                  element={
                    <ProtectedRoute navigationCode="DASHBOARD">
                      <SubmissionsLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route path="/submissions" element={<PostsListRoute />} />
                  <Route path="/submissions/new" element={<NewSubmissionPage />} />
                </Route>

                {PAGES.map(({ path, navigationCode, element }) => (
                  <Route key={path} path={path} element={<ProtectedRoute navigationCode={navigationCode}>{element}</ProtectedRoute>} />
                ))}

                {REDIRECTS.map(({ from, to }) => (
                  <Route key={from} path={`${from}/*`} element={<PrefixRedirect from={from} to={to} />} />
                ))}

                {/* Catch-All / 404 Route */}
                <Route path="*" element={<NotFoundAlert />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </VideoUploadQueueProvider>
    </AuthProvider>
  );
}

export default App;
