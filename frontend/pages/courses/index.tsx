import { useCallback, useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useMuninnApi } from "@/hooks/useMuninnApi";
import { textToStringList } from "@/lib/form-utils";
import type { CourseRow, ProgramRow, ProgramType } from "@/lib/types";

const PROGRAM_TYPES: { value: ProgramType; label: string }[] = [
  { value: "summer_camp", label: "Summer camp" },
  { value: "after_school_program", label: "After school" },
  { value: "online_program", label: "Online" },
  { value: "holiday_camp", label: "Holiday camp" },
];

function parseJsonList(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value)) {
    return value.map(String).filter(Boolean).join("\n");
  }
  if (typeof value === "string") {
    try {
      const p = JSON.parse(value) as unknown;
      if (Array.isArray(p)) return p.map(String).join("\n");
    } catch {
      return value;
    }
  }
  return String(value);
}

export default function CoursesPage() {
  const api = useMuninnApi();
  const [courses, setCourses] = useState<CourseRow[] | null>(null);
  const [programs, setPrograms] = useState<ProgramRow[] | null>(null);
  const [filterProgram, setFilterProgram] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    learning_outcomes: "",
    learning_objectives: "",
    skills: "",
    program_id: "" as string,
  });

  const loadPrograms = useCallback(() => {
    api
      .listPrograms()
      .then(setPrograms)
      .catch(() => setPrograms([]));
  }, [api]);

  const loadCourses = useCallback(() => {
    setError(null);
    const pid = filterProgram || undefined;
    api
      .listCourses(pid)
      .then(setCourses)
      .catch((e: Error) => setError(e.message));
  }, [api, filterProgram]);

  useEffect(() => {
    void loadPrograms();
  }, [loadPrograms]);

  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: form.title,
        description: form.description || null,
        learning_outcomes: textToStringList(form.learning_outcomes),
        learning_objectives: textToStringList(form.learning_objectives),
        skills: textToStringList(form.skills),
        program_id: form.program_id || null,
      };
      await api.createCourse(payload);
      setForm({
        title: "",
        description: "",
        learning_outcomes: "",
        learning_objectives: "",
        skills: "",
        program_id: "",
      });
      await loadCourses();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create course");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppLayout title="Courses">
      {error && (
        <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="text-zinc-500">Filter by program</span>
          <select
            className="mt-1 block rounded border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-950"
            value={filterProgram}
            onChange={(e) => setFilterProgram(e.target.value)}
          >
            <option value="">All programs</option>
            {programs?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-zinc-500">New program? Create it under Programs first.</p>
      </div>

      <div className="mb-10 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-3 text-sm font-medium text-zinc-500">Create course</h2>
        <form onSubmit={onSubmit} className="grid gap-3">
          <label className="text-sm sm:col-span-2">
            <span className="text-zinc-600 dark:text-zinc-400">Title</span>
            <input
              required
              className="mt-1 w-full max-w-md rounded border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-950"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </label>
          <label className="text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Program (optional)</span>
            <select
              className="mt-1 w-full max-w-md rounded border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-950"
              value={form.program_id}
              onChange={(e) => setForm((f) => ({ ...f, program_id: e.target.value }))}
            >
              <option value="">None</option>
              {programs?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs text-zinc-500 sm:col-span-2">
            Program type is set on the program record (
            {PROGRAM_TYPES.map((t) => t.label).join(", ")} are valid there).
          </p>
          <label className="text-sm sm:col-span-2">
            <span className="text-zinc-600 dark:text-zinc-400">Description (optional)</span>
            <textarea
              className="mt-1 w-full min-h-[4rem] rounded border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-950"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="text-zinc-600 dark:text-zinc-400">Learning outcomes (one per line)</span>
            <textarea
              required
              className="mt-1 w-full min-h-[4rem] rounded border border-zinc-300 bg-white px-2 py-1.5 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-950"
              value={form.learning_outcomes}
              onChange={(e) => setForm((f) => ({ ...f, learning_outcomes: e.target.value }))}
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="text-zinc-600 dark:text-zinc-400">Learning objectives (one per line)</span>
            <textarea
              required
              className="mt-1 w-full min-h-[4rem] rounded border border-zinc-300 bg-white px-2 py-1.5 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-950"
              value={form.learning_objectives}
              onChange={(e) => setForm((f) => ({ ...f, learning_objectives: e.target.value }))}
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="text-zinc-600 dark:text-zinc-400">Skills (one per line)</span>
            <textarea
              required
              className="mt-1 w-full min-h-[4rem] rounded border border-zinc-300 bg-white px-2 py-1.5 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-950"
              value={form.skills}
              onChange={(e) => setForm((f) => ({ ...f, skills: e.target.value }))}
            />
          </label>
          <div>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {saving ? "Creating…" : "Create course"}
            </button>
          </div>
        </form>
      </div>

      <h2 className="mb-3 text-sm font-medium text-zinc-500">Courses</h2>
      {courses === null && <p className="text-zinc-500">Loading…</p>}
      {courses && courses.length === 0 && <p className="text-zinc-500">No courses match this filter.</p>}
      <ul className="space-y-3">
        {courses?.map((c) => {
          const outcomes = parseJsonList(c.learning_outcomes);
          return (
            <li key={c.id} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="font-medium text-zinc-900 dark:text-zinc-100">{c.title}</p>
              {c.description && <p className="text-sm text-zinc-500">{c.description}</p>}
              {outcomes && (
                <p className="mt-2 whitespace-pre-wrap text-xs text-zinc-600 dark:text-zinc-400">{outcomes}</p>
              )}
            </li>
          );
        })}
      </ul>
    </AppLayout>
  );
}
