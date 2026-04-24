import { SignInButton, SignOutButton, SignUpButton, useAuth, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { AppLayout } from "@/components/AppLayout";

const card =
  "rounded-2xl border border-slate-200/90 bg-[var(--surface)] p-6 shadow-sm shadow-slate-900/5 dark:border-slate-700/80 dark:bg-[var(--surface)] dark:shadow-slate-950/50 sm:p-8";

const btn =
  "inline-flex min-w-[7.5rem] items-center justify-center rounded-xl px-5 py-2.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500";

export default function Home() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user, isLoaded: userLoaded } = useUser();
  console.log({user, isLoaded, isSignedIn});

  const name =
    user?.firstName ||
    user?.primaryEmailAddress?.emailAddress?.split("@")[0] ||
    "there";

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl space-y-8">
        <div className={card}>
          <p className="text-xs font-medium uppercase tracking-wider text-blue-600 dark:text-blue-400">
            Camp & learning programs
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            Muninn
          </h1>
          <p className="mt-3 max-w-prose text-lg text-slate-600 dark:text-slate-300">
            Manage programs, courses, student&rsquo;s profiles, and enrollments in one place.
          </p>

          {isLoaded && userLoaded && isSignedIn && (
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center pt-4">
              <Link
                href="/programs"
                className={btn + " bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"}
              >
                View programs
              </Link>
            </div>
        )}
        </div>

        {(!isLoaded || !userLoaded) && (
          <p className="text-center text-sm text-slate-500">Loading account…</p>
        )}

        { !isSignedIn && (
          <div className={card + " space-y-5"}>
            <h2 className="text-lg font-medium text-slate-900 dark:text-white">Get started</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Sign in with your existing account, or create one to use the Muninn API and manage your family&rsquo;s
              data securely.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
              <SignInButton mode="redirect" forceRedirectUrl="/">
                <button
                  type="button"
                  className={
                    btn +
                    " w-full bg-slate-900 text-white shadow-sm hover:bg-slate-800 sm:w-auto dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                  }
                >
                  Sign in
                </button>
              </SignInButton>
              <SignUpButton mode="redirect" forceRedirectUrl="/">
                <button
                  type="button"
                  className={
                    btn +
                    " w-full border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 sm:w-auto dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-100 dark:hover:bg-slate-800"
                  }
                >
                  Create account
                </button>
              </SignUpButton>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
