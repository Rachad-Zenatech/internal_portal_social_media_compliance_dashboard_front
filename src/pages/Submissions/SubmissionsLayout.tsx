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
      <nav className="inline-flex rounded-lg border border-border bg-muted/40 p-1 gap-1" aria-label="Upload Content">
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                isActive ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              }`
            }
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
