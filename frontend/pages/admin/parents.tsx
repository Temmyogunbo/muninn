import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { CreateParentModal, ParentsTable } from "@/components/parents";
import { useMuninnUserProfile } from "@/hooks/useMuninnUserProfile";
import { useMuninnApi } from "@/hooks/useMuninnApi";
import type { UserRow } from "@/lib/types";

const btnPrimary =
  "inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white";

export default function ParentsPage() {
  const api = useMuninnApi();
  const { replace, isReady } = useRouter();
  const { isAdmin, loading: profileLoading, user, error: profileError } = useMuninnUserProfile();
  const [parents, setParents] = useState<UserRow[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadParents = useCallback(() => {
    setListError(null);
    return api
      .listParents()
      .then(setParents)
      .catch((e: Error) => {
        setListError(e.message);
        setParents(null);
      });
  }, [api]);

  useEffect(() => {
    if (!isReady || profileLoading) return;
    if (user && !isAdmin) {
      void replace("/profile?restricted=1");
      return;
    }
    if (user && isAdmin) {
      void loadParents();
    }
  }, [isReady, profileLoading, user, isAdmin, replace, loadParents]);

  const handleCreate = useCallback(
    async (data: Parameters<typeof api.createParent>[0]) => {
      setFormError(null);
      setSuccessMsg(null);
      setSaving(true);
      try {
        const row = await api.createParent(data);
        setSuccessMsg(`Parent “${row.display_name}” was created.`);
        setModalOpen(false);
        await loadParents();
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Failed to create parent");
      } finally {
        setSaving(false);
      }
    },
    [api, loadParents],
  );

  if (!isReady || profileLoading) {
    return (
      <AppLayout title="Parents">
        <p className="text-zinc-500">Loading…</p>
      </AppLayout>
    );
  }

  if (profileError) {
    return (
      <AppLayout title="Parents">
        <p className="text-red-600 dark:text-red-400">{profileError}</p>
      </AppLayout>
    );
  }

  if (user && !isAdmin) {
    return null;
  }

  return (
    <AppLayout title="Parents">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-prose text-sm text-zinc-600 dark:text-zinc-400">
          Parent users have the <strong>parent</strong> role and can be linked to students. Invite each parent in
          Clerk first, then add their record here using the same Clerk <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">sub</code>.
        </p>
        <button type="button" className={btnPrimary} onClick={() => { setFormError(null); setModalOpen(true); }}>
          Add parent
        </button>
      </div>

      {successMsg && (
        <p className="mb-4 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
          {successMsg}
        </p>
      )}

      {listError && (
        <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {listError}
        </p>
      )}

      {parents === null && !listError && <p className="text-zinc-500">Loading parents…</p>}

      {parents !== null && <ParentsTable parents={parents} />}

      <CreateParentModal
        open={modalOpen}
        isSubmitting={saving}
        error={formError}
        onClose={() => {
          if (!saving) {
            setFormError(null);
            setModalOpen(false);
          }
        }}
        onCreate={(data) => handleCreate(data)}
      />
    </AppLayout>
  );
}
