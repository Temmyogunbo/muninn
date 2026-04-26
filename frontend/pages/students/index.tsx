import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useMuninnApi } from "@/hooks/useMuninnApi";
import type { Gender, StudentRow } from "@/lib/types";

export default function StudentsPage() {
  const api = useMuninnApi();
  const [students, setStudents] = useState<StudentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [parents, setParents] = useState<{ id: string; display_name: string }[] | null>(null);
  const [form, setForm] = useState({
    student_name: "",
    date_of_birth: "",
    gender: "other" as Gender,
    parent_id: "",
  });

  const load = useCallback(() => {
    setError(null);
    void Promise.all([api.listParents(), api.listStudents()])
      .then(([p, s]) => {
        setParents(p.map((u) => ({ id: u.id, display_name: u.display_name })));
        setStudents(s);
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
      await api.createStudent({
        student_name: form.student_name,
        date_of_birth: form.date_of_birth,
        gender: form.gender,
        parent_id: form.parent_id,
      });
      setForm({ student_name: "", date_of_birth: "", gender: "other", parent_id: form.parent_id });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create student");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppLayout title="Students">
      <p className="mb-6 text-sm text-zinc-500">
        Add a child under a <strong>parent</strong> account. Create parent users on the{" "}
        <Link className="underline" href="/admin/parents">
          Parents
        </Link>{" "}
        page, then select them here.
      </p>

      {error && (
        <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}

      <div className="mb-10 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-3 text-sm font-medium text-zinc-500">Add a student</h2>
        <form onSubmit={onSubmit} className="grid max-w-md gap-3">
          <label className="text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Parent</span>
            <select
              required
              className="mt-1 w-full rounded border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-950"
              value={form.parent_id}
              onChange={(e) => setForm((f) => ({ ...f, parent_id: e.target.value }))}
            >
              <option value="">Select a parent</option>
              {parents?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.display_name}
                </option>
              ))}
            </select>
          </label>
          {parents && parents.length === 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              No parent users yet. Add one on the Parents page, then return here.
            </p>
          )}
          <label className="text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Name</span>
            <input
              required
              className="mt-1 w-full rounded border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-950"
              value={form.student_name}
              onChange={(e) => setForm((f) => ({ ...f, student_name: e.target.value }))}
            />
          </label>
          <label className="text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Date of birth</span>
            <input
              type="date"
              required
              className="mt-1 w-full rounded border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-950"
              value={form.date_of_birth}
              onChange={(e) => setForm((f) => ({ ...f, date_of_birth: e.target.value }))}
            />
          </label>
          <label className="text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Gender</span>
            <select
              className="mt-1 w-full rounded border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-950"
              value={form.gender}
              onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value as Gender }))}
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </label>
          <div>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {saving ? "Adding…" : "Add student"}
            </button>
          </div>
        </form>
      </div>

      <h2 className="mb-3 text-sm font-medium text-zinc-500">All students</h2>
      {students === null && <p className="text-zinc-500">Loading…</p>}
      {students && students.length === 0 && <p className="text-zinc-500">No students yet.</p>}
      <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {students?.map((s) => (
          <li key={s.id} className="px-4 py-3">
            <Link href={`/students/${s.id}`} className="font-medium text-zinc-900 hover:underline dark:text-zinc-100">
              {s.student_name}
            </Link>
            <p className="text-sm text-zinc-500">
              {s.date_of_birth} · {s.gender}
            </p>
          </li>
        ))}
      </ul>
    </AppLayout>
  );
}
