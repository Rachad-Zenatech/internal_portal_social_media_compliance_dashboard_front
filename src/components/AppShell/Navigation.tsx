import {
  LayoutDashboard,
  ShieldCheck,
  FileClock,
  Share2,
  Scale,
  BookOpenText,
  ChartColumn,
  Video,
  FilePlus2,
  CalendarDays,
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
}

export type AppView = "reviewer" | "creator";

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
    icon: FilePlus2,
    section: "MAIN",
    navigationCode: "DASHBOARD",
    views: ["creator"],
  },
  {
    label: "Content screener",
    path: "/compliance/scanner",
    icon: Video,
    section: "MAIN",
    navigationCode: "DASHBOARD",
    views: ["reviewer"],
  },
  {
    label: "Content calendar",
    path: "/content-calendar",
    icon: CalendarDays,
    section: "MAIN",
    navigationCode: "DASHBOARD",
  },
  {
    label: "Compliance rulebook",
    path: "/compliance/rules",
    icon: Scale,
    section: "MAIN",
    navigationCode: "DASHBOARD",
    views: ["reviewer"],
  },
  {
    label: "Messaging context",
    path: "/compliance/context",
    icon: BookOpenText,
    section: "MAIN",
    navigationCode: "DASHBOARD",
    views: ["reviewer"],
  },
  {
    label: "Post performance",
    path: "/performance",
    icon: ChartColumn,
    section: "MAIN",
    navigationCode: "DASHBOARD",
    // Everyone: reviewers and managers see the team's posts, creators their own.
    views: ["reviewer", "creator"],
  },
  {
    label: "Social accounts",
    path: "/socials",
    icon: Share2,
    section: "MAIN",
    navigationCode: "DASHBOARD",
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
