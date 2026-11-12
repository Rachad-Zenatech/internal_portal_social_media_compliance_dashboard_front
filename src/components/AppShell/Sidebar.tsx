import { ChevronDown, PanelRight } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { navigation, type AppView, type NavigationItem } from "./Navigation";
import { useState } from "react";
import zenatechLogo from "@/assets/zenatech_logo_trimmed.png";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/lib/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";
import type { User } from "@/types/auth";

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

/** The page an item stands for, as the address bar shows it. "My posts" stays lit on a post's own pages, but not on "New submission". */
function isItemActive(item: NavigationItem, pathname: string, search = ""): boolean {
  if (!item.path) return false;
  // A saved post opens in the editor (/submissions/new?id=...): that is still "My posts", not a new submission.
  const editingPost = pathname === "/submissions/new" && new URLSearchParams(search).has("id");
  if (item.path === "/submissions/new" && editingPost) return false;
  if (item.path === "/submissions") {
    if (editingPost) return true;
    return pathname === "/submissions" || (pathname.startsWith("/submissions/") && pathname !== "/submissions/new");
  }
  return pathname === item.path || (item.path !== "/" && pathname.startsWith(item.path + "/"));
}

export default function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({
    "System & Security": true,
    "Logs & Audit": true,
  });
  const location = useLocation();
  const navigate = useNavigate();

  const { hasPermission, hasRole, user, isSuggester } = useAuth();
  const isSuperAdmin = hasRole("SUPER_ADMIN") || user?.is_super_admin;

  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: () => apiClient.get<User[]>("/api/configuration/users"),
    enabled: !!isSuperAdmin,
  });

  const pendingUsersCount =
    users?.filter(
      (u) =>
        !u.is_super_admin &&
        (!u.assigned_roles ||
          u.assigned_roles.length === 0 ||
          u.assigned_roles.every((role) => role.code === "PENDING_USER"))
    ).length || 0;

  const toggleExpand = (label: string) => {
    setExpandedItems((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  // Reviewers and content creators each get their side of the app (super admins switch in the top bar).
  const view: AppView = hasPermission("CONTENT_REVIEW_VIEW") ? "reviewer" : "creator";

  const groupedNavigation = navigation.reduce<Record<string, NavigationItem[]>>((acc, item) => {
    if (item.views && !item.views.includes(view)) return acc;
    if (item.approversOnly && isSuggester) return acc;
    // Pure Role Permission Gating: Check item navigation permission
    if (item.navigationCode) {
      const hasItemAccess =
        isSuperAdmin ||
        hasPermission(`${item.navigationCode}_READ`) ||
        hasPermission(`${item.navigationCode}_VIEW`);
      if (!hasItemAccess) return acc;
    }

    const filteredSubItems = item.subItems
      ? item.subItems.filter((sub) => {
          if (sub.navigationCode) {
            const hasSubAccess =
              isSuperAdmin ||
              hasPermission(`${sub.navigationCode}_READ`) ||
              hasPermission(`${sub.navigationCode}_VIEW`);
            if (!hasSubAccess) return false;
          }
          return true;
        })
      : undefined;

    // If it had subItems but now they are all filtered out, don't show the parent
    if (item.subItems && (!filteredSubItems || filteredSubItems.length === 0)) {
      return acc;
    }

    const section = item.section || "GENERAL";
    if (!acc[section]) acc[section] = [];

    acc[section].push({ ...item, subItems: filteredSubItems });
    return acc;
  }, {});

  return (
    <>
      {/* Mobile & Tablet backdrop overlay */}
      {isOpen && (
        <div
          onClick={onToggle}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs laptop:hidden animate-in fade-in"
        />
      )}

      <aside
        className={`
          fixed laptop:static top-0 bottom-0 left-0 z-50 h-full flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out shadow-lg laptop:shadow-none
          ${isOpen ? "w-56 tablet:w-60 desktop:w-64 translate-x-0" : "-translate-x-full laptop:translate-x-0 laptop:w-[68px]"}
        `}
      >
        <div
          className={`flex items-center h-[88px] px-4 pt-3 pb-2 transition-all duration-300 ease-in-out ${
            isOpen ? "justify-between" : "laptop:justify-center"
          }`}
        >
          <Link
            to="/"
            className={`flex items-center flex-1 min-w-0 transition-all duration-300 ease-in-out ${
              isOpen ? "opacity-100" : "opacity-0 w-0 h-0 overflow-hidden"
            }`}
          >
            <img
              src={zenatechLogo}
              alt="ZenaTech"
              className={`object-contain ${isOpen ? "h-8 desktop:h-9 w-auto max-w-full" : "w-0 h-0"}`}
            />
          </Link>

          <button
            onClick={onToggle}
            className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg cursor-pointer text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            title="Toggle Sidebar"
          >
            <PanelRight size={20} />
          </button>
        </div>

        <TooltipProvider delayDuration={0}>
          <nav key={view} className="space-y-4 px-3 mt-0 pb-4 overflow-y-auto scrollbar-hide flex-1 min-h-0">
            {Object.entries(groupedNavigation).map(([section, items]) => (
              <div key={section} className="space-y-1">
                {isOpen ? (
                  <div className="px-3 mb-1.5 text-[10px] font-bold tracking-[0.14em] text-muted-foreground/80 uppercase">{section}</div>
                ) : (
                  <div className="mx-3 my-2 h-px bg-sidebar-border" />
                )}

                {items.map((item) => {
                  const Icon = item.icon;

                  if (item.subItems) {
                    const isExpanded = expandedItems[item.label];
                    return (
                      <div key={item.label} className="flex flex-col">
                        <Tooltip delayDuration={0}>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => {
                                if (!isOpen) onToggle();
                                toggleExpand(item.label);
                                if (item.path) {
                                  navigate(item.path);
                                }
                              }}
                              className={`
                                flex items-center justify-between h-10 rounded-lg text-[13px] font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent
                                ${isOpen ? "px-3" : "px-0 justify-center"}
                              `}
                            >
                              <div className="flex items-center">
                                <Icon size={18} strokeWidth={2} className="flex-shrink-0 text-muted-foreground" />
                                {isOpen && <span className="ml-3">{item.label}</span>}
                              </div>
                              {isOpen && (
                                <ChevronDown size={16} className={`flex-shrink-0 text-muted-foreground transition-transform duration-200 ${isExpanded ? "" : "-rotate-90"}`} />
                              )}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="right" sideOffset={10} className={`font-semibold z-50 ${isOpen ? "hidden" : ""}`}>
                            {item.label}
                          </TooltipContent>
                        </Tooltip>

                        <div
                          className={`ml-[21px] pl-3 border-l border-sidebar-border space-y-0.5 overflow-hidden transition-all duration-300 ease-in-out ${
                            isOpen && isExpanded ? "max-h-[1000px] mt-1 opacity-100" : "max-h-0 opacity-0"
                          }`}
                        >
                          {item.subItems.map((sub) => {
                            const isSubActive = location.pathname === sub.path;
                            return (
                              <Link
                                key={sub.path}
                                to={sub.path}
                                className={`
                                  flex items-center justify-between h-8 px-3 rounded-lg text-xs transition-colors
                                  ${
                                    isSubActive
                                      ? "bg-blue-50 font-semibold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
                                      : "font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                                  }
                                `}
                              >
                                <span className="truncate">{sub.label}</span>
                                {sub.label === "Role Assignments" && isSuperAdmin && pendingUsersCount > 0 && (
                                  <div className="flex-shrink-0 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full ml-1.5">
                                    {pendingUsersCount}
                                  </div>
                                )}
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }

                  const isMainActive = isItemActive(item, location.pathname, location.search);

                  return (
                    <Tooltip key={item.path} delayDuration={0}>
                      <TooltipTrigger asChild>
                        <Link
                          to={item.path!}
                          aria-current={isMainActive ? "page" : undefined}
                          className={`
                            relative flex items-center h-10 rounded-lg text-[13px] transition-colors
                            ${isOpen ? "px-3 justify-start" : "px-0 justify-center"}
                            ${
                              isMainActive
                                ? "bg-blue-50 font-semibold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
                                : "font-medium text-sidebar-foreground hover:bg-sidebar-accent"
                            }
                          `}
                        >
                          {/* A slim bar on the page you're on */}
                          {isMainActive && <span aria-hidden className="absolute -left-3 top-2 bottom-2 w-1 rounded-r-full bg-blue-600 dark:bg-blue-400" />}
                          <Icon size={18} strokeWidth={2} className={`flex-shrink-0 ${isMainActive ? "" : "text-muted-foreground"}`} />
                          {isOpen && <span className="ml-3 truncate">{item.label}</span>}
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="right" sideOffset={10} className={`font-semibold z-50 ${isOpen ? "hidden" : ""}`}>
                        {item.label}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            ))}
          </nav>
        </TooltipProvider>
      </aside>
    </>
  );
}
