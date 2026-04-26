import { useEffect, useState } from "react";
import { ProgramModalShell } from "@/components/programs/ProgramModalShell";
import { textToStringList } from "@/lib/form-utils";
import type { ProgramRow } from "@/lib/types";

const empty = () => ({
  title: "",
  description: "",
  learning_outcomes: "",
  learning_objectives: "",
  skills: "",
  program_id: "" as string,
});

export type CreateCourseInput = {
  title: string;
  description: string | null;
  learning_outcomes: string[];
  learning_objectives: string[];
  skills: string[];
  program_id: string | null;
};

type Props = {
  open: boolean;
  isSubmitting: boolean;
  error: string | null;
  programs: ProgramRow[];
  onClose: () => void;
  onCreate: (data: CreateCourseInput) => Promise<void>;
};

export function CreateCourseModal({
  open,
  isSubmitting,
  error,
  programs,
  onClose,
  onCreate,
}: Props) {
  const [form, setForm] = useState(empty);

  useEffect(() => {
    if (open) {
      setForm(empty());
    }
  }, [open]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onCreate({
      title: form.title.trim(),
      description: form.description.trim() || null,
      learning_outcomes: textToStringList(form.learning_outcomes),
      learning_objectives: textToStringList(form.learning_objectives),
      skills: textToStringList(form.skills),
      program_id: form.program_id || null,
    });
  }

  return (
    <ProgramModalShell
      open={open}
      title="Create course"
      titleId="create-course-title"
      onBackdropClose={onClose}
      backdropCloseDisabled={isSubmitting}
    >
      <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
        Add a course template. You can link it to a program when creating or editing a program. Program type (summer
        camp, etc.) is set on the program record, not the course.
      </p>
      {error && (
        <p className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}
      <form onSubmit={onSubmit} className="max-h-[min(70vh,32rem)] space-y-3 overflow-y-auto pr-1">
        <label className="block text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">Title</span>
          <input
            required
            className="mt-1 w-full rounded border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-950"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            autoFocus
          />
        </label>
        <label className="block text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">Program (optional)</span>
          <select
            className="mt-1 w-full rounded border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-950"
            value={form.program_id}
            onChange={(e) => setForm((f) => ({ ...f, program_id: e.target.value }))}
          >
            <option value="">None</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">Description (optional)</span>
          <textarea
            className="mt-1 w-full min-h-[3rem] rounded border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-950"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </label>
        <label className="block text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">Learning outcomes (one per line)</span>
          <textarea
            required
            className="mt-1 w-full min-h-[3.5rem] rounded border border-zinc-300 bg-white px-2 py-1.5 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-950"
            value={form.learning_outcomes}
            onChange={(e) => setForm((f) => ({ ...f, learning_outcomes: e.target.value }))}
          />
        </label>
        <label className="block text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">Learning objectives (one per line)</span>
          <textarea
            required
            className="mt-1 w-full min-h-[3.5rem] rounded border border-zinc-300 bg-white px-2 py-1.5 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-950"
            value={form.learning_objectives}
            onChange={(e) => setForm((f) => ({ ...f, learning_objectives: e.target.value }))}
          />
        </label>
        <label className="block text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">Skills (one per line)</span>
          <textarea
            required
            className="mt-1 w-full min-h-[3.5rem] rounded border border-zinc-300 bg-white px-2 py-1.5 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-950"
            value={form.skills}
            onChange={(e) => setForm((f) => ({ ...f, skills: e.target.value }))}
          />
        </label>
        <div className="flex flex-wrap gap-2 pt-1 sm:justify-end">
          <button
            type="button"
            disabled={isSubmitting}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {isSubmitting ? "Creating…" : "Create course"}
          </button>
        </div>
      </form>
    </ProgramModalShell>
  );
}
