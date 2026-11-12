import {
  LayoutDashboard,
  ShieldCheck,
  FileClock,
  Images,
  SquarePen,
  ScanSearch,
  BookCheck,
  CalendarDays,
  BookOpenText,
  Forward,
  FileStack,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavigationSubItem {
  label: string;
  path: string;
  navigationCode?: string;
}

export interface NavigationItem {
  label: string;
  path?: string;
  icon: LucideIcon;
  section?: string;
  navigationCode?: string;
  subItems?: NavigationSubItem[];
  /** Which side of the app shows this item: reviewers or content creators (super admins switch between them in
   * the top bar). Unset: shown to both, subject to its permission. */
  views?: AppView[];
  /** Not for a suggesting reviewer: it is about deciding on content (hand-offs of reviews). */
  approversOnly?: boolean;
}

export type AppView = "reviewer" | "creator";

/**
 * What each side sees:
 *   creators   Dashboard, My posts, New submission, Compliance rulebook (view only), Content calendar (their posts)
 *   reviewers  Dashboard, Content screener, Compliance rulebook, Content calendar (everyone's posts)
 * The Administration items below are shown by permission, to whoever has it.
 */
export const navigation: NavigationItem[] = [
  {
    label: "Dashboard",
    path: "/dashboard",
    icon: LayoutDashboard,
    section: "MAIN",
    navigationCode: "DASHBOARD",
  },
  {
    label: "My posts",
    path: "/submissions",
    icon: Images,
    section: "MAIN",
    navigationCode: "DASHBOARD",
    views: ["creator"],
  },
  {
    label: "New submission",
    path: "/submissions/new",
    icon: SquarePen,
    section: "MAIN",
    navigationCode: "DASHBOARD",
    views: ["creator"],
  },
  {
    label: "Content screener",
    path: "/compliance/scanner",
    icon: ScanSearch,
    section: "MAIN",
    navigationCode: "DASHBOARD",
    views: ["reviewer"],
  },
  {
    // Every script, single or in a batch: creators upload and follow them, reviewers review them.
    label: "Script review",
    path: "/script-review",
    icon: FileStack,
    section: "MAIN",
    navigationCode: "DASHBOARD",
    views: ["reviewer", "creator"],
  },
  {
    // Review hand-offs the reviewer made or received, with each post's current status.
    label: "Delegations",
    path: "/delegations",
    icon: Forward,
    section: "MAIN",
    navigationCode: "DASHBOARD",
    views: ["reviewer"],
    approversOnly: true,
  },
  {
    // Reviewers manage it; creators can read it but not change it (see ComplianceRulesPage).
    label: "Compliance rulebook",
    path: "/compliance/rules",
    icon: BookCheck,
    section: "MAIN",
    navigationCode: "DASHBOARD",
    views: ["reviewer", "creator"],
  },
  {
    // Brand voice, facts, platform norms and audience profiles. Only config managers can change it (see MessagingContextPage).
    label: "Messaging context",
    path: "/compliance/context",
    icon: BookOpenText,
    section: "MAIN",
    navigationCode: "DASHBOARD",
    views: ["reviewer", "creator"],
  },
  {
    // Reviewers see everyone's posts, creators only their own (see ContentCalendarPage).
    label: "Content calendar",
    path: "/content-calendar",
    icon: CalendarDays,
    section: "MAIN",
    navigationCode: "DASHBOARD",
    views: ["reviewer", "creator"],
  },
  {
    label: "System & Security",
    icon: ShieldCheck,
    section: "ADMINISTRATION",
    subItems: [
      { label: "Users", path: "/configurations/users", navigationCode: "CONFIG_USERS" },
      { label: "Roles", path: "/configurations/roles", navigationCode: "CONFIG_ROLES" },
      { label: "Role Assignments", path: "/configurations/user-role-assignment", navigationCode: "CONFIG_USER_ROLE_ASSIGNMENT" },
      { label: "Approval Paths", path: "/configurations/approval-paths", navigationCode: "CONFIG_USER_ROLE_ASSIGNMENT" },
      { label: "Role Permissions", path: "/configurations/role-group-permissions", navigationCode: "CONFIG_ROLES" },
      { label: "API Permissions", path: "/configurations/role-api-permissions", navigationCode: "CONFIG_ROLE_API_PERMISSIONS" },
      { label: "MCP Tool Permissions", path: "/configurations/role-mcp-tool-permissions", navigationCode: "CONFIG_ROLE_MCP_TOOL_PERMISSIONS" },
      { label: "Integrations & OAuth", path: "/configurations/integrations", navigationCode: "CONFIG_ROLES" },
    ],
  },
  {
    label: "Logs & Audit",
    icon: FileClock,
    section: "ADMINISTRATION",
    subItems: [
      { label: "Audit Log", path: "/log/audit", navigationCode: "AUDIT_LOG" },
      { label: "System Logs", path: "/log/system-logs", navigationCode: "AUDIT_LOG" },
    ],
  },
];

/** Whether a page belongs to a view. Only the main menu pages are tied to one; anything else (a submission's
 * details, the editor) belongs to both, since either side can be linked there. */
export function pathInView(pathname: string, view: AppView): boolean {
  const item = navigation.find((n) => n.path === pathname.replace(/\/+$/, "") && n.views);
  return !item?.views || item.views.includes(view);
}
