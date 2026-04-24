import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { IconPencil, IconTrash2 } from "@/components/icons/ProgramTableIcons";
import { ProgramModalShell } from "@/components/programs/ProgramModalShell";
import { formatDate } from "@/components/programs/programUtils";
import { useMuninnApi } from "@/hooks/useMuninnApi";
import type { EnrollmentRow, EnrollmentStatus, StudentRow } from "@/lib/types";

const STATUS_OPTIONS: EnrollmentStatus[] = ["pending", "active", "completed", "withdrawn"];

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** API may return `YYYY-MM-DD` or a full ISO datetime; `<input type="date">` needs `YYYY-MM-DD`. */
function toInputDate(value: string): string {
  return value.slice(0, 10);
}

type Props = {
  programId: string;
  enrollments: EnrollmentRow[] | null;
  students: StudentRow[] | null;
  onRefetch: () => void;
};

export function ProgramEnrollmentsBlock({ programId, enrollments, students, onRefetch }: Props) {
  const api = useMuninnApi();
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [enrollmentToEdit, setEnrollmentToEdit] = useState<EnrollmentRow | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [form, setForm] = useState({
    student_id: "",
    enrolled_at: todayIsoDate(),
    status: "pending" as EnrollmentStatus,
    notes: "",
  });
  const [editForm, setEditForm] = useState({
    enrolled_at: todayIsoDate(),
    status: "pending" as EnrollmentStatus,
    notes: "",
  });

  const availableStudents = useMemo(() => {
    if (!students || !enrollments) return students ?? [];
    const taken = new Set(enrollments.map((e) => e.student_id));
    return students.filter((s) => !taken.has(s.id));
  }, [students, enrollments]);

  useEffect(() => {
    if (!enrollments?.length) return;
    setSelectedIds((prev) => {
      const next = new Set<string>();
      for (const id of prev) {
        if (enrollments.some((e) => e.id === id)) next.add(id);
      }
      return next;
    });
  }, [enrollments]);

  const openAdd = useCallback(() => {
    setActionError(null);
    setForm({
      student_id: availableStudents[0]?.id ?? "",
      enrolled_at: todayIsoDate(),
      status: "pending",
      notes: "",
    });
    setAddOpen(true);
  }, [availableStudents]);

  const closeAdd = useCallback(() => {
    if (saving) return;
    setAddOpen(false);
  }, [saving]);

  const openEdit = useCallback((row: EnrollmentRow) => {
    setActionError(null);
    setEnrollmentToEdit(row);
    setEditForm({
      enrolled_at: toInputDate(row.enrolled_at),
      status: row.status,
      notes: row.notes ?? "",
    });
    setEditOpen(true);
  }, []);

  const closeEdit = useCallback(() => {
    if (savingEdit) return;
    setEditOpen(false);
    setEnrollmentToEdit(null);
  }, [savingEdit]);

  async function onSubmitAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.student_id) {
      setActionError("Select a student.");
      return;
    }
    setSaving(true);
    setActionError(null);
    try {
      await api.addProgramEnrollment(programId, {
        student_id: form.student_id,
        enrolled_at: form.enrolled_at,
        status: form.status,
        notes: form.notes.trim() || null,
      });
      setAddOpen(false);
      onRefetch();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not add enrollment");
    } finally {
      setSaving(false);
    }
  }

  async function onSubmitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!enrollmentToEdit) return;
    setSavingEdit(true);
    setActionError(null);
    try {
      await api.updateProgramEnrollment(programId, enrollmentToEdit.id, {
        enrolled_at: editForm.enrolled_at,
        status: editForm.status,
        notes: editForm.notes.trim() || null,
      });
      setEditOpen(false);
      setEnrollmentToEdit(null);
      onRefetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not update enrollment");
    } finally {
      setSavingEdit(false);
    }
  }

  async function onDelete(e: EnrollmentRow) {
    const ok = window.confirm("Remove this enrollment? This cannot be undone.");
    if (!ok) return;
    setDeletingId(e.id);
    setActionError(null);
    try {
      await api.deleteProgramEnrollment(programId, e.id);
      onRefetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not remove enrollment");
    } finally {
      setDeletingId(null);
    }
  }

  const studentName = useCallback(
    (sid: string) => students?.find((s) => s.id === sid)?.student_name ?? sid,
    [students],
  );

  const allSelected =
    Boolean(enrollments?.length) && selectedIds.size === (enrollments?.length ?? 0);
  const someSelected = selectedIds.size > 0;

  const toggleRow = useCallback((enrollmentId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(enrollmentId)) next.delete(enrollmentId);
      else next.add(enrollmentId);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (!enrollments?.length) return;
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(enrollments.map((e) => e.id)));
  }, [allSelected, enrollments]);

  const onGenerateReport = useCallback(() => {
    if (selectedIds.size === 0) {
      setActionError("Select at least one enrollment to generate a report.");
      return;
    }
    setActionError(null);
    const ids = Array.from(selectedIds);
    const query =
      ids.length === 1
        ? { enrollment_id: ids[0]! }
        : { enrollment_id: ids };
    void router.push({ pathname: "/generate-report/generate-report", query });
  }, [router, selectedIds]);

  return (
    <section className="mt-10" aria-label="Enrollments">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-medium text-zinc-500">Enrollments</h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onGenerateReport}
            disabled={!enrollments?.length}
            className="inline-flex items-center justify-center rounded-lg border border-violet-300 bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-900 shadow-sm transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-100 dark:hover:bg-violet-900/50"
          >
            Generate report
          </button>
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
          >
            Add enrollment
          </button>
        </div>
      </div>

      {actionError && (
        <p className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100">
          {actionError}
        </p>
      )}

      <ProgramModalShell
        open={addOpen}
        title="Add enrollment"
        titleId="add-enrollment-title"
        onBackdropClose={closeAdd}
        backdropCloseDisabled={saving}
      >
        <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
          Enroll one of your students in this program. You need a parent profile and at least one student.
        </p>
        <form onSubmit={onSubmitAdd} className="space-y-3">
          <label className="block text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Student</span>
            <select
              required
              className="mt-1 w-full rounded border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-950"
              value={form.student_id}
              onChange={(e) => setForm((f) => ({ ...f, student_id: e.target.value }))}
            >
              <option value="">{availableStudents.length ? "Select a student" : "No students available to enroll"}</option>
              {availableStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.student_name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Enrolled on</span>
            <input
              type="date"
              required
              className="mt-1 w-full rounded border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-950"
              value={form.enrolled_at}
              onChange={(e) => setForm((f) => ({ ...f, enrolled_at: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Status</span>
            <select
              className="mt-1 w-full rounded border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-950"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as EnrollmentStatus }))}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Notes (optional)</span>
            <textarea
              className="mt-1 w-full min-h-[3rem] rounded border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-950"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </label>
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <button
              type="button"
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-800 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              onClick={closeAdd}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !availableStudents.length}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {saving ? "Enrolling…" : "Add enrollment"}
            </button>
          </div>
        </form>
      </ProgramModalShell>

      <ProgramModalShell
        open={editOpen}
        title="Edit enrollment"
        titleId="edit-enrollment-title"
        onBackdropClose={closeEdit}
        backdropCloseDisabled={savingEdit}
      >
        {enrollmentToEdit && (
          <form onSubmit={onSubmitEdit} className="space-y-3">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Student:{" "}
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {studentName(enrollmentToEdit.student_id)}
              </span>
            </p>
            <label className="block text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">Enrolled on</span>
              <input
                type="date"
                required
                className="mt-1 w-full rounded border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-950"
                value={editForm.enrolled_at}
                onChange={(ev) => setEditForm((f) => ({ ...f, enrolled_at: ev.target.value }))}
              />
            </label>
            <label className="block text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">Status</span>
              <select
                className="mt-1 w-full rounded border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-950"
                value={editForm.status}
                onChange={(ev) => setEditForm((f) => ({ ...f, status: ev.target.value as EnrollmentStatus }))}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">Notes (optional)</span>
              <textarea
                className="mt-1 w-full min-h-[3rem] rounded border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-950"
                value={editForm.notes}
                onChange={(ev) => setEditForm((f) => ({ ...f, notes: ev.target.value }))}
              />
            </label>
            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <button
                type="button"
                className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-800 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                onClick={closeEdit}
                disabled={savingEdit}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingEdit}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
              >
                {savingEdit ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        )}
      </ProgramModalShell>

      {enrollments === null && <p className="text-sm text-zinc-500">Loading enrollments…</p>}
      {enrollments && enrollments.length === 0 && (
        <p className="text-sm text-zinc-500">No enrollments in this program yet. Use &quot;Add enrollment&quot; to register a student.</p>
      )}
      {enrollments && enrollments.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/90 dark:border-zinc-800 dark:bg-zinc-900/50">
                <th className="w-10 min-w-10 px-2 py-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 cursor-pointer rounded border-zinc-300 text-violet-600 focus:ring-violet-500 dark:border-zinc-600"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected && !allSelected;
                    }}
                    onChange={toggleSelectAll}
                    title={allSelected ? "Deselect all" : "Select all"}
                    aria-label="Select all enrollments"
                  />
                </th>
                <th className="px-3 py-2 font-medium text-zinc-700 dark:text-zinc-200">Student</th>
                <th className="px-3 py-2 font-medium text-zinc-700 dark:text-zinc-200">Enrolled</th>
                <th className="px-3 py-2 font-medium text-zinc-700 dark:text-zinc-200">Status</th>
                <th className="px-3 py-2 font-medium text-zinc-700 dark:text-zinc-200">Notes</th>
                <th className="w-[1%] whitespace-nowrap px-3 py-2 text-right font-medium text-zinc-700 dark:text-zinc-200">
                  Reports
                </th>
                <th className="w-[1%] px-3 py-2 text-right font-medium text-zinc-700 dark:text-zinc-200">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {enrollments.map((e) => (
                <tr key={e.id} className="bg-white dark:bg-zinc-950/40">
                  <td className="w-10 min-w-10 px-2 py-2 align-top">
                    <input
                      type="checkbox"
                      className="h-4 w-4 cursor-pointer rounded border-zinc-300 text-violet-600 focus:ring-violet-500 dark:border-zinc-600"
                      checked={selectedIds.has(e.id)}
                      onChange={() => toggleRow(e.id)}
                      aria-label={`Select ${studentName(e.student_id)}`}
                    />
                  </td>
                  <td className="px-3 py-2 text-zinc-900 dark:text-zinc-100">{studentName(e.student_id)}</td>
                  <td className="px-3 py-2 text-zinc-600 dark:text-zinc-300">{formatDate(e.enrolled_at)}</td>
                  <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{e.status}</td>
                  <td className="max-w-xs truncate px-3 py-2 text-zinc-500" title={e.notes ?? undefined}>
                    {e.notes ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() =>
                        void router.push(
                          `/programs/${encodeURIComponent(programId)}/enrollment-reports?enrollment_id=${encodeURIComponent(
                            e.id,
                          )}`,
                        )
                      }
                      className="text-sm font-medium text-violet-700 underline decoration-violet-300 underline-offset-2 transition hover:decoration-violet-700 dark:text-violet-400 dark:decoration-violet-600 dark:hover:decoration-violet-300"
                    >
                      View reports
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex items-center justify-end gap-0.5">
                      <button
                        type="button"
                        onClick={() => openEdit(e)}
                        disabled={savingEdit}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-600 transition hover:bg-zinc-200 hover:text-zinc-900 disabled:opacity-50 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                        aria-label="Edit enrollment"
                        title="Edit"
                      >
                        <IconPencil />
                      </button>
                      <button
                        type="button"
                        onClick={() => void onDelete(e)}
                        disabled={deletingId === e.id}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-600 transition hover:bg-red-100 hover:text-red-800 disabled:opacity-50 dark:hover:bg-red-950 dark:hover:text-red-200"
                        aria-label="Remove enrollment"
                        title="Remove"
                      >
                        {deletingId === e.id ? (
                          <span className="h-4 w-4 animate-pulse rounded border border-zinc-300 dark:border-zinc-600" />
                        ) : (
                          <IconTrash2 />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
