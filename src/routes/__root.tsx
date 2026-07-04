import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { CasinoFrame } from "@/components/CasinoFrame";
import { SplashScreen } from "@/components/SplashScreen";
import { UpdateBanner } from "@/components/UpdateBanner";
import { useAppUpdate } from "@/lib/useAppUpdate";
import { TopNav } from "@/components/TopNav";
import { AuthProvider, useAuth } from "@/lib/auth";
import { useRouterState, Navigate } from "@tanstack/react-router";
import { useRealtimeSync } from "@/lib/realtime";
import { useWakeLock } from "@/hooks/useWakeLock";
import { useMusicSync } from "@/lib/useMusicSync";

function NotFoundComponent() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-display font-black gold-text">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Off the felt</h2>
        <p className="mt-2 text-sm text-foreground/70">
          That hand isn't dealt here.
        </p>
        <div className="mt-6">
          <Link to="/" className="chip-button chip-button-hover">Back to lobby</Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Bad shuffle</h1>
        <p className="mt-2 text-sm text-foreground/70">
          Something went wrong. Try the hand again.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="chip-button chip-button-hover"
          >
            Re-deal
          </button>
          <a href="/" className="chip-button chip-button-hover">Lobby</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1" },
      { title: "Stumbling Fours — All Fours Tournaments" },
      { name: "description", content: "Score and run All Fours tournaments in real time, casino style." },
      { property: "og:title", content: "Stumbling Fours — All Fours Tournaments" },
      { property: "og:description", content: "Score and run All Fours tournaments in real time, casino style." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Stumbling Fours — All Fours Tournaments" },
      { name: "twitter:description", content: "Score and run All Fours tournaments in real time, casino style." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/b0b7c623-509e-41e1-a377-ac0cdcce2b92/id-preview-0bba1185--871ce14c-11ad-42e0-9439-01f545c84750.lovable.app-1782741791153.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/b0b7c623-509e-41e1-a377-ac0cdcce2b92/id-preview-0bba1185--871ce14c-11ad-42e0-9439-01f545c84750.lovable.app-1782741791153.png" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function AppWithUpdate() {
  const { update, dismiss } = useAppUpdate();
  return (
    <>
      <CasinoFrame>
        <AuthGate />
      </CasinoFrame>
      {update && <UpdateBanner update={update} onDismiss={dismiss} />}
    </>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const [showSplash, setShowSplash] = useState(() => typeof window !== "undefined");
  const handleSplashDone = () => setShowSplash(false);

  return (
    <QueryClientProvider client={queryClient}>
      {showSplash && <SplashScreen onDone={handleSplashDone} />}
      <div style={{ visibility: showSplash ? "hidden" : "visible" }}>
        <AuthProvider>
          <AppWithUpdate />
        </AuthProvider>
      </div>
    </QueryClientProvider>
  );
}

function AuthGate() {
  const { session, loading } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });
  useRealtimeSync(!!session);
  useWakeLock();
  const { playing, toggleMusic } = useMusicSync(!!session);

  if (loading) {
    return (
      <div className="min-h-[60vh] grid place-items-center text-foreground/60 text-sm tracking-widest uppercase">
        Shuffling the deck…
      </div>
    );
  }

  if (!session && path !== "/auth") {
    return <Navigate to="/auth" replace />;
  }

  if (session && path === "/auth") {
    return <Navigate to="/" replace />;
  }

  return (
    <>
      {session && <TopNav musicPlaying={playing} onToggleMusic={toggleMusic} />}
      <main className="px-5 sm:px-8 pb-10">
        <Outlet />
      </main>
      <footer className="px-5 sm:px-8 pb-6 text-center text-xs text-foreground/50 tracking-widest uppercase">
        Stumbling Fours · Built for the Trini All Fours table
      </footer>
    </>
  );
}
