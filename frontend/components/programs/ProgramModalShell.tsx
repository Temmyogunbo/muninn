import { type ReactNode } from "react";

type Props = {
  open: boolean;
  title: string;
  titleId: string;
  onBackdropClose: () => void;
  backdropCloseDisabled?: boolean;
  children: ReactNode;
};

export function ProgramModalShell({
  open,
  title,
  titleId,
  onBackdropClose,
  backdropCloseDisabled = false,
  children,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-black/50"
        aria-label="Close dialog"
        onClick={() => !backdropCloseDisabled && onBackdropClose()}
      />
      <div className="relative z-[101] w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-5 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
        <h2 id={titleId} className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
