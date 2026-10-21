import type { ReactNode } from "react";
import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import Breadcrumbs from "./Breadcrumbs";

interface Props {
  children: ReactNode;
}

// Matches the `laptop` breakpoint in index.css: below it the sidebar is an overlay drawer.
const LAPTOP_QUERY = "(min-width: 992px)";

export default function AppShell({ children }: Props) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(
    () => typeof window === "undefined" || window.matchMedia(LAPTOP_QUERY).matches
  );
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // Only react when crossing the breakpoint, so mobile browser chrome resizes
    // (address bar show/hide) don't close a drawer the user just opened.
    const mql = window.matchMedia(LAPTOP_QUERY);
    const handleChange = (e: MediaQueryListEvent) => setIsSidebarOpen(e.matches);
    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    // New page starts at the top; close the overlay drawer on phones and tablets.
    mainRef.current?.scrollTo(0, 0);
    if (!window.matchMedia(LAPTOP_QUERY).matches) setIsSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex h-dvh w-full min-w-0 overflow-hidden bg-background text-foreground">
      <Sidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
        <TopBar onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
        <main
          ref={mainRef}
          className="flex-1 overflow-y-auto overflow-x-hidden p-2.5 sm:p-3.5 md:p-4 bg-background"
        >
          <Breadcrumbs />
          <div className="w-full min-w-0 pb-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
