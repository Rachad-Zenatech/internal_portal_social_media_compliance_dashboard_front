import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";
import type { User, Role, AuditLogItem } from "@/types/auth";
import {
  Users,
  ShieldCheck,
  Key,
  Shield,
  FileClock,
  ArrowRight,
  CheckCircle2,
  Lock,
  Layers,
  Sparkles,
  Zap,
  Activity,
  Server,
  Code2,
  Fingerprint,
  Video,
  Scale,
  Share2,
  Upload,
  Radio,
  Play,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useVideoUploadQueue } from "@/context/VideoUploadQueueContext";

export default function Dashboard() {
  const { user, roles, hasRole } = useAuth();
  const isSuperAdmin = hasRole("SUPER_ADMIN") || user?.is_super_admin;

  const { data: users = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ["users"],
    queryFn: () => apiClient.get<User[]>("/api/configuration/users").catch(() => []),
    enabled: !!isSuperAdmin,
  });

  const { data: allRoles = [], isLoading: isLoadingRoles } = useQuery({
    queryKey: ["roles"],
    queryFn: () => apiClient.get<Role[]>("/api/configuration/roles").catch(() => []),
  });

  const { data: recentLogs = [], isLoading: isLoadingLogs } = useQuery({
    queryKey: ["auditLogs"],
    queryFn: () => apiClient.get<AuditLogItem[]>("/api/audit-logs").catch(() => []),
  });

  const activeUsers = useMemo(() => users.filter((u) => u.is_active !== false).length, [users]);
  const activeRoles = useMemo(() => allRoles.filter((r) => r.is_active !== false).length, [allRoles]);
  const { queue, activeUploadCount, openQueueDrawer, setActiveVideoId } = useVideoUploadQueue();

  const quickNavCards = [
    {
      title: "User Management",
      description: "Manage system accounts, user status, super admin rights, and identity details.",
      icon: Users,
      path: "/configurations/users",
      color: "from-blue-500/10 to-indigo-500/10 text-blue-600 dark:text-blue-400 border-blue-200/50 dark:border-blue-900/40",
      badge: isSuperAdmin ? `${users.length} Users` : undefined,
    },
    {
      title: "Role Hierarchy & Definitions",
      description: "Define enterprise roles, assign department tags, and build inheritance structures.",
      icon: ShieldCheck,
      path: "/configurations/roles",
      color: "from-emerald-500/10 to-teal-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-900/40",
      badge: `${allRoles.length} Roles`,
    },
    {
      title: "User-Role Assignment",
      description: "Assign active roles to users and grant workflow authorization matrices.",
      icon: Key,
      path: "/configurations/user-role-assignment",
      color: "from-purple-500/10 to-violet-500/10 text-purple-600 dark:text-purple-400 border-purple-200/50 dark:border-purple-900/40",
    },
    {
      title: "Navigation & Module Permissions",
      description: "Fine-tune UI screen visibility and module actions per security role.",
      icon: Layers,
      path: "/configurations/role-group-permissions",
      color: "from-amber-500/10 to-orange-500/10 text-amber-600 dark:text-amber-400 border-amber-200/50 dark:border-amber-900/40",
    },
    {
      title: "API Endpoint Permissions",
      description: "Enforce granular HTTP method and path pattern security policies.",
      icon: Lock,
      path: "/configurations/role-api-permissions",
      color: "from-rose-500/10 to-red-500/10 text-rose-600 dark:text-rose-400 border-rose-200/50 dark:border-rose-900/40",
    },
    {
      title: "Security & Audit Logs",
      description: "Inspect immutable audit trails, actor activities, and state transitions.",
      icon: FileClock,
      path: "/log/audit",
      color: "from-cyan-500/10 to-sky-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-200/50 dark:border-cyan-900/40",
      badge: `${recentLogs.length} Events`,
    },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-3 duration-500">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/90 via-primary to-indigo-950 text-primary-foreground p-6 sm:p-8 md:p-10 shadow-xl border border-primary/20">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 rounded-full bg-white/5 blur-2xl pointer-events-none" />
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold tracking-wide text-white/90 border border-white/15">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Social Media Compliance • RBAC Enabled</span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight leading-tight">
            Welcome back, {user?.full_name || "Administrator"}
          </h1>
          <p className="text-sm sm:text-base text-primary-foreground/80 leading-relaxed max-w-2xl">
            Social Media Compliance portal with role-based access control (RBAC),
            fine-grained permissions, real-time event streaming, and audit trails.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-3">
            <Link
              to="/submissions/new"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-zinc-950 font-bold text-xs shadow-md hover:bg-white/90 transition-all hover:scale-102"
            >
              <Video className="w-4 h-4 text-primary" />
              Upload New Content
            </Link>
            <Link
              to="/compliance/rules"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white/15 hover:bg-white/25 text-white font-medium text-xs backdrop-blur-md border border-white/20 transition-all"
            >
              <Scale className="w-3.5 h-3.5" />
              Compliance Rulebook
            </Link>
            <Link
              to="/socials"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium text-xs backdrop-blur-md border border-white/10 transition-all"
            >
              <Share2 className="w-3.5 h-3.5" />
              Social Channels
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Badge variant="secondary" className="bg-white/20 hover:bg-white/30 text-white text-xs px-3 py-1 border-transparent">
              <Fingerprint className="w-3.5 h-3.5 mr-1.5" />
              {user?.is_super_admin ? "Super Admin" : roles.length > 0 ? roles.map((r) => r.name).join(", ") : "Standard User"}
            </Badge>
            <Badge variant="secondary" className="bg-white/10 text-white/90 text-xs px-3 py-1 border-white/10">
              <Server className="w-3.5 h-3.5 mr-1.5 text-emerald-300" />
              System Status: Active
            </Badge>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-6">
        <Card className="border-border/60 shadow-xs hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Users
            </CardTitle>
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              <Users className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {isLoadingUsers ? "..." : users.length || 1}
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>{activeUsers || 1} active accounts</span>
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Security Roles
            </CardTitle>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <Shield className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {isLoadingRoles ? "..." : allRoles.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>{activeRoles} active policies</span>
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Access Control
            </CardTitle>
            <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
              <Key className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">RBAC 2.0</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <span>Navigation + API + MCP</span>
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Audit Stream
            </CardTitle>
            <div className="p-2 rounded-lg bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400">
              <Activity className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {isLoadingLogs ? "..." : recentLogs.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <span>Logged audit actions</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Marketing & Pre-Publication Compliance Hub */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              Marketing & Pre-Publication Screening
            </h2>
            <p className="text-xs text-muted-foreground">
              Screen promotional videos, voiceover transcripts, and social campaigns against defense compliance rules.
            </p>
          </div>
        </div>

        {/* Active Video Upload Queue Preview on Dashboard */}
        <Card className="border-border/80 shadow-xs bg-muted/20 overflow-hidden">
          <CardHeader className="p-4 bg-muted/30 border-b border-border/60">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <Upload className="w-4 h-4 animate-bounce" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold flex flex-wrap items-center gap-2">
                    <span>Live Video Upload & Review Queue</span>
                    <Badge variant="outline" className="text-[10px] font-mono border-blue-500/30 text-blue-600 dark:text-blue-400">
                      {activeUploadCount} Transferring • {queue.length} in Queue
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Track progressive uploads and start reviewing compliance violations on buffered chunks immediately.
                  </CardDescription>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={openQueueDrawer}
                  className="text-xs h-7 gap-1 font-semibold"
                >
                  <Upload className="w-3 h-3 text-primary" />
                  View Queue ({queue.length})
                </Button>
                <Link
                  to="/compliance/scanner"
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-primary text-primary-foreground font-semibold text-xs shadow-2xs hover:bg-primary/90"
                >
                  <Play className="w-3 h-3 fill-current" />
                  Open Screener
                </Link>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {queue.slice(0, 3).map((item, idx) => {
                const isUploading = item.status === "UPLOADING" || item.status === "PROCESSING";
                return (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl border border-border/70 bg-card flex flex-col justify-between space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-xs text-foreground line-clamp-1">{item.title}</h4>
                        <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                          {item.platform} • {item.filename}
                        </p>
                      </div>
                      {isUploading ? (
                        <Badge className="bg-blue-600 text-white text-[9px] font-bold shrink-0 animate-pulse">
                          {item.progressPercent}%
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[9px] font-mono shrink-0">
                          {item.status}
                        </Badge>
                      )}
                    </div>

                    {isUploading && (
                      <div className="space-y-1">
                        <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-300 rounded-full"
                            style={{ width: `${item.progressPercent}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <span className="truncate max-w-[140px]">{item.currentStageLabel}</span>
                          <span className="font-mono">{item.progressPercent}% buffered</span>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1 border-t border-border/50 text-[11px]">
                      {isUploading ? (
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                          <Radio className="w-3 h-3 text-amber-500 animate-pulse" />
                          Review chunks so far
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">
                          {item.status !== "COMPLETED"
                            ? `Waiting in slot #${idx + 1}`
                            : item.scoreStatus === "checked"
                            ? `Score: ${item.complianceScore}/100`
                            : item.scoreStatus === "pending"
                            ? "Checking..."
                            : "Score unavailable"}
                        </span>
                      )}

                      <Link
                        to="/compliance/scanner"
                        onClick={() => setActiveVideoId(item.id)}
                        className="text-[10px] font-bold text-primary hover:underline"
                      >
                        {isUploading ? "Review Now →" : "Inspect →"}
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link to="/compliance/scanner" className="group block outline-none">
            <Card className="h-full border-primary/30 hover:border-primary bg-gradient-to-br from-primary/5 via-card to-card hover:bg-muted/30 transition-all duration-200 shadow-xs hover:shadow-md">
              <CardHeader className="p-5 pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="p-2.5 rounded-xl border bg-gradient-to-br from-amber-500/10 to-orange-500/10 text-amber-600 dark:text-amber-400 border-amber-200/50 dark:border-amber-900/40">
                    <Video className="h-5 w-5" />
                  </div>
                  <Badge className="bg-amber-500 text-white text-[10px] font-bold">
                    Interactive
                  </Badge>
                </div>
                <CardTitle className="text-base font-bold text-foreground group-hover:text-primary transition-colors mt-3">
                  Content Screener
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground leading-relaxed">
                  Review submitted videos and posts, inspect synchronized voiceovers, and see flagged claims directly on the timeline.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 pt-0 flex justify-end">
                <span className="text-xs font-semibold text-primary flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                  Open Content Screener <ArrowRight className="h-3 w-3" />
                </span>
              </CardContent>
            </Card>
          </Link>

          <Link to="/compliance/rules" className="group block outline-none">
            <Card className="h-full border-border/60 hover:border-primary/40 bg-card hover:bg-muted/30 transition-all duration-200 shadow-2xs hover:shadow-md">
              <CardHeader className="p-5 pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="p-2.5 rounded-xl border bg-gradient-to-br from-blue-500/10 to-indigo-500/10 text-blue-600 dark:text-blue-400 border-blue-200/50 dark:border-blue-900/40">
                    <Scale className="h-5 w-5" />
                  </div>
                  <Badge variant="outline" className="text-[10px] font-semibold">
                    Rulebook
                  </Badge>
                </div>
                <CardTitle className="text-base font-bold text-foreground group-hover:text-primary transition-colors mt-3">
                  Defense Governance Rules
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground leading-relaxed">
                  Manage active defense thought leadership rules, prohibited claims, disclaimers, and traffic light criteria.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 pt-0 flex justify-end">
                <span className="text-xs font-semibold text-primary flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                  Manage Rulebook <ArrowRight className="h-3 w-3" />
                </span>
              </CardContent>
            </Card>
          </Link>

          <Link to="/socials" className="group block outline-none">
            <Card className="h-full border-border/60 hover:border-primary/40 bg-card hover:bg-muted/30 transition-all duration-200 shadow-2xs hover:shadow-md">
              <CardHeader className="p-5 pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="p-2.5 rounded-xl border bg-gradient-to-br from-emerald-500/10 to-teal-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-900/40">
                    <Share2 className="h-5 w-5" />
                  </div>
                  <Badge variant="outline" className="text-[10px] font-semibold">
                    Channels
                  </Badge>
                </div>
                <CardTitle className="text-base font-bold text-foreground group-hover:text-primary transition-colors mt-3">
                  Social Media Distribution
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground leading-relaxed">
                  Monitor LinkedIn, X/Twitter, Instagram, YouTube, and Facebook engagement across all subsidiary brands.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 pt-0 flex justify-end">
                <span className="text-xs font-semibold text-primary flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                  View Channels <ArrowRight className="h-3 w-3" />
                </span>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      {/* Quick Navigation Hub */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground tracking-tight">Security & RBAC Modules</h2>
            <p className="text-xs text-muted-foreground">Manage roles, permissions, user assignments, and security audit trails.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickNavCards.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.path} to={item.path} className="group block outline-none">
                <Card className="h-full border-border/60 hover:border-primary/40 bg-card hover:bg-muted/30 transition-all duration-200 shadow-2xs hover:shadow-md">
                  <CardHeader className="p-5 pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className={`p-2.5 rounded-xl border bg-gradient-to-br ${item.color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      {item.badge && (
                        <Badge variant="outline" className="text-[10px] font-semibold">
                          {item.badge}
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-base font-bold text-foreground group-hover:text-primary transition-colors mt-3">
                      {item.title}
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground leading-relaxed">
                      {item.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-5 pt-0 flex justify-end">
                    <span className="text-xs font-semibold text-primary flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                      Open Module <ArrowRight className="h-3 w-3" />
                    </span>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Starter Template Guide */}
      <Card className="border-border/60 bg-muted/20">
        <CardHeader>
          <div className="flex items-center gap-2 text-primary mb-1">
            <Code2 className="h-5 w-5" />
            <CardTitle className="text-lg font-bold">Template Architecture & Cloning Guide</CardTitle>
          </div>
          <CardDescription className="text-xs leading-relaxed">
            Key patterns and conventions for developing applications on top of this template.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-xs text-muted-foreground leading-relaxed">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border bg-card space-y-2">
              <h4 className="font-bold text-foreground text-sm flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                API Client & Auth
              </h4>
              <p>
                All HTTP requests route through <code className="text-primary font-mono text-[11px]">src/services/apiClient.ts</code> with automatic token injection and reactive error handling.
              </p>
            </div>
            <div className="p-4 rounded-xl border bg-card space-y-2">
              <h4 className="font-bold text-foreground text-sm flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                Role-Based Guarding
              </h4>
              <p>
                Pages and actions are gated by <code className="text-primary font-mono text-[11px]">&lt;ProtectedRoute&gt;</code> and <code className="text-primary font-mono text-[11px]">hasPermission()</code>.
              </p>
            </div>
            <div className="p-4 rounded-xl border bg-card space-y-2">
              <h4 className="font-bold text-foreground text-sm flex items-center gap-2">
                <Layers className="h-4 w-4 text-blue-500" />
                Domain Organization
              </h4>
              <p>
                Organize new pages under <code className="text-primary font-mono text-[11px]">src/pages/&lt;Feature&gt;</code> and declare shared interfaces in <code className="text-primary font-mono text-[11px]">src/types/</code>.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}