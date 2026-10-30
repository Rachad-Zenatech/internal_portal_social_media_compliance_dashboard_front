import { useLocation, Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import { useEffect, useState } from "react";

import { useAuth } from "@/lib/AuthContext";

export interface BreadcrumbItem {
  title: string;
  path?: string;
}

export default function Breadcrumbs() {
  const location = useLocation();
  const pathnames = location.pathname.split("/").filter((x) => x);
  // Reviewers don't have My posts: a post's details lead back to it in the Content screener instead.
  const { hasPermission } = useAuth();
  const reviewerView = hasPermission("CONTENT_REVIEW_APPROVE");
  const [customTitles, setCustomTitles] = useState<Record<string, string>>({});
  const [customTrails, setCustomTrails] = useState<Record<string, BreadcrumbItem[]>>({});

  useEffect(() => {
    const handleSetTitle = (e: Event) => {
      const customEvent = e as CustomEvent<{ path: string; title: string }>;
      setCustomTitles((prev) => ({
        ...prev,
        [customEvent.detail.path]: customEvent.detail.title,
      }));
    };

    const handleSetTrail = (e: Event) => {
      const customEvent = e as CustomEvent<{ path: string; items: BreadcrumbItem[] }>;
      setCustomTrails((prev) => ({
        ...prev,
        [customEvent.detail.path]: customEvent.detail.items,
      }));
    };

    document.addEventListener("set-breadcrumb-title", handleSetTitle);
    document.addEventListener("set-breadcrumb-trail", handleSetTrail);
    return () => {
      document.removeEventListener("set-breadcrumb-title", handleSetTitle);
      document.removeEventListener("set-breadcrumb-trail", handleSetTrail);
    };
  }, []);

  const formatName = (name: string) => {
    const specialNames: Record<string, string> = {
      users: "Users",
      roles: "Roles",
      "user-role-assignment": "User Role Assignments",
      "approval-paths": "Approval Paths",
      "role-group-permissions": "Role Group Permissions",
      "role-api-permissions": "Role API Permissions",
      "role-mcp-tool-permissions": "Role MCP Tool Permissions",
      "audit": "Audit Log",
      "audit-log": "Audit Log",
      "system-logs": "System Logs",
      configuration: "Configuration",
      configurations: "Configurations",
      dashboard: "Dashboard",
      scanner: "Content screener",
      new: "New post",
      submissions: "My posts",
      "content-calendar": "Content calendar",
      performance: "Post performance",
      socials: "Social accounts",
    };
    const key = name.toLowerCase();
    if (specialNames[key]) {
      return specialNames[key];
    }
    return name
      .replace(/-/g, " ")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  if (pathnames.length === 0 || location.pathname === "/dashboard") {
    return null;
  }

  const activeTrail = customTrails[location.pathname];

  const breadcrumbItems = pathnames.map((value, index) => {
    if (reviewerView && index === 0 && value === "submissions") {
      const id = pathnames[1] && pathnames[1] !== "new" ? pathnames[1] : null;
      return { value, title: "Content screener", to: `/compliance/scanner${id ? `?id=${id}` : ""}` };
    }
    return {
      value,
      title: null as string | null,
      to: `/${pathnames.slice(0, index + 1).join("/")}`,
    };
  });

  return (
    <nav className="flex items-center text-xs text-muted-foreground mb-2.5 sm:mb-3.5 overflow-x-auto whitespace-nowrap pt-0.5 pb-1.5 scrollbar-none min-h-[28px]">
      <Link 
        to="/" 
        className="flex items-center hover:text-foreground transition-colors"
        title="Home"
      >
        <Home className="h-4 w-4" />
      </Link>
      
      {activeTrail ? (
        activeTrail.map((item, index) => {
          const isLast = index === activeTrail.length - 1;
          return (
            <div key={item.title + index} className="flex items-center">
              <ChevronRight className="h-4 w-4 mx-1 opacity-50 shrink-0" />
              {isLast || !item.path ? (
                <span className={isLast ? "font-semibold text-foreground" : "text-muted-foreground"} aria-current={isLast ? "page" : undefined}>
                  {item.title}
                </span>
              ) : (
                <Link 
                  to={item.path} 
                  className="hover:text-foreground hover:underline underline-offset-4 transition-colors"
                >
                  {item.title}
                </Link>
              )}
            </div>
          );
        })
      ) : (
        breadcrumbItems.map((item, index) => {
          const isLast = index === breadcrumbItems.length - 1;
          const displayName = item.title || customTitles[item.to] || formatName(item.value);

          return (
            <div key={item.to} className="flex items-center">
              <ChevronRight className="h-4 w-4 mx-1 opacity-50 shrink-0" />
              {isLast ? (
                <span className="font-semibold text-foreground" aria-current="page">
                  {displayName}
                </span>
              ) : (
                <Link
                  to={item.to}
                  className="hover:text-foreground hover:underline underline-offset-4 transition-colors"
                >
                  {displayName}
                </Link>
              )}
            </div>
          );
        })
      )}
    </nav>
  );
}
