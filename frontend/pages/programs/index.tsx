import { useCallback, useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import {
  CreateProgramModal,
  EditProgramModal,
  ProgramsTable,
  ProgramsToolbar,
} from "@/components/programs";
import { useMuninnApi } from "@/hooks/useMuninnApi";
import type { IProgram, ProgramCreateInput } from "@/lib/types";

export default function ProgramsPage() {
  const api = useMuninnApi();
  const [programs, setPrograms] = useState<IProgram[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<IProgram | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const load = useCallback(() => {
    setError(null);
    api
      .listPrograms()
      .then(setPrograms)
      .catch((e: Error) => setError(e.message));
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreateModal() {
    setEditing(null);
    setCreateModalOpen(true);
    setError(null);
  }

  function closeCreateModal() {
    if (saving) return;
    setCreateModalOpen(false);
  }

  function openEdit(p: IProgram) {
    setCreateModalOpen(false);
    setEditing(p);
    setError(null);
  }

  function closeEdit() {
    setEditing(null);
  }

  async function handleCreate(data: ProgramCreateInput) {
    setSaving(true);
    setError(null);
    try {
      await api.createProgram(data);
      setCreateModalOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create program");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEdit(id: string, data: ProgramCreateInput) {
    setSavingEdit(true);
    setError(null);
    try {
      await api.updateProgram(id, { ...data });
      closeEdit();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update program");
    } finally {
      setSavingEdit(false);
    }
  }

  async function onDelete(p: IProgram) {
    const ok = window.confirm(
      `Delete “${p.name}”? This cannot be undone. Related enrollments may be removed; courses linked to this program will be unlinked.`,
    );
    if (!ok) return;
    setDeletingId(p.id);
    setError(null);
    try {
      await api.deleteProgram(p.id);
      if (editing?.id === p.id) closeEdit();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete program");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <AppLayout title="Programs">
      {error && (
        <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}

      <CreateProgramModal
        open={createModalOpen}
        isSubmitting={saving}
        onClose={closeCreateModal}
        onCreate={handleCreate}
      />

      <EditProgramModal
        program={editing}
        isSubmitting={savingEdit}
        onClose={closeEdit}
        onSave={handleSaveEdit}
      />

      <ProgramsToolbar onCreateClick={openCreateModal} />

      {programs === null && <p className="text-zinc-500">Loading…</p>}
      {programs && programs.length === 0 && <p className="text-zinc-500">No programs yet.</p>}
      {programs && programs.length > 0 && (
        <ProgramsTable
          programs={programs}
          deletingId={deletingId}
          onEdit={openEdit}
          onDelete={onDelete}
        />
      )}
    </AppLayout>
  );
}
