import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { lazy, Suspense } from "react";
import { AuthProvider } from "./lib/AuthContext";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { Button } from "./components/ui/button";

import ProtectedRoute from "./components/ProtectedRoute";

const AppShell = lazy(() => import("./components/AppShell/AppShell"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Users = lazy(() => import("./pages/Configurations/Users"));
const Roles = lazy(() => import("./pages/Configurations/Roles"));
const UserRoleAssignment = lazy(() => import("./pages/Configurations/UserRoleAssignment"));
const RoleGroupPermissions = lazy(() => import("./pages/Configurations/RoleGroupPermissions"));
const RoleApiPermissions = lazy(() => import("./pages/Configurations/RoleApiPermissions"));
const RoleMcpToolPermissions = lazy(() => import("./pages/Configurations/RoleMcpToolPermissions"));
const SocialMediaPage = lazy(() => import("./pages/SocialMedia/SocialMediaPage"));
const OAuthIntegrations = lazy(() => import("./pages/Configurations/OAuthIntegrations"));
const OAuthCallbackPage = lazy(() => import("./pages/Configurations/OAuthCallbackPage"));
const ComplianceRulesPage = lazy(() => import("./pages/Compliance/ComplianceRulesPage"));
const VideoComplianceScannerPage = lazy(() => import("./pages/Compliance/VideoComplianceScannerPage"));
const NewSubmissionPage = lazy(() => import("./pages/Submissions/NewSubmissionPage"));
const ContentCalendarPage = lazy(() => import("./pages/ContentCalendar/ContentCalendarPage"));
import { VideoUploadQueueProvider } from "./context/VideoUploadQueueContext";
import { VideoUploadQueueDrawer } from "./components/video/VideoUploadQueueDrawer";

const AuditLog = lazy(() => import("./pages/Log/AuditLog"));
const SystemLogsPage = lazy(() => import("./pages/Logs/SystemLogsPage"));
const Login = lazy(() => import("./pages/Login"));
const PendingAccess = lazy(() => import("./pages/PendingAccess"));

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
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute navigationCode="DASHBOARD">
                    <Dashboard />
                  </ProtectedRoute>
                }
              />

                            {/* Social Media Management */}
              <Route
                path="/socials"
                element={
                  <ProtectedRoute navigationCode="DASHBOARD">
                    <SocialMediaPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/social-media"
                element={
                  <ProtectedRoute navigationCode="DASHBOARD">
                    <SocialMediaPage />
                  </ProtectedRoute>
                }
              />

              {/* New Submission */}
              <Route
                path="/new-submission"
                element={
                  <ProtectedRoute navigationCode="DASHBOARD">
                    <NewSubmissionPage />
                  </ProtectedRoute>
                }
              />

              {/* Content Calendar */}
              <Route
                path="/content-calendar"
                element={
                  <ProtectedRoute navigationCode="DASHBOARD">
                    <ContentCalendarPage />
                  </ProtectedRoute>
                }
              />

              {/* Video Compliance Screener */}
              <Route
                path="/compliance/scanner"
                element={
                  <ProtectedRoute navigationCode="DASHBOARD">
                    <VideoComplianceScannerPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/video-scanner"
                element={
                  <ProtectedRoute navigationCode="DASHBOARD">
                    <VideoComplianceScannerPage />
                  </ProtectedRoute>
                }
              />

              {/* Compliance Governance & Rules */}
              <Route
                path="/compliance/rules"
                element={
                  <ProtectedRoute navigationCode="DASHBOARD">
                    <ComplianceRulesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/compliance"
                element={
                  <ProtectedRoute navigationCode="DASHBOARD">
                    <VideoComplianceScannerPage />
                  </ProtectedRoute>
                }
              />

              {/* Integrations & OAuth */}
              <Route
                path="/configuration/integrations"
                element={
                  <ProtectedRoute navigationCode="CONFIG_ROLES">
                    <OAuthIntegrations />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/configurations/integrations"
                element={
                  <ProtectedRoute navigationCode="CONFIG_ROLES">
                    <OAuthIntegrations />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/configurations/oauth-callback"
                element={
                  <ProtectedRoute>
                    <OAuthCallbackPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/configuration/oauth-callback"
                element={
                  <ProtectedRoute>
                    <OAuthCallbackPage />
                  </ProtectedRoute>
                }
              />

              {/* Configuration Routes */}
              <Route path="/configuration" element={<Navigate to="/configurations/users" replace />} />
              <Route path="/configurations" element={<Navigate to="/configurations/users" replace />} />

              {/* Users */}
              <Route
                path="/configuration/users"
                element={
                  <ProtectedRoute navigationCode="CONFIG_USERS">
                    <Users />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/configurations/users"
                element={
                  <ProtectedRoute navigationCode="CONFIG_USERS">
                    <Users />
                  </ProtectedRoute>
                }
              />

              {/* Roles */}
              <Route
                path="/configuration/roles"
                element={
                  <ProtectedRoute navigationCode="CONFIG_ROLES">
                    <Roles />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/configurations/roles"
                element={
                  <ProtectedRoute navigationCode="CONFIG_ROLES">
                    <Roles />
                  </ProtectedRoute>
                }
              />

              {/* Role Assignments */}
              <Route
                path="/configuration/user-role-assignment"
                element={
                  <ProtectedRoute navigationCode="CONFIG_USER_ROLE_ASSIGNMENT">
                    <UserRoleAssignment />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/configurations/user-role-assignment"
                element={
                  <ProtectedRoute navigationCode="CONFIG_USER_ROLE_ASSIGNMENT">
                    <UserRoleAssignment />
                  </ProtectedRoute>
                }
              />

              {/* Role Group Permissions */}
              <Route
                path="/configuration/role-group-permissions"
                element={
                  <ProtectedRoute navigationCode="CONFIG_ROLES">
                    <RoleGroupPermissions />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/configurations/role-group-permissions"
                element={
                  <ProtectedRoute navigationCode="CONFIG_ROLES">
                    <RoleGroupPermissions />
                  </ProtectedRoute>
                }
              />

              {/* Role API Permissions */}
              <Route
                path="/configuration/role-api-permissions"
                element={
                  <ProtectedRoute navigationCode="CONFIG_ROLE_API_PERMISSIONS">
                    <RoleApiPermissions />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/configurations/role-api-permissions"
                element={
                  <ProtectedRoute navigationCode="CONFIG_ROLE_API_PERMISSIONS">
                    <RoleApiPermissions />
                  </ProtectedRoute>
                }
              />

              {/* Role MCP Tool Permissions */}
              <Route
                path="/configuration/role-mcp-tool-permissions"
                element={
                  <ProtectedRoute navigationCode="CONFIG_ROLE_MCP_TOOL_PERMISSIONS">
                    <RoleMcpToolPermissions />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/configurations/role-mcp-tool-permissions"
                element={
                  <ProtectedRoute navigationCode="CONFIG_ROLE_MCP_TOOL_PERMISSIONS">
                    <RoleMcpToolPermissions />
                  </ProtectedRoute>
                }
              />

              {/* Logs & Audit */}
              <Route path="/log" element={<Navigate to="/log/audit" replace />} />
              <Route
                path="/log/audit"
                element={
                  <ProtectedRoute navigationCode="AUDIT_LOG">
                    <AuditLog />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/log/audit-log"
                element={
                  <ProtectedRoute navigationCode="AUDIT_LOG">
                    <AuditLog />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/log/system-logs"
                element={
                  <ProtectedRoute navigationCode="AUDIT_LOG">
                    <SystemLogsPage />
                  </ProtectedRoute>
                }
              />

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
