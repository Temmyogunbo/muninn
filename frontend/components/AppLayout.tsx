import {
  SignInButton,
  SignOutButton,
  SignUpButton,
  useAuth,
  UserButton,
  useUser,
} from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, type ReactNode } from "react";
import { useMuninnUserProfile } from "@/hooks/useMuninnUserProfile";

const navLoading = [
  { href: "/", label: "Home" },
  { href: "/profile", label: "Profile" },
];

const navAdmin = [
  { href: "/", label: "Home" },
  { href: "/programs", label: "Programs" },
  { href: "/courses", label: "Courses" },
  { href: "/students", label: "Students" },
  { href: "/admin/parents", label: "Parents" },
  { href: "/profile", label: "Profile" },
];

const navParentOrGuest = [
  { href: "/", label: "Home" },
  { href: "/profile", label: "Profile" },
];

function pathAllowedForNonAdmin(pathname: string): boolean {
  if (pathname === "/") return true;
  if (pathname === "/profile" || pathname.startsWith("/profile/")) return true;
  if (pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up")) return true;
  return false;
}

type Props = { children: ReactNode; title?: string };

const btnBase =
  "inline-flex items-center justify-center rounded-lg text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

export function AppLayout({ children, title }: Props) {
  const { pathname, replace, isReady } = useRouter();
  const { user, isLoaded } = useUser();
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const { user: muninnUser, loading: roleLoading, error: roleError, isAdmin } = useMuninnUserProfile();

  const nav = useMemo(() => {
    if (!isSignedIn) return navParentOrGuest;
    if (roleLoading) return navLoading;
    if (isAdmin) return navAdmin;
    return navParentOrGuest;
  }, [isSignedIn, roleLoading, isAdmin]);

  useEffect(() => {
    if (!isReady || !authLoaded || !isSignedIn) return;
    if (roleLoading) return;
    if (roleError) return;
    if (!muninnUser) return;
    if (isAdmin) return;
    if (pathAllowedForNonAdmin(pathname)) return;
    void replace({ pathname: "/profile", query: { restricted: "1" } });
  }, [
    isReady,
    authLoaded,
    isSignedIn,
    roleLoading,
    roleError,
    muninnUser,
    isAdmin,
    pathname,
    replace,
  ]);

  return (
    <div className="min-h-screen text-slate-800 dark:text-slate-100">
      <header className="sticky top-0 z-50 border-b border-[var(--header-border)] bg-[var(--header-bg)] shadow-sm shadow-slate-900/5 backdrop-blur-md dark:shadow-slate-950/40">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-5">
            <Link
              href="/"
              className="group flex shrink-0 items-center gap-2.5 no-underline"
            >
              <span
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-bold text-white shadow-sm ring-1 ring-white/20"
                aria-hidden
              >
                M
              </span>
              <span className="text-lg font-semibold tracking-tight text-slate-900 group-hover:text-slate-700 dark:text-white dark:group-hover:text-slate-200">
                Muninn
              </span>
            </Link>
            <nav className="flex min-w-0 max-w-full flex-1 flex-wrap gap-0.5 text-xs sm:text-sm" aria-label="Main">
              {nav.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={
                      `rounded-md px-2.5 py-1.5 transition ` +
                      (active
                        ? "bg-slate-200/80 font-medium text-slate-900 dark:bg-slate-700/80 dark:text-white"
                        : "text-slate-600 hover:bg-slate-200/50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100")
                    }
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {isLoaded && user && isSignedIn && (
              <span className="hidden max-w-[11rem] truncate text-xs text-slate-500 dark:text-slate-400 lg:inline">
                {user.primaryEmailAddress?.emailAddress}
              </span>
            )}
            {authLoaded && isSignedIn && (
              <div className="flex items-center gap-2 sm:gap-3">
                <SignOutButton redirectUrl="/">
                  <button
                    type="button"
                    className={`${btnBase} text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100`}
                  >
                    Sign out
                  </button>
                </SignOutButton>
                <div className="scale-100 [filter:none]">
                  <UserButton
                    appearance={{
                      elements: {
                        userButtonBox: "border border-slate-200/80 dark:border-slate-600",
                        userButtonTrigger:
                          "rounded-lg focus:shadow-sm focus:shadow-blue-500/20",
                      },
                    }}
                  />
                </div>
              </div>
            )}
            {authLoaded && !isSignedIn && (
              <div className="flex items-center gap-2">
                <SignInButton mode="redirect" forceRedirectUrl="/">
                  <button
                    type="button"
                    className={`${btnBase} border border-slate-300/90 bg-white px-3 py-1.5 text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-100 dark:hover:bg-slate-700`}
                  >
                    Sign in
                  </button>
                </SignInButton>
                <SignUpButton mode="redirect" forceRedirectUrl="/">
                  <button
                    type="button"
                    className={`${btnBase} bg-gradient-to-b from-blue-500 to-indigo-600 px-3 py-1.5 text-white shadow-sm ring-1 ring-white/20 hover:from-blue-600 hover:to-indigo-700 dark:from-blue-600 dark:to-indigo-600`}
                  >
                    Sign up
                  </button>
                </SignUpButton>
              </div>
            )}
          </div>
        </div>
        {title && (
          <div className="border-t border-slate-200/80 bg-slate-50/90 px-4 py-3 dark:border-slate-800/80 dark:bg-slate-900/40">
            <h1 className="mx-auto max-w-5xl text-base font-medium text-slate-800 dark:text-slate-200">
              {title}
            </h1>
          </div>
        )}
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
