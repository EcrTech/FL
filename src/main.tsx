// Boot sequence logging - this runs before everything else
console.log('[BOOT] main.tsx starting execution at', new Date().toISOString());

// Update boot status in the HTML loader
if (typeof window !== 'undefined' && (window as any).updateBootStatus) {
  (window as any).updateBootStatus('Loading modules...');
}

import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import "./index.css";
import ErrorBoundary from "./components/ErrorBoundary";
import { setupErrorLogging } from "./lib/errorLogger";
import { AuthProvider } from "./contexts/AuthContext";
import { IdleTimeoutProvider } from "./components/Auth/IdleTimeoutProvider";

console.log('[BOOT] All imports loaded successfully');

// Set up global error logging
setupErrorLogging();
console.log('[BOOT] Error logging initialized');

// Update boot status
if (typeof window !== 'undefined' && (window as any).updateBootStatus) {
  (window as any).updateBootStatus('Configuring React...');
}

// Configure React Query with optimal caching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh
      gcTime: 10 * 60 * 1000, // 10 minutes - cache time (formerly cacheTime)
      refetchOnWindowFocus: false, // Prevent unnecessary refetches
      retry: 1, // Only retry once on failure
    },
  },
});

console.log('[BOOT] QueryClient configured');

// Wrap the entire render in try-catch
try {
  console.log('[BOOT] Looking for root element...');
  const rootElement = document.getElementById("root");
  
  if (!rootElement) {
    throw new Error('CRITICAL: Root element #root not found in DOM!');
  }
  
  console.log('[BOOT] Root element found, creating React root...');
  
  // Update boot status
  if (typeof window !== 'undefined' && (window as any).updateBootStatus) {
    (window as any).updateBootStatus('Mounting React...');
  }
  
  const root = createRoot(rootElement);
  
  console.log('[BOOT] React root created, starting render...');
  
  root.render(
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <AuthProvider>
          <BrowserRouter>
            <IdleTimeoutProvider>
              <App />
            </IdleTimeoutProvider>
          </BrowserRouter>
        </AuthProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  );
  
  console.log('[BOOT] React render initiated - app should be mounting now');
  
  // Remove the initial loader after a short delay to ensure React has mounted
  setTimeout(() => {
    const loader = document.getElementById('initial-loader');
    if (loader) {
      console.log('[BOOT] Removing initial loader');
      loader.remove();
    }
  }, 100);
  
} catch (error) {
  console.error('[BOOT] CRITICAL ERROR during app initialization:', error);
  
  // Show visible error on page
  const rootElement = document.getElementById("root");
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f4f4f5;font-family:system-ui,-apple-system,sans-serif;">
        <div style="text-align:center;padding:40px;max-width:600px;">
          <div style="font-size:64px;margin-bottom:16px;">💥</div>
          <h1 style="color:#ef4444;margin-bottom:8px;font-size:24px;">App Failed to Initialize</h1>
          <p style="color:#71717a;margin-bottom:24px;">A critical error prevented the application from starting.</p>
          <pre style="background:#fef2f2;color:#991b1b;padding:16px;border-radius:8px;font-size:13px;text-align:left;overflow:auto;max-height:300px;margin-bottom:24px;">${error instanceof Error ? error.stack || error.message : String(error)}</pre>
          <button onclick="location.reload()" style="padding:12px 32px;background:#6366f1;color:white;border:none;border-radius:8px;cursor:pointer;font-size:16px;font-weight:500;">
            Reload Application
          </button>
        </div>
      </div>
    `;
  }
}
