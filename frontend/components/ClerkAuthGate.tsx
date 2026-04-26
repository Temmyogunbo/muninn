import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/router";
import { useEffect, useMemo, type ReactNode } from "react";

/**
 * Routes accessible without signing in. (Static export has no server middleware, so this runs client-side.)
 * Sign-in / sign-up must stay public so users can reach Clerk after landing on the home page.
 */
function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  if (pathname.startsWith("/sign-in")) return true;
  if (pathname.startsWith("/sign-up")) return true;
  return false;
}

export function ClerkAuthGate({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const onPublicPath = useMemo(() => isPublicPath(router.pathname), [router.pathname]);

  useEffect(() => {
    if (!isLoaded || !router.isReady) return;
    if (isSignedIn) return;
    if (onPublicPath) return;
    void router.replace("/");
  }, [isLoaded, isSignedIn, onPublicPath, router]);

  if (!isLoaded || !router.isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-400">
        Loading…
      </div>
    );
  }

  if (!isSignedIn && !onPublicPath) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-400">
        Loading…
      </div>
    );
  }

  return <>{children}</>;
}
