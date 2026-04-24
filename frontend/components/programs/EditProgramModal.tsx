import { useEffect, useState } from "react";
import { ProgramFormFields } from "./ProgramFormFields";
import { ProgramModalShell } from "./ProgramModalShell";
import { emptyProgramForm, programToForm } from "./programUtils";
import type { IProgram, ProgramCreateInput } from "@/lib/types";

type Props = {
  program: IProgram | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSave: (id: string, data: ProgramCreateInput) => Promise<void>;
};

export function EditProgramModal({ program, isSubmitting, onClose, onSave }: Props) {
  const [form, setForm] = useState<ProgramCreateInput>(emptyProgramForm());

  useEffect(() => {
    if (program) {
      setForm(programToForm(program));
    } else {
      setForm(emptyProgramForm());
    }
  }, [program]);

  const open = program != null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!program) return;
    await onSave(program.id, form);
  }

  return (
    <ProgramModalShell
      open={open}
      title="Edit program"
      titleId="edit-program-title"
      onBackdropClose={onClose}
      backdropCloseDisabled={isSubmitting}
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <ProgramFormFields value={form} onChange={setForm} />
        <div className="flex flex-wrap gap-2 sm:justify-end">
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
            {isSubmitting ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </ProgramModalShell>
  );
}
