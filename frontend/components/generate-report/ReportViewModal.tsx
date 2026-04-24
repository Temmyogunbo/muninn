import { useCallback, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";

type Props = {
  open: boolean;
  jobId: string | null;
  isLoading: boolean;
  error: string | null;
  markdown: string | null;
  onClose: () => void;
};

const markdownComponents: Partial<Components> = {
  h1: ({ children }) => (
    <h1 className="mb-3 mt-6 text-2xl font-bold text-gray-900 first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2 mt-5 text-xl font-semibold text-gray-900">{children}</h2>
  ),
  h3: ({ children }) => <h3 className="mb-2 mt-4 text-lg font-semibold text-gray-900">{children}</h3>,
  p: ({ children }) => <p className="mb-3 leading-relaxed text-gray-800 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="mb-3 list-disc space-y-1 pl-6 text-gray-800">{children}</ul>,
  ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1 pl-6 text-gray-800">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-primary font-medium underline decoration-primary/30 underline-offset-2 hover:decoration-primary"
      target="_blank"
      rel="noreferrer"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mb-3 border-l-4 border-gray-200 pl-4 italic text-gray-700">{children}</blockquote>
  ),
  hr: () => <hr className="my-6 border-gray-200" />,
  table: ({ children }) => (
    <div className="mb-3 overflow-x-auto">
      <table className="min-w-full border-collapse border border-gray-200 text-left text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-gray-50">{children}</thead>,
  th: ({ children }) => <th className="border border-gray-200 px-3 py-2 font-semibold text-gray-900">{children}</th>,
  td: ({ children }) => <td className="border border-gray-200 px-3 py-2 text-gray-800">{children}</td>,
  pre: ({ children }) => (
    <pre className="mb-3 max-h-96 overflow-auto rounded-lg bg-gray-900 p-4 text-sm text-gray-100">{children}</pre>
  ),
  code: (props) => {
    const { className, children, ...rest } = props;
    const isBlock = typeof className === "string" && /language-/.test(className);
    if (isBlock) {
      return (
        <code className={className} {...rest}>
          {children}
        </code>
      );
    }
    return (
      <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-sm text-gray-900" {...rest}>
        {children}
      </code>
    );
  },
  strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
};

export function ReportViewModal({ open, jobId, isLoading, error, markdown, onClose }: Props) {
  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onKeyDown]);

  if (!open) return null;

  const shortId = jobId ? (jobId.length > 10 ? `${jobId.slice(0, 8)}…` : jobId) : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal
        aria-labelledby="report-view-title"
        className="relative z-10 flex max-h-[min(90vh,880px)] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 id="report-view-title" className="text-lg font-semibold text-gray-900">
            {shortId ? `Report — ${shortId}` : "Report"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
          >
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {isLoading && (
            <p className="text-sm text-gray-600" role="status">
              Loading report…
            </p>
          )}
          {error && !isLoading && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
          )}
          {!isLoading && !error && markdown != null && (
            <div className="markdown-report">
              <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={markdownComponents}>
                {markdown}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
