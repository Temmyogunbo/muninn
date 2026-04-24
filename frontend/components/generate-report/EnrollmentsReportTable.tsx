import type { EnrollmentTableRow, Job } from "./types";
import { getJobStatusTextColor } from "./utils";

type Props = {
  enrollmentCount: number;
  enrollmentContextError: string | null;
  enrollmentTableRows: EnrollmentTableRow[] | null;
  isGenerating: boolean;
  onStart: () => void;
  latestJobByEnrollmentId: Map<string, Job>;
  completedJobByEnrollmentId: Map<string, Job>;
  onViewReport: (jobId: string, enrollmentId: string) => void;
};

export function EnrollmentsReportTable({
  enrollmentCount,
  enrollmentContextError,
  enrollmentTableRows,
  isGenerating,
  onStart,
  latestJobByEnrollmentId,
  completedJobByEnrollmentId,
  onViewReport,
}: Props) {
  if (enrollmentCount === 0) return null;

  return (
    <div className="mb-8 rounded-lg bg-white px-4 py-5 shadow sm:px-8 sm:py-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="mb-1 text-2xl font-semibold text-zinc-900">Enrollments</h2>
          <p className="text-sm text-gray-600">
            {enrollmentCount} enrollment{enrollmentCount === 1 ? "" : "s"} selected for this report.
          </p>
        </div>
        <button
          type="button"
          onClick={onStart}
          disabled={isGenerating}
          className={`inline-flex shrink-0 items-center justify-center rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition ${
            isGenerating
              ? "cursor-not-allowed bg-gray-400"
              : "bg-ai-accent shadow-md bg-purple-700 text-white hover:shadow-lg"
          }`}
        >
          {isGenerating ? "Generating…" : "Start Report Generation"}
        </button>
      </div>
      {enrollmentContextError && (
        <p className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {enrollmentContextError}
        </p>
      )}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 font-medium text-gray-800">Program</th>
              <th className="px-4 py-3 font-medium text-gray-800">Student</th>
              <th className="px-4 py-3 font-medium text-gray-800">Report status</th>
              <th className="w-[1%] px-4 py-3 text-right font-medium text-gray-800">Report</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {enrollmentTableRows === null ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-500">
                  Loading enrollment details…
                </td>
              </tr>
            ) : (
              enrollmentTableRows.map((row) => {
                const latest = latestJobByEnrollmentId.get(row.enrollmentId);
                const doneJob = completedJobByEnrollmentId.get(row.enrollmentId);
                const canView = Boolean(doneJob);
                const statusLabel = latest
                  ? latest.status.charAt(0).toUpperCase() + latest.status.slice(1)
                  : "—";
                return (
                  <tr key={row.enrollmentId} className="bg-white">
                    <td className="px-4 py-3 text-gray-900">{row.programName}</td>
                    <td className="px-4 py-3 text-gray-900">{row.studentName}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-sm font-medium ${
                          latest ? getJobStatusTextColor(latest.status) : "text-gray-400"
                        }`}
                      >
                        {statusLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled={!canView}
                        title={
                          canView
                            ? "Open generated report"
                            : "Report will be available when generation completes"
                        }
                        onClick={() => {
                          if (!doneJob) return;
                          onViewReport(doneJob.id, row.enrollmentId);
                        }}
                        className={`inline-flex min-w-[7rem] items-center justify-center rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                          canView
                            ? "bg-primary text-white hover:bg-blue-600"
                            : "cursor-not-allowed border border-gray-200 bg-gray-100 text-gray-400"
                        }`}
                      >
                        View report
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
