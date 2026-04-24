import type { AnalysisProgress } from "./types";

type Props = {
  progress: AnalysisProgress;
  onReset: () => void;
};

export function ReportGenerationProgress({ progress, onReset }: Props) {
  return (
    <div className="mb-8 rounded-lg border border-ai-accent/20 bg-gradient-to-r from-ai-accent/10 to-primary/10 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-dark">Report Generation Progress</h3>
        {progress.stage !== "error" && progress.stage !== "complete" && (
          <div className="flex space-x-2">
            <div className="h-3 w-3 animate-strong-pulse rounded-full bg-ai-accent" />
            <div
              className="h-3 w-3 animate-strong-pulse rounded-full bg-ai-accent"
              style={{ animationDelay: "0.5s" }}
            />
            <div
              className="h-3 w-3 animate-strong-pulse rounded-full bg-ai-accent"
              style={{ animationDelay: "1s" }}
            />
          </div>
        )}
      </div>

      <p
        className={`mb-4 text-sm ${progress.stage === "error" ? "text-red-600" : "text-gray-600"}`}
      >
        {progress.message}
      </p>

      {progress.stage === "error" && progress.error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-800">{progress.error}</p>
          <button
            type="button"
            onClick={onReset}
            className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      )}

      {progress.stage !== "idle" && progress.stage !== "error" && (
        <div className="h-2 w-full rounded-full bg-gray-200">
          <div
            className="h-2 rounded-full bg-ai-accent transition-all duration-1000"
            style={{
              width:
                progress.stage === "starting"
                  ? "10%"
                  : progress.stage === "planner"
                    ? "30%"
                    : progress.stage === "parallel"
                      ? "70%"
                      : progress.stage === "completing"
                        ? "90%"
                        : "100%",
            }}
          />
        </div>
      )}
    </div>
  );
}
