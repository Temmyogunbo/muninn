import { useEffect, useState } from "react";
import { ProgramModalShell } from "@/components/programs/ProgramModalShell";

const empty = () => ({
  display_name: "",
  email: "",
  phone: "",
  clerk_user_id: "",
});

type Props = {
  open: boolean;
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onCreate: (data: {
    display_name: string;
    email: string;
    phone: string;
    clerk_user_id: string;
  }) => Promise<void>;
};

export function CreateParentModal({ open, isSubmitting, error, onClose, onCreate }: Props) {
  const [form, setForm] = useState(empty);

  useEffect(() => {
    if (open) {
      setForm(empty());
    }
  }, [open]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onCreate({
      display_name: form.display_name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      clerk_user_id: form.clerk_user_id.trim(),
    });
  }

  return (
    <ProgramModalShell
      open={open}
      title="Create parent"
      titleId="create-parent-title"
      onBackdropClose={onClose}
      backdropCloseDisabled={isSubmitting}
    >
      <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
        Create the user in Clerk first, then use the same <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">sub</code> as
        their Clerk user id. New users are created with the <strong>parent</strong> role.
      </p>
      {error && (
        <p className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}
      <form onSubmit={onSubmit} className="space-y-3">
        <label className="block text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">Display name</span>
          <input
            required
            className="mt-1 w-full rounded border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-950"
            value={form.display_name}
            onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
            autoFocus
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
        <label className="block text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">Clerk user id</span>
          <input
            required
            className="mt-1 w-full rounded border border-zinc-300 bg-white font-mono text-sm px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-950"
            placeholder="user_…"
            value={form.clerk_user_id}
            onChange={(e) => setForm((f) => ({ ...f, clerk_user_id: e.target.value }))}
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
            {isSubmitting ? "Creating…" : "Create parent"}
          </button>
        </div>
      </form>
    </ProgramModalShell>
  );
}
