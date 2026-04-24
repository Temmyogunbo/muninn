import { useCallback, useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useMuninnApi } from "@/hooks/useMuninnApi";
import type { UserRow } from "@/lib/types";

export default function ProfilePage() {
  const api = useMuninnApi();
  const [user, setUser] = useState<UserRow | null>(null);
  const [createdHint, setCreatedHint] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    display_name: "",
    email: "",
    phone: "",
    role: "parent",
  });

  const load = useCallback(() => {
    setError(null);
    api
      .getUserMe()
      .then((res) => {
        setUser(res.user);
        setCreatedHint(res.created);
        setForm({
          display_name: res.user.display_name,
          email: res.user.email,
          phone: res.user.phone,
          role: res.user.role,
        });
      })
      .catch((e: Error) => setError(e.message));
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const updated = await api.updateUser({
        display_name: form.display_name,
        email: form.email,
        phone: form.phone,
      });
      setUser(updated);
      setCreatedHint(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppLayout title="Parent profile">
      {error && (
        <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}

      {createdHint && (
        <p className="mb-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
          A new user record was created from your sign-in. Update your details below if needed.
        </p>
      )}

      {!user && !error && <p className="text-zinc-500">Loading…</p>}

      {user && (
        <form onSubmit={onSubmit} className="max-w-md space-y-3">
          <p className="text-xs text-zinc-500">User id: {user.id}</p>
          <label className="block text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Name</span>
            <input
              required
              className="mt-1 w-full rounded border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-950"
              value={form.display_name}
              onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Email</span>
            <input
              type="email"
              required
              className="mt-1 w-full rounded border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-950"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Phone</span>
            <input
              required
              className="mt-1 w-full rounded border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-950"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </label>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </form>
      )}
    </AppLayout>
  );
}
