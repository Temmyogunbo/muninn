import type { AnalysisProgress, Job } from "./types";
import { ReportGenerationProgress } from "./ReportGenerationProgress";
import { PreviousReportJobsList } from "./PreviousReportJobsList";

type Props = {
  isRouterReady: boolean;
  enrollmentCount: number;
  isGenerating: boolean;
  progress: AnalysisProgress;
  jobs: Job[];
  onStartReport: () => void;
  onResetProgress: () => void;
  onViewJob: (jobId: string, enrollmentId: string) => void;
};

export function AnalysisCenterPanel({
  isRouterReady,
  enrollmentCount,
  isGenerating,
  progress,
  jobs,
  onStartReport,
  onResetProgress,
  onViewJob,
}: Props) {
  return (
    <div className="rounded-lg bg-white px-8 py-6 shadow">
      {enrollmentCount > 0 && (
        <p className="mb-4 rounded-md border border-violet-200 bg-violet-50 px-4 py-2 text-sm text-violet-900">
          Report run will use {enrollmentCount} selected enrollment{enrollmentCount === 1 ? "" : "s"}{" "}
          (from the program page or URL).
        </p>
      )}
      {enrollmentCount === 0 && isRouterReady && (
        <p className="mb-4 text-sm text-amber-800">
          To run a report, select one or more enrollments on a program, then use &quot;Generate
          report&quot;—or add <code className="rounded bg-amber-100 px-1">?enrollment_id=…</code> to
          this page&rsquo;s URL.
        </p>
      )}
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-dark">Analysis Center</h2>
        <button
          type="button"
          onClick={onStartReport}
          disabled={isGenerating || enrollmentCount === 0}
          className={`rounded-lg px-8 py-4 font-semibold text-white transition-all ${
            isGenerating || enrollmentCount === 0
              ? "cursor-not-allowed bg-gray-400"
              : "transform bg-ai-accent shadow-lg hover:-translate-y-0.5 hover:bg-purple-700 hover:shadow-xl"
          }`}
        >
          {isGenerating ? "Report Generation in Progress..." : "Start New Report Generation"}
        </button>
      </div>

      {isGenerating && <ReportGenerationProgress progress={progress} onReset={onResetProgress} />}

      <PreviousReportJobsList jobs={jobs} onViewJob={onViewJob} />
    </div>
  );
}
