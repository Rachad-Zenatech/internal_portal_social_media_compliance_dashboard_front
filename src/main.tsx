import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import GlobalLoadingScreen from "@/components/common/GlobalLoadingScreen";

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from "@/components/ui/sonner"
import { ThemeProvider } from "next-themes"
import { TooltipProvider } from "@/components/ui/tooltip"
import ErrorBoundary from "@/components/common/ErrorBoundary"
import { installGlobalErrorReporting } from "@/services/errorReporting"

installGlobalErrorReporting();

// After a new deploy removes old hashed chunks from S3, reload once so an open tab picks up the new manifest.
window.addEventListener('vite:preloadError', () => {
  const key = 'chunk-reload-at';
  const last = Number(sessionStorage.getItem(key) || '0');
  if (Date.now() - last > 10_000) {
    sessionStorage.setItem(key, String(Date.now()));
    window.location.reload();
  }
});

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // In development, always refetch so backend/code changes show immediately; in production keep fresh for 5 minutes.
      staleTime: import.meta.env.DEV ? 0 : 1000 * 60 * 5,
      retry: (failureCount, error: unknown) => {
        const status =
          typeof error === "object" && error !== null && "status" in error
            ? (error as { status?: unknown }).status
            : undefined;
        if (status === 401 || status === 403) {
          return false;
        }
        return failureCount < 3;
      },
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <App />
            <GlobalLoadingScreen />
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
)
