type Props = {
  onCreateClick: () => void;
};

export function ProgramsToolbar({ onCreateClick }: Props) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h2 className="text-sm font-medium text-zinc-500">All programs</h2>
      <button
        type="button"
        onClick={onCreateClick}
        className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
      >
        Create program
      </button>
    </div>
  );
}
