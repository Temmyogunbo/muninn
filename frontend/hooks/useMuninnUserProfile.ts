import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";
import { useMuninnApi } from "@/hooks/useMuninnApi";
import type { UserRow } from "@/lib/types";

/**
 * After sign-in, loads the Muninn `GET /api/user/me` row (creates on first request).
 * Used for admin-only UI and navigation; does not run when signed out.
 */
export function useMuninnUserProfile() {
  const { isLoaded, isSignedIn } = useAuth();
  const api = useMuninnApi();
  const [user, setUser] = useState<UserRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!isSignedIn) {
      setUser(null);
      setError(null);
      return Promise.resolve();
    }
    setLoading(true);
    setError(null);
    return api
      .getUserMe()
      .then((res) => {
        setUser(res.user);
      })
      .catch((e: Error) => {
        setUser(null);
        setError(e.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [api, isSignedIn]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setUser(null);
      setError(null);
      setLoading(false);
      return;
    }
    void refresh();
  }, [isLoaded, isSignedIn, refresh]);

  const isAdmin = user?.role === "admin";

  return { user, loading, error, isAdmin, refresh };
}
