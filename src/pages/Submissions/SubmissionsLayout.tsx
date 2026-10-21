import { NavLink, Outlet } from "react-router-dom";
import { FilePlus2, LayoutGrid } from "lucide-react";

const TABS = [
  { to: "/submissions", label: "Content Portal", icon: LayoutGrid, end: true },
  { to: "/submissions/new", label: "New Submission", icon: FilePlus2, end: false },
];

/** One content area: the portal and the new-submission form share a tab bar instead of being separate sidebar pages. */
export default function SubmissionsLayout() {
  return (
    <div className="w-full max-w-[1440px] mx-auto space-y-4 sm:space-y-5">
      <nav className="flex flex-wrap gap-2" aria-label="Upload Content">
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs sm:text-sm font-semibold shadow-xs backdrop-blur-sm transition-colors ${
                isActive
                  ? "border-primary/25 bg-primary/10 text-primary"
                  : "border-border/80 bg-card/80 text-muted-foreground hover:text-foreground hover:bg-card"
              }`
            }
          >
            <Icon className="w-4 h-4" />
            {label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
