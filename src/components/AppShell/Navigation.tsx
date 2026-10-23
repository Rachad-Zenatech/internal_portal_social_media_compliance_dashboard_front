import {
  LayoutDashboard,
  ShieldCheck,
  FileClock,
  Share2,
  Scale,
  BookOpenText,
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
}

export const navigation: NavigationItem[] = [
  {
    label: "Dashboard",
    path: "/dashboard",
    icon: LayoutDashboard,
    section: "MAIN",
    navigationCode: "DASHBOARD",
  },
  {
    label: "Upload Content",
    path: "/submissions",
    icon: FilePlus2,
    section: "MAIN",
    navigationCode: "DASHBOARD",
  },
  {
    label: "Content Screener",
    path: "/compliance/scanner",
    icon: Video,
    section: "MAIN",
    navigationCode: "DASHBOARD",
  },
  {
    label: "Content Calendar",
    path: "/content-calendar",
    icon: CalendarDays,
    section: "MAIN",
    navigationCode: "DASHBOARD",
  },
  {
    label: "Compliance Rulebook",
    path: "/compliance/rules",
    icon: Scale,
    section: "MAIN",
    navigationCode: "DASHBOARD",
  },
  {
    label: "Messaging Context",
    path: "/compliance/context",
    icon: BookOpenText,
    section: "MAIN",
    navigationCode: "DASHBOARD",
  },
  {
    label: "Social Media",
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
